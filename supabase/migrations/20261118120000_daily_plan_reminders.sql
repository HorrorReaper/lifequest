-- The morning push for the daily plan (the briefing at /plan), next to the
-- evening review reminder. See docs/features/push-notifications.md.
--
-- * push_subscriptions gets one switch per reminder. A device keeps a row
--   while at least one is on; turning the last one off deletes the row, so
--   the check below holds. Rows saved before this migration were evening
--   review opt-ins, and stay exactly that.
-- * save_push_subscription takes which reminder the device is turning on.
--   The three-argument version stays for clients built before this
--   migration; it turns on the evening review, as it always did.
-- * ritual_settings.reminder_minutes is when the daily plan's push goes
--   out. The daily plan's prompt opens at midnight, which is no time for a
--   push, so it gets a time of its own, 08:00 to start with.
-- * claim_daily_plan_reminders mirrors claim_evening_review_reminders: due
--   users are picked and recorded in push_reminder_log in one statement.
--   The plan counts as done once the planner has committed it, the same
--   ritual_completed_at test the dashboard prompt makes.
-- * claim_evening_review_reminders now only reaches devices with the
--   evening review switched on.

-- Switches ------------------------------------------------------------------

alter table public.push_subscriptions
  add column if not exists evening_review boolean not null default true,
  add column if not exists daily_plan boolean not null default false;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_some_reminder_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_some_reminder_check check (evening_review or daily_plan);

grant update (evening_review, daily_plan) on public.push_subscriptions to authenticated;

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_reminder text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_reminder is null or p_reminder not in ('evening_review', 'daily_plan') then
    raise exception 'unknown reminder %', p_reminder using errcode = '22023';
  end if;

  -- The same browser saving again for the same account adds this reminder
  -- to the ones it has. A browser that was signed in to another account
  -- starts over with only this one, like a new device.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, evening_review, daily_plan)
  values (v_user, p_endpoint, p_p256dh, p_auth, p_reminder = 'evening_review', p_reminder = 'daily_plan')
  on conflict (endpoint) do update
    set evening_review = excluded.evening_review
          or (push_subscriptions.user_id = excluded.user_id and push_subscriptions.evening_review),
        daily_plan = excluded.daily_plan
          or (push_subscriptions.user_id = excluded.user_id and push_subscriptions.daily_plan),
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        created_at = now(),
        last_sent_at = null;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.save_push_subscription(text, text, text, text) from anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.save_push_subscription(p_endpoint, p_p256dh, p_auth, 'evening_review');
$$;

-- Reminder time ---------------------------------------------------------------

alter table public.ritual_settings
  add column if not exists reminder_minutes smallint
    check (reminder_minutes between 0 and 1439);

comment on column public.ritual_settings.reminder_minutes is
  'Minutes after local midnight the push reminder goes out. Only the daily plan reads it; null sends no daily plan reminder.';

update public.ritual_settings
  set reminder_minutes = 8 * 60
  where ritual = 'daily_plan' and reminder_minutes is null;

-- Claims ----------------------------------------------------------------------

alter table public.push_reminder_log
  drop constraint if exists push_reminder_log_ritual_check;
alter table public.push_reminder_log
  add constraint push_reminder_log_ritual_check check (ritual in ('evening_review', 'daily_plan'));

create or replace function public.claim_daily_plan_reminders(p_grace_minutes integer default 120)
returns table(user_id uuid, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  delete from public.push_reminder_log l where l.day < current_date - 7;

  return query
  with setting as (
    select r.reminder_minutes
    from public.ritual_settings r
    where r.ritual = 'daily_plan' and r.enabled and r.reminder_minutes is not null
  ),
  local_time as (
    select
      p.id as user_id,
      (now() at time zone coalesce(tz.name, 'UTC')) as local_ts
    from public.profiles p
    left join pg_catalog.pg_timezone_names tz on tz.name = p.timezone
    where exists (select 1 from public.push_subscriptions s where s.user_id = p.id and s.daily_plan)
  ),
  due as (
    select lt.user_id, lt.local_ts::date as local_day
    from local_time lt
    cross join setting st
    where (extract(hour from lt.local_ts) * 60 + extract(minute from lt.local_ts))
            between st.reminder_minutes and st.reminder_minutes + greatest(coalesce(p_grace_minutes, 120), 15) - 1
      -- The planner keeps its state in day_plans.notes as
      -- 'LIFEQUEST_TODAY_PLAN_V1:' followed by JSON (src/lib/today-plan.ts).
      -- The case keeps a malformed note from failing the whole run.
      and not exists (
        select 1 from public.day_plans dp
        where dp.user_id = lt.user_id
          and dp.plan_date = lt.local_ts::date
          and dp.notes like 'LIFEQUEST\_TODAY\_PLAN\_V1:%'
          and case
                when pg_catalog.pg_input_is_valid(substr(dp.notes, 25), 'jsonb')
                then (substr(dp.notes, 25)::jsonb -> 'metadata' ->> 'ritual_completed_at') is not null
                else false
              end
      )
  ),
  claimed as (
    insert into public.push_reminder_log (user_id, ritual, day)
    select d.user_id, 'daily_plan', d.local_day from due d
    on conflict do nothing
    returning push_reminder_log.user_id
  )
  select c.user_id, s.endpoint, s.p256dh, s.auth
  from claimed c
  join public.push_subscriptions s on s.user_id = c.user_id and s.daily_plan;
end;
$$;

revoke all on function public.claim_daily_plan_reminders(integer) from public;
revoke all on function public.claim_daily_plan_reminders(integer) from anon;
revoke all on function public.claim_daily_plan_reminders(integer) from authenticated;
grant execute on function public.claim_daily_plan_reminders(integer) to service_role;

-- Same as in 20261115130000_evening_review_reminders.sql, but only for
-- devices that have the evening review switched on.
create or replace function public.claim_evening_review_reminders(p_grace_minutes integer default 120)
returns table(user_id uuid, template_id uuid, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  delete from public.push_reminder_log l where l.day < current_date - 7;

  return query
  with setting as (
    select r.from_minutes, r.template_id, r.weekday
    from public.ritual_settings r
    where r.ritual = 'evening_review' and r.enabled and r.template_id is not null
  ),
  local_time as (
    select
      p.id as user_id,
      (now() at time zone coalesce(tz.name, 'UTC')) as local_ts
    from public.profiles p
    left join pg_catalog.pg_timezone_names tz on tz.name = p.timezone
    where exists (select 1 from public.push_subscriptions s where s.user_id = p.id and s.evening_review)
  ),
  due as (
    select lt.user_id, lt.local_ts::date as local_day, st.template_id
    from local_time lt
    cross join setting st
    where (extract(hour from lt.local_ts) * 60 + extract(minute from lt.local_ts))
            between st.from_minutes and st.from_minutes + greatest(coalesce(p_grace_minutes, 120), 15) - 1
      and (st.weekday is null or extract(isodow from lt.local_ts::date) - 1 = st.weekday)
      and not exists (
        select 1 from public.journal_entries j
        where j.user_id = lt.user_id
          and j.template_id = st.template_id
          and j.entry_date = lt.local_ts::date
          and j.is_complete
      )
  ),
  claimed as (
    insert into public.push_reminder_log (user_id, ritual, day)
    select d.user_id, 'evening_review', d.local_day from due d
    on conflict do nothing
    returning push_reminder_log.user_id
  )
  select c.user_id, d.template_id, s.endpoint, s.p256dh, s.auth
  from claimed c
  join due d on d.user_id = c.user_id
  join public.push_subscriptions s on s.user_id = c.user_id and s.evening_review;
end;
$$;

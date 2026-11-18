-- The scheduled evening review push. See docs/features/push-notifications.md.
--
-- A scheduler (Supabase pg_cron, see the docs) calls
-- /api/push/evening-review every 15 minutes. That route calls
-- claim_evening_review_reminders with the service role, which picks the
-- users who should get a reminder right now and records them in
-- push_reminder_log in the same statement, so two overlapping runs can
-- never remind the same person twice on one day.
--
-- Due means, for a user with at least one opted-in device:
--   * the evening_review ritual is enabled and has a template,
--   * in the user's own timezone, the window has opened (from_minutes)
--     within the last p_grace_minutes, on a matching weekday if one is set,
--   * there is no complete journal entry with that template for the user's
--     local today (the same test as the dashboard's prompt),
--   * and the user has not been claimed for today already.

create table if not exists public.push_reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  ritual text not null check (ritual in ('evening_review')),
  -- The user's local calendar day the reminder was for.
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, ritual, day)
);

alter table public.push_reminder_log enable row level security;
revoke all on public.push_reminder_log from anon, authenticated;

create or replace function public.claim_evening_review_reminders(p_grace_minutes integer default 120)
returns table(user_id uuid, template_id uuid, endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Only the last week is ever needed to avoid duplicates.
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
      -- An unknown timezone name would make "at time zone" fail the whole
      -- run, so it falls back to UTC like the app does.
      (now() at time zone coalesce(tz.name, 'UTC')) as local_ts
    from public.profiles p
    left join pg_catalog.pg_timezone_names tz on tz.name = p.timezone
    where exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
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
  join public.push_subscriptions s on s.user_id = c.user_id;
end;
$$;

revoke all on function public.claim_evening_review_reminders(integer) from public;
revoke all on function public.claim_evening_review_reminders(integer) from anon;
revoke all on function public.claim_evening_review_reminders(integer) from authenticated;
grant execute on function public.claim_evening_review_reminders(integer) to service_role;

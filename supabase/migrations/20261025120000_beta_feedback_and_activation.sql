-- First-cohort readiness: a feedback inbox and an activation funnel.
-- See docs/operations/first-cohort-readiness.md.
--
-- Feedback: a signed-in user can send a short message from the app. It is
-- written to this table and nowhere else -- no external service, no email.
-- Users may insert their own rows only; nobody reads them through the API.
-- Admins read them with admin_beta_feedback(), the same admin test the other
-- admin functions use (JWT app_metadata.role = admin).

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('problem', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  -- The app path the feedback was sent from, e.g. /tasks. No query string.
  page_path text check (page_path is null or char_length(page_path) <= 200),
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

drop policy if exists "Users send their own feedback" on public.beta_feedback;
create policy "Users send their own feedback"
  on public.beta_feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant insert on public.beta_feedback to authenticated;

create index if not exists beta_feedback_created_at_idx
  on public.beta_feedback (created_at desc);

create or replace function public.admin_beta_feedback(p_limit integer default 100)
returns table(id uuid, category text, message text, page_path text, created_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select f.id, f.category, f.message, f.page_path, f.created_at
  from public.beta_feedback f
  where (select auth.uid()) is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

revoke all on function public.admin_beta_feedback(integer) from public;
revoke all on function public.admin_beta_feedback(integer) from anon;
grant execute on function public.admin_beta_feedback(integer) to authenticated;

-- Activation: how many accounts that signed up on or after p_since reached
-- each step. Derived from rows the app already writes, so no event log and
-- no copy of anything personal: only counts leave this function, never task
-- titles, journal text or answers.
--
--   onboarding_completed  profiles.onboarding_complete
--   first_task            at least one task
--   first_plan            at least one saved day plan
--   first_habit_checkin   at least one completed habit log
--   returned_later_day    activity (task created, habit checked, plan saved,
--                         journal entry) on a calendar day after the signup
--                         day, in the account's own timezone
create or replace function public.admin_activation_funnel(p_since date)
returns table(
  signed_up bigint,
  onboarding_completed bigint,
  first_task bigint,
  first_plan bigint,
  first_habit_checkin bigint,
  returned_later_day bigint
)
language sql
security definer
set search_path = ''
as $$
  with cohort as (
    select
      p.id,
      p.onboarding_complete,
      (p.created_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date as signup_day,
      coalesce(nullif(p.timezone, ''), 'UTC') as tz
    from public.profiles p
    where p.created_at >= p_since::timestamp at time zone 'utc'
  ),
  activity as (
    select t.user_id, (t.created_at at time zone c.tz)::date as day
    from public.tasks t join cohort c on c.id = t.user_id
    union all
    select h.user_id, h.log_date
    from public.habit_logs h join cohort c on c.id = h.user_id
    where h.completed
    union all
    select d.user_id, d.plan_date
    from public.day_plans d join cohort c on c.id = d.user_id
    union all
    select j.user_id, j.entry_date
    from public.journal_entries j join cohort c on c.id = j.user_id
  )
  select
    count(*)::bigint,
    count(*) filter (where c.onboarding_complete)::bigint,
    count(*) filter (where exists (select 1 from public.tasks t where t.user_id = c.id))::bigint,
    count(*) filter (where exists (select 1 from public.day_plans d where d.user_id = c.id))::bigint,
    count(*) filter (
      where exists (select 1 from public.habit_logs h where h.user_id = c.id and h.completed)
    )::bigint,
    count(*) filter (
      where exists (select 1 from activity a where a.user_id = c.id and a.day > c.signup_day)
    )::bigint
  from cohort c
  where (select auth.uid()) is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;

revoke all on function public.admin_activation_funnel(date) from public;
revoke all on function public.admin_activation_funnel(date) from anon;
grant execute on function public.admin_activation_funnel(date) to authenticated;

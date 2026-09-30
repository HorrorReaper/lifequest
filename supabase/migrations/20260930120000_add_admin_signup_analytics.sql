-- Waitlist size next to the registered-user count in the admin sidebar, and
-- signups per day for the chart on /admin/tools.
--
-- Both are counts only. waitlist_signups holds email addresses, so admins
-- are not given a select policy on it; these security definer functions
-- read it for them and hand back numbers, and only to a trusted admin (JWT
-- app_metadata.role = admin), the same test admin_app_stats already made.
--
-- waitlist_signups was created by hand rather than by a migration, so this
-- migration expects it to exist already, as it does on every environment
-- the waitlist form posts to.

-- The return type changes, which create or replace cannot do.
drop function if exists public.admin_app_stats();

create function public.admin_app_stats()
returns table(total_users bigint, waitlist_signups bigint)
language sql
security definer
set search_path = ''
as $$
  select
    (select count(*) from auth.users)::bigint as total_users,
    (select count(*) from public.waitlist_signups)::bigint as waitlist_signups
  where (select auth.uid()) is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;

revoke all on function public.admin_app_stats() from public;
revoke all on function public.admin_app_stats() from anon;
grant execute on function public.admin_app_stats() to authenticated;

-- New waitlist entries and new accounts per UTC day, from p_since through
-- today. Only days with at least one signup are returned; the app fills in
-- the empty ones (src/lib/signup-analytics.ts). The start date comes from
-- the app so the range and the gap-filling agree on where it begins.
create function public.admin_signup_series(p_since date)
returns table(day date, waitlist bigint, users bigint)
language sql
security definer
set search_path = ''
as $$
  with signups as (
    select (created_at at time zone 'utc')::date as day, 1 as waitlist, 0 as users
    from public.waitlist_signups
    where created_at >= p_since::timestamp at time zone 'utc'
    union all
    select (created_at at time zone 'utc')::date as day, 0 as waitlist, 1 as users
    from auth.users
    where created_at >= p_since::timestamp at time zone 'utc'
  )
  select day, sum(waitlist)::bigint, sum(users)::bigint
  from signups
  where (select auth.uid()) is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  group by day
  order by day;
$$;

revoke all on function public.admin_signup_series(date) from public;
revoke all on function public.admin_signup_series(date) from anon;
grant execute on function public.admin_signup_series(date) to authenticated;

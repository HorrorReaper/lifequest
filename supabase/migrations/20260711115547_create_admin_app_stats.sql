create or replace function public.admin_app_stats()
returns table(total_users bigint)
language sql
security definer
set search_path = ''
as $$
  select count(*)::bigint as total_users
  from auth.users
  where (select auth.uid()) is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;

revoke all on function public.admin_app_stats() from public;
revoke all on function public.admin_app_stats() from anon;
grant execute on function public.admin_app_stats() to authenticated;

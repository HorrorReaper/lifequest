drop policy if exists "Users can read their own goals" on public.goals;
drop policy if exists "Users can create their own goals" on public.goals;
drop policy if exists "Users can update their own goals" on public.goals;
drop policy if exists "Users can delete their own goals" on public.goals;

create policy "Admins can read their own goals"
on public.goals
for select
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins can create their own goals"
on public.goals
for insert
to authenticated
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins can update their own goals"
on public.goals
for update
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins can delete their own goals"
on public.goals
for delete
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

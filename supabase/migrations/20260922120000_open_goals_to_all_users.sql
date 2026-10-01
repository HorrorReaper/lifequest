-- Goals were narrowed to admins while the feature was being tried out. They
-- are now for everyone: onboarding already asks every new user for a goal and
-- writes it here, which the admin-only policies refused for everyone else.
-- Ownership stays the boundary; only the admin condition goes.

drop policy if exists "Admins can read their own goals" on public.goals;
drop policy if exists "Admins can create their own goals" on public.goals;
drop policy if exists "Admins can update their own goals" on public.goals;
drop policy if exists "Admins can delete their own goals" on public.goals;

drop policy if exists "Users can read their own goals" on public.goals;
create policy "Users can read their own goals"
on public.goals
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own goals" on public.goals;
create policy "Users can create their own goals"
on public.goals
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own goals" on public.goals;
create policy "Users can update their own goals"
on public.goals
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own goals" on public.goals;
create policy "Users can delete their own goals"
on public.goals
for delete
to authenticated
using ((select auth.uid()) = user_id);

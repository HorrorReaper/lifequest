drop policy if exists "Users can read their own routines" on public.routines;
drop policy if exists "Users can create their own routines" on public.routines;
drop policy if exists "Users can update their own routines" on public.routines;
drop policy if exists "Users can delete their own routines" on public.routines;

drop policy if exists "Users can read their own routine items" on public.routine_items;
drop policy if exists "Users can create their own routine items" on public.routine_items;
drop policy if exists "Users can update their own routine items" on public.routine_items;
drop policy if exists "Users can delete their own routine items" on public.routine_items;

create policy "Admins can read their own routines"
on public.routines
for select
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins can create their own routines"
on public.routines
for insert
to authenticated
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins can update their own routines"
on public.routines
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

create policy "Admins can delete their own routines"
on public.routines
for delete
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins can read their own routine items"
on public.routine_items
for select
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (
    select 1
    from public.routines routine
    where routine.id = routine_id
      and routine.user_id = (select auth.uid())
  )
);

create policy "Admins can create their own routine items"
on public.routine_items
for insert
to authenticated
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (
    select 1
    from public.routines routine
    where routine.id = routine_id
      and routine.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.habits habit
    where habit.id = habit_id
      and habit.user_id = (select auth.uid())
  )
);

create policy "Admins can update their own routine items"
on public.routine_items
for update
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (
    select 1
    from public.routines routine
    where routine.id = routine_id
      and routine.user_id = (select auth.uid())
  )
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (
    select 1
    from public.routines routine
    where routine.id = routine_id
      and routine.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.habits habit
    where habit.id = habit_id
      and habit.user_id = (select auth.uid())
  )
);

create policy "Admins can delete their own routine items"
on public.routine_items
for delete
to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (
    select 1
    from public.routines routine
    where routine.id = routine_id
      and routine.user_id = (select auth.uid())
  )
);

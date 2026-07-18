create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  emoji text not null default '🌅' check (char_length(emoji) between 1 and 16),
  description text null check (description is null or char_length(description) <= 500),
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (routine_id, habit_id)
);

create index if not exists routines_user_active_idx
  on public.routines (user_id, is_archived, sort_order, created_at desc);

create index if not exists routine_items_routine_order_idx
  on public.routine_items (routine_id, sort_order, created_at);

create index if not exists routine_items_habit_idx
  on public.routine_items (habit_id);

alter table public.routines enable row level security;
alter table public.routine_items enable row level security;

drop policy if exists "Users can read their own routines" on public.routines;
create policy "Users can read their own routines"
on public.routines
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own routines" on public.routines;
create policy "Users can create their own routines"
on public.routines
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own routines" on public.routines;
create policy "Users can update their own routines"
on public.routines
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own routines" on public.routines;
create policy "Users can delete their own routines"
on public.routines
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own routine items" on public.routine_items;
create policy "Users can read their own routine items"
on public.routine_items
for select
to authenticated
using (
  exists (
    select 1
    from public.routines r
    where r.id = routine_id
      and r.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can create their own routine items" on public.routine_items;
create policy "Users can create their own routine items"
on public.routine_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.routines r
    where r.id = routine_id
      and r.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their own routine items" on public.routine_items;
create policy "Users can update their own routine items"
on public.routine_items
for update
to authenticated
using (
  exists (
    select 1
    from public.routines r
    where r.id = routine_id
      and r.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.routines r
    where r.id = routine_id
      and r.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their own routine items" on public.routine_items;
create policy "Users can delete their own routine items"
on public.routine_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.routines r
    where r.id = routine_id
      and r.user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.routine_items to authenticated;

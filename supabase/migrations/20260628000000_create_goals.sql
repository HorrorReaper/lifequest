create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  why text null check (why is null or char_length(why) <= 500),
  category text not null default 'personal' check (
    category in ('personal', 'health', 'career', 'relationships', 'learning', 'finance', 'other')
  ),
  target_date date null,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  sort_order integer not null default 0,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_status_idx on public.goals (user_id, status, sort_order, created_at desc);
create index if not exists goals_user_target_date_idx on public.goals (user_id, target_date) where target_date is not null;

alter table public.goals enable row level security;

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

grant select, insert, update, delete on public.goals to authenticated;

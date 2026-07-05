create table if not exists public.journal_learnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  field_id uuid null references public.template_fields(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  note text not null check (char_length(trim(note)) between 1 and 1200),
  tags text[] not null default '{}',
  source_response_ids uuid[] not null default '{}',
  action_text text null check (action_text is null or char_length(action_text) <= 500),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists journal_learnings_user_created_idx
  on public.journal_learnings (user_id, created_at desc);

create index if not exists journal_learnings_user_entry_idx
  on public.journal_learnings (user_id, entry_id);

create index if not exists journal_learnings_user_entry_field_idx
  on public.journal_learnings (user_id, entry_id, field_id);

create index if not exists journal_learnings_tags_idx
  on public.journal_learnings using gin (tags);

alter table public.journal_learnings enable row level security;

drop policy if exists "Users can read their own journal learnings" on public.journal_learnings;
create policy "Users can read their own journal learnings"
on public.journal_learnings
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own journal learnings" on public.journal_learnings;
create policy "Users can create their own journal learnings"
on public.journal_learnings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own journal learnings" on public.journal_learnings;
create policy "Users can update their own journal learnings"
on public.journal_learnings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own journal learnings" on public.journal_learnings;
create policy "Users can delete their own journal learnings"
on public.journal_learnings
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.journal_learnings to authenticated;

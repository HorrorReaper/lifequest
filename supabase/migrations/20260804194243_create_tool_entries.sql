-- Generic storage for self-improvement tools (vision statement, cookie jar,
-- wheel of life, time audit, ...).
--
-- Deliberately one table with a JSONB payload rather than a table per tool:
-- the whole point of the tool system is that adding a tool costs one
-- component plus one registry entry, with no schema change. The shapes all
-- fit here:
--
--   singleton (vision)      one row per revision, newest = current
--   collection (cookie jar) many rows, run_id null
--   snapshot  (wheel)       one row per measurement, compared over time
--   timeboxed (time audit)  many rows grouped by run_id
--
-- The payload is intentionally unvalidated in SQL. Each tool owns its own
-- payload shape and validates it in TypeScript; encoding those shapes as
-- CHECK constraints here would reintroduce exactly the per-tool migration
-- cost this table exists to avoid.

create table if not exists public.tool_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id text not null check (char_length(trim(tool_id)) between 1 and 64),
  run_id text null check (run_id is null or char_length(trim(run_id)) between 1 and 64),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tool_entries_user_tool_idx
  on public.tool_entries (user_id, tool_id, created_at desc);

create index if not exists tool_entries_user_tool_run_idx
  on public.tool_entries (user_id, tool_id, run_id, created_at)
  where run_id is not null;

alter table public.tool_entries enable row level security;

drop policy if exists "Users can read their own tool entries" on public.tool_entries;
create policy "Users can read their own tool entries"
on public.tool_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own tool entries" on public.tool_entries;
create policy "Users can create their own tool entries"
on public.tool_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own tool entries" on public.tool_entries;
create policy "Users can update their own tool entries"
on public.tool_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own tool entries" on public.tool_entries;
create policy "Users can delete their own tool entries"
on public.tool_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.tool_entries to authenticated;

create table if not exists public.metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  unit text check (unit is null or char_length(unit) <= 12),
  target_value numeric,
  target_direction text check (target_direction in ('at_least', 'at_most')),
  template_id uuid references public.journal_templates(id) on delete set null,
  source_field_id uuid references public.template_fields(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_value is null) = (target_direction is null))
);

create table if not exists public.metric_values (
  metric_id uuid not null references public.metrics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value_date date not null,
  value numeric not null,
  source_entry_id uuid references public.journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (metric_id, value_date)
);

create index if not exists metric_values_user_id_value_date_idx
  on public.metric_values (user_id, value_date);

-- Migration-only: remembers which legacy template fields became which metric,
-- so the value backfill can find them again after the deploy. Dropped together
-- with metric_targets in a later migration.
create table if not exists public.metric_legacy_fields (
  metric_id uuid not null references public.metrics(id) on delete cascade,
  field_id uuid primary key
);

comment on table public.metrics is
  'A number a user tracks over time, independent of any journal template. template_id and source_field_id optionally link it to a journal template field that feeds it.';

comment on table public.metric_values is
  'One value per metric and local day. The primary key makes "latest wins" a database rule. source_entry_id is null for values entered directly.';

comment on table public.metric_legacy_fields is
  'Migration-only mapping from legacy track_as_metric template fields to the metric they were merged into. No policies and no grants: only the backfill function reads it.';

alter table public.metrics enable row level security;
alter table public.metric_values enable row level security;
alter table public.metric_legacy_fields enable row level security;

drop policy if exists "Users can read their own metrics" on public.metrics;
create policy "Users can read their own metrics"
on public.metrics
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own metrics" on public.metrics;
create policy "Users can create their own metrics"
on public.metrics
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own metrics" on public.metrics;
create policy "Users can update their own metrics"
on public.metrics
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own metrics" on public.metrics;
create policy "Users can delete their own metrics"
on public.metrics
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own metric values" on public.metric_values;
create policy "Users can read their own metric values"
on public.metric_values
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own metric values" on public.metric_values;
create policy "Users can create their own metric values"
on public.metric_values
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.metrics m
    where m.id = metric_id and m.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their own metric values" on public.metric_values;
create policy "Users can update their own metric values"
on public.metric_values
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.metrics m
    where m.id = metric_id and m.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their own metric values" on public.metric_values;
create policy "Users can delete their own metric values"
on public.metric_values
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Supabase grants new public tables to anon and authenticated by default.
revoke all on public.metrics, public.metric_values from public, anon;
grant select, insert, update, delete on public.metrics to authenticated;
grant select, insert, update, delete on public.metric_values to authenticated;

revoke all on public.metric_legacy_fields from public, anon, authenticated;

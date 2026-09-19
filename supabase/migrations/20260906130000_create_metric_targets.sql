create table if not exists public.metric_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.template_fields(id) on delete cascade,
  target_value numeric not null,
  direction text not null default 'at_least'
    check (direction in ('at_least', 'at_most')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, field_id)
);

comment on table public.metric_targets is
  'A user''s target for one tracked metric. Keyed by the template field the metric is, because template_fields.config belongs to the template and is shared by every user of a system template.';

alter table public.metric_targets enable row level security;

drop policy if exists "Users can read their own metric targets" on public.metric_targets;
create policy "Users can read their own metric targets"
on public.metric_targets
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own metric targets" on public.metric_targets;
create policy "Users can create their own metric targets"
on public.metric_targets
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own metric targets" on public.metric_targets;
create policy "Users can update their own metric targets"
on public.metric_targets
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own metric targets" on public.metric_targets;
create policy "Users can delete their own metric targets"
on public.metric_targets
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.metric_targets to authenticated;

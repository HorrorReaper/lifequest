-- Part A: turn every tracked number field into a metric. Runs once; re-running
-- would bring back metrics a user has since deleted, so it is not repeatable.
-- Fields are merged per owner by lower(trim(label)) and trimmed unit. The
-- representative field of a group is the one on an active template (newest
-- template first), else the newest archived one.
drop table if exists pg_temp._tracked_fields;
drop table if exists pg_temp._tracked_groups;

create temporary table _tracked_fields as
select
  f.id as field_id,
  t.user_id,
  trim(f.label) as label,
  lower(trim(f.label)) as label_key,
  nullif(trim(f.config->>'metric_unit'), '') as unit,
  t.id as template_id,
  t.is_active,
  row_number() over (
    partition by t.user_id, lower(trim(f.label)), coalesce(nullif(trim(f.config->>'metric_unit'), ''), '')
    order by t.is_active desc, t.created_at desc, f.id
  ) as rank_in_group
from public.template_fields f
join public.journal_templates t on t.id = f.template_id
where f.field_type = 'number'
  and f.config->>'track_as_metric' = 'true'
  and t.user_id is not null
  and trim(f.label) <> '';

create temporary table _tracked_groups as
select
  gen_random_uuid() as metric_id,
  user_id,
  label_key,
  coalesce(unit, '') as unit_key,
  field_id as head_field_id
from _tracked_fields
where rank_in_group = 1;

insert into public.metrics (id, user_id, name, unit, template_id, source_field_id)
select
  g.metric_id,
  g.user_id,
  left(h.label, 60),
  left(h.unit, 12),
  case when h.is_active then h.template_id end,
  case when h.is_active then h.field_id end
from _tracked_groups g
join _tracked_fields h on h.field_id = g.head_field_id;

insert into public.metric_legacy_fields (metric_id, field_id)
select g.metric_id, f.field_id
from _tracked_fields f
join _tracked_groups g
  on g.user_id = f.user_id
 and g.label_key = f.label_key
 and g.unit_key = coalesce(f.unit, '');

-- Targets: the representative field's target wins, then the other fields in
-- the group by the same order.
update public.metrics m
set target_value = picked.target_value,
    target_direction = picked.direction
from (
  select distinct on (lf.metric_id)
    lf.metric_id, mt.target_value, mt.direction
  from public.metric_legacy_fields lf
  join _tracked_fields f on f.field_id = lf.field_id
  join public.metric_targets mt
    on mt.field_id = lf.field_id and mt.user_id = f.user_id
  order by lf.metric_id, f.rank_in_group
) picked
where m.id = picked.metric_id;

drop table _tracked_fields;
drop table _tracked_groups;

-- Part B: copy journal values into metric_values. Safe to run again: it only
-- writes days that are missing, or days whose stored value came from an older
-- entry than the incoming one. A value entered directly (no source entry) is
-- never replaced.
create or replace function public.backfill_metric_values()
returns integer
language sql
security definer
set search_path = public
as $$
  with latest as (
    select distinct on (lf.metric_id, e.entry_date)
      lf.metric_id,
      m.user_id,
      e.entry_date,
      r.value_number,
      e.id as entry_id
    from public.metric_legacy_fields lf
    join public.metrics m on m.id = lf.metric_id
    join public.journal_responses r on r.field_id = lf.field_id
    join public.journal_entries e on e.id = r.entry_id
    where r.value_number is not null
    order by lf.metric_id, e.entry_date, e.created_at desc, e.id
  ),
  written as (
    insert into public.metric_values as mv
      (metric_id, user_id, value_date, value, source_entry_id)
    select metric_id, user_id, entry_date, value_number, entry_id
    from latest
    on conflict (metric_id, value_date) do update
      set value = excluded.value,
          source_entry_id = excluded.source_entry_id,
          updated_at = now()
      where exists (
        select 1
        from public.journal_entries existing, public.journal_entries incoming
        where existing.id = mv.source_entry_id
          and incoming.id = excluded.source_entry_id
          and existing.created_at < incoming.created_at
      )
    returning 1
  )
  select count(*)::integer from written
$$;

revoke execute on function public.backfill_metric_values() from public, anon, authenticated;

select public.backfill_metric_values();

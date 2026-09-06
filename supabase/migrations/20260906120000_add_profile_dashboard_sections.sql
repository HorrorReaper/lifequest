alter table public.profiles
  add column dashboard_sections jsonb not null default '{}'::jsonb;

comment on column public.profiles.dashboard_sections is
  'Which dashboard sections the user turned off, keyed by the ids in src/lib/dashboard-sections.ts. An absent key means visible, so the default empty object shows everything and no backfill is needed.';

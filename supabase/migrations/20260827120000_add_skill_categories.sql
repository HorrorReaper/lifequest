create type public.skill_category as enum (
  'physical_health',
  'mental_health',
  'focus',
  'learning',
  'relationships',
  'career'
);

alter table public.habits
  add column skill_category public.skill_category;

alter table public.quests
  add column skill_category public.skill_category;

alter table public.xp_events
  add column skill_category public.skill_category;

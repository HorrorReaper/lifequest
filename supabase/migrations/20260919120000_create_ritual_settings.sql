-- Global settings for the four dashboard rituals (Daily Plan, Evening
-- Review, Weekly Review, Weekly Plan): whether each prompts, when, what it
-- says, and which journal template it opens.
--
-- One row per ritual, keyed by the ritual's name, readable by everyone
-- signed in and writable only by trusted admins (JWT role), the same test
-- admin_app_stats makes. Seeded with the behaviour the code hard-coded
-- before this table existed, so nothing changes for anyone on the day it
-- ships. src/lib/rituals.ts carries the same defaults for an environment
-- where this seed has not run; keep the two in step.

create table public.ritual_settings (
  ritual text primary key
    check (ritual in ('daily_plan', 'evening_review', 'weekly_review', 'weekly_plan')),
  enabled boolean not null default true,
  -- 0 = Monday … 6 = Sunday, matching weekdayOf() in src/lib/dates.ts.
  -- Null means every day; the daily rituals keep it null.
  weekday smallint check (weekday between 0 and 6),
  -- Minutes after local midnight the prompt may open from, in the user's
  -- own timezone. 0 for "any time".
  from_minutes smallint not null default 0 check (from_minutes between 0 and 1439),
  -- The journal template the prompt opens. Null for the Daily Plan, whose
  -- target is the planner, and null once an admin's chosen template is
  -- deleted, which hides the prompt rather than sending users to a 404.
  template_id uuid references public.journal_templates(id) on delete set null,
  -- {name} in any of these becomes the user's name.
  title text not null,
  description text not null,
  cta_label text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.ritual_settings is
  'One row per dashboard ritual prompt. Read by every user, edited by trusted admins at /admin/rituals. Defaults duplicated in src/lib/rituals.ts.';

alter table public.ritual_settings enable row level security;

create policy "ritual settings are readable by every signed-in user"
  on public.ritual_settings for select
  to authenticated using (true);

create policy "trusted admins update ritual settings"
  on public.ritual_settings for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No insert or delete policy on purpose: the four rows below are the whole
-- set, and the app never adds or removes one.

insert into public.ritual_settings
  (ritual, enabled, weekday, from_minutes, template_id, title, description, cta_label)
values
  (
    'daily_plan', true, null, 0, null,
    'Welcome back, {name} 👋',
    'Want to start with your daily briefing? A few minutes now to set your Top Three makes the rest of the day easier to navigate.',
    'Start briefing'
  ),
  (
    'evening_review', true, null, 1200,
    -- Created by hand rather than by a migration, so it is found by name
    -- once, here. Null where no such template exists, which hides the
    -- prompt on that environment -- what happened there before too.
    (select id from public.journal_templates
      where is_system = true and name = 'Evening Review' and is_active = true
      order by created_at limit 1),
    'How was your day, {name}?',
    'Close the loop before you switch off. A couple of minutes to reflect on today and set tomorrow''s focus.',
    'Start evening review'
  ),
  (
    'weekly_review', true, 6, 1080,
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    'How was your week, {name}?',
    'Step back before the next one starts. A few minutes on what worked, what did not, and what you want to change.',
    'Start weekly review'
  ),
  (
    'weekly_plan', true, 0, 0,
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'New week, {name} 🗓️',
    'Give the week a theme and three outcomes before the days start deciding for you. Each morning''s briefing gets easier with them set.',
    'Plan the week'
  )
on conflict (ritual) do nothing;

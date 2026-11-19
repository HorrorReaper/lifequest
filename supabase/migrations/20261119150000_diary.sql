-- The diary: one entry a day with a title and Markdown, read back on
-- /journal/diary. See docs/features/journal.md#diary.
--
-- * A system template "Diary" with fixed ids (src/lib/diary.ts), like the
--   weekly ritual templates: an optional title and a Markdown body, the new
--   `markdown` field type. Entries go through the normal journal pipeline,
--   so they earn XP and count for the streak.
-- * journal_entries.is_diary marks diary entries. A trigger sets it for the
--   Diary template; the column is there so other entries (a Free Write) can
--   be marked later without another migration.
-- * At most one diary entry per user and day, enforced by a unique index so
--   two tabs saving at once cannot both win.

insert into public.journal_templates (
  id, user_id, name, description, entry_type, icon,
  is_default, is_system, xp_reward, sort_order, is_active
)
values (
  'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a11',
  null,
  'Diary',
  'One page a day: what happened, in your own words.',
  'diary',
  '📔',
  false,
  true,
  15,
  103,
  true
)
on conflict (id) do nothing;

insert into public.template_fields (
  id, template_id, field_type, label, description, placeholder,
  is_required, sort_order, config
)
values
  (
    'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a12',
    'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a11',
    'text',
    'Title',
    null,
    'Give the day a name',
    false,
    0,
    '{}'::jsonb
  ),
  (
    'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a13',
    'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a11',
    'markdown',
    'What happened today?',
    null,
    'Write about your day. Markdown works, images come from https links.',
    true,
    1,
    '{"maxLength": 20000}'::jsonb
  )
on conflict (id) do nothing;

alter table public.journal_entries
  add column if not exists is_diary boolean not null default false;

create or replace function public.mark_diary_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.template_id = 'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a11'::uuid then
    new.is_diary := true;
  end if;
  return new;
end;
$$;

drop trigger if exists journal_entries_mark_diary on public.journal_entries;
create trigger journal_entries_mark_diary
  before insert or update of template_id on public.journal_entries
  for each row
  execute function public.mark_diary_entry();

create unique index if not exists journal_entries_one_diary_per_day
  on public.journal_entries (user_id, entry_date)
  where is_diary;

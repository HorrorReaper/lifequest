-- The journal template the dashboard's Daily Reflection section writes into.
--
-- Seeded here rather than created by hand in the Supabase dashboard so the
-- section has somewhere to write on every environment, and so its id is a
-- constant the app can reference (src/lib/daily-reflection.ts) instead of a
-- name lookup that a rename would break.
--
-- The question itself is not stored on the template: it rotates daily and is
-- derived from the entry's date, so one template serves every prompt.

insert into public.journal_templates (
  id,
  user_id,
  name,
  description,
  entry_type,
  icon,
  is_default,
  is_system,
  xp_reward,
  sort_order,
  is_active
)
values (
  'f3ff8330-725f-43ef-b076-7fe79ba96cb3',
  null,
  'Daily Reflection',
  'One question a day, and as much or as little as you want to say about it.',
  'free_write',
  '🪞',
  false,
  true,
  -- Matches the other short system templates: a few minutes of writing.
  10,
  -- Last of the system templates on purpose. The dashboard's journal nudge
  -- shows the first six by sort order, and this one has its own section, so
  -- it should not push an existing template out of that list.
  100,
  true
)
on conflict (id) do nothing;

insert into public.template_fields (
  id,
  template_id,
  field_type,
  label,
  description,
  placeholder,
  is_required,
  sort_order,
  config
)
values (
  '1bab55cf-5277-4597-9bc6-74a17ce47a09',
  'f3ff8330-725f-43ef-b076-7fe79ba96cb3',
  'textarea',
  'Your reflection',
  null,
  'Whatever comes to mind. No one else reads this.',
  -- Not required: a half-written thought still counts as having shown up,
  -- and a required field would turn the day's question into a chore.
  false,
  0,
  '{}'::jsonb
)
on conflict (id) do nothing;

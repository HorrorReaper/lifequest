-- The two journal templates behind the dashboard's weekly rituals: the
-- Weekly Review the Sunday-evening prompt opens, and the Weekly Plan the
-- Monday prompt opens.
--
-- Seeded here rather than created by hand, for the same reasons as the Daily
-- Reflection template (20260911120000): every environment gets them, and the
-- app references fixed ids (src/lib/weekly-rituals.ts) instead of the name
-- lookup the Evening Review prompt relies on, which a rename would break.
--
-- Sort orders sit behind Daily Reflection (100) so neither pushes an existing
-- template out of the dashboard's six-slot journal nudge; both have a prompt
-- of their own to be found through.

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
values
  (
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    null,
    'Weekly Review',
    'Close the week: what worked, what did not, and what you want to change.',
    'weekly',
    '📝',
    false,
    true,
    -- A week's worth of reflection, twice the daily reviews.
    50,
    101,
    true
  ),
  (
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    null,
    'Weekly Plan',
    'Open the week: a theme, three outcomes, and what you will protect.',
    'weekly',
    '🗓️',
    false,
    true,
    50,
    102,
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
values
  -- Weekly Review
  (
    '0d2a6c8e-1f3b-4a5c-9e7d-6b8a0c2e4f10',
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    'textarea',
    'Best moment of the week',
    null,
    'The thing you would tell someone about first.',
    false,
    0,
    '{}'::jsonb
  ),
  (
    '1e3b7d9f-2a4c-4b6d-8f0e-7c9b1d3f5a11',
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    'textarea',
    'Biggest struggle this week',
    null,
    'Where it got hard, and what made it hard.',
    false,
    1,
    '{}'::jsonb
  ),
  (
    '2f4c8e0a-3b5d-4c7e-9a1f-8d0c2e4a6b12',
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    'textarea',
    'What I want to do differently next week',
    null,
    'One concrete change is worth more than three intentions.',
    false,
    2,
    '{}'::jsonb
  ),
  (
    '3a5d9f1b-4c6e-4d8f-8b2a-9e1d3f5b7c13',
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    'rating',
    'Overall week rating',
    null,
    null,
    false,
    3,
    '{"max": 5}'::jsonb
  ),
  (
    '4b6e0a2c-5d7f-4e9a-9c3b-0f2e4a6c8d14',
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    'textarea',
    'Free reflection',
    null,
    'Anything else the week left behind.',
    false,
    4,
    '{}'::jsonb
  ),
  -- Weekly Plan
  (
    '5c7f1b3d-6e8a-4f0b-8d4c-1a3f5b7d9e15',
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'text',
    'Theme of the week',
    'A short line every later tradeoff can be held against.',
    'e.g. Finish before starting',
    true,
    0,
    '{}'::jsonb
  ),
  (
    '6d8a2c4e-7f9b-4a1c-9e5d-2b4a6c8e0f16',
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'text',
    'Outcome 1 — must win',
    'If only one thing gets done this week, it is this.',
    null,
    true,
    1,
    '{}'::jsonb
  ),
  (
    '7e9b3d5f-8a0c-4b2d-8f6e-3c5b7d9f1a17',
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'text',
    'Outcome 2',
    null,
    null,
    false,
    2,
    '{}'::jsonb
  ),
  (
    '8f0c4e6a-9b1d-4c3e-9a7f-4d6c8e0a2b18',
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'text',
    'Outcome 3',
    null,
    null,
    false,
    3,
    '{}'::jsonb
  ),
  (
    '9a1d5f7b-0c2e-4d4f-8b8a-5e7d9f1b3c19',
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'textarea',
    'What I will protect this week',
    'Habits, rest, people — the things that do not get traded away.',
    null,
    false,
    4,
    '{}'::jsonb
  ),
  (
    'ab2e6a8c-1d3f-4e5a-9c9b-6f8e0a2c4d1a',
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'textarea',
    'Known obstacles and how I''ll handle them',
    null,
    'What is likely to get in the way, and the plan for when it does.',
    false,
    5,
    '{}'::jsonb
  )
on conflict (id) do nothing;

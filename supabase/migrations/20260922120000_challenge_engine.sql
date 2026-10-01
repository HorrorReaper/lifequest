-- Challenge engine: every challenge day carries a completion rule, a
-- reflection day is completed by a journal entry, and a user runs one
-- challenge at a time.
-- Design: docs/superpowers/specs/2026-09-22-challenge-engine-design.md
--
-- Pre-flight: step 4 fails if a user has two active enrollments. Run this
-- first and expect no rows:
--   select user_id, count(*) from public.challenge_enrollments
--   where status = 'active' group by user_id having count(*) > 1;

-- 1. Completion rules -------------------------------------------------------

alter table public.challenge_days
  add column completion_rule jsonb not null default '{"type":"reflection"}'::jsonb;

-- Every day that exists already keeps its behaviour: checked off by hand.
update public.challenge_days set completion_rule = '{"type":"manual"}'::jsonb;

-- Only the type is checked here. Parameters (counts, ids) are validated by
-- the editor and normalized on read in src/lib/challenge-rules.ts, so this
-- constraint does not change with every new parameter.
alter table public.challenge_days
  add constraint challenge_days_rule_type check (
    completion_rule->>'type' in (
      'reflection', 'manual',
      'habits_created', 'habit_checkins',
      'journal_entry', 'plan_committed',
      'tasks_created', 'tasks_completed',
      'lesson_completed'
    )
  );

-- A reflection nobody can be asked for cannot be written.
alter table public.challenge_days
  add constraint challenge_days_reflection_needs_prompt check (
    completion_rule->>'type' <> 'reflection' or reflection_prompt is not null
  );

-- 2. The reflection behind a completed day ----------------------------------

-- set null: deleting the entry keeps the day completed; nothing punitive.
alter table public.challenge_day_progress
  add column journal_entry_id uuid references public.journal_entries(id) on delete set null;

-- One reflection completes at most one day. Nulls do not collide.
alter table public.challenge_day_progress
  add constraint challenge_day_progress_entry_once unique (journal_entry_id);

-- 3. Stable URLs ------------------------------------------------------------

alter table public.challenge_templates add column slug text;

alter table public.challenge_templates
  add constraint challenge_templates_slug_key unique (slug);

alter table public.challenge_templates
  add constraint challenge_templates_slug_format check (
    slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  );

-- 4. One active challenge per user ------------------------------------------

-- The per-user index implies the old per-challenge one.
drop index if exists public.challenge_enrollments_one_active_idx;

create unique index challenge_enrollments_one_active_per_user
  on public.challenge_enrollments (user_id)
  where status = 'active';

-- 5. The Challenge Reflection template --------------------------------------

-- Seeded like the Daily Reflection (20260911120000): a fixed id the app can
-- reference, one field, and the question passed in from the challenge day
-- rather than stored on the template.
insert into public.journal_templates (
  id, user_id, name, description, entry_type, icon,
  is_default, is_system, xp_reward, sort_order, is_active
)
values (
  'afc4f953-3ad1-432f-abd4-acab80f82e68', null, 'Challenge Reflection',
  'How today''s challenge went, in your own words.', 'free_write', '🧗',
  false, true, 10, 103, true
)
on conflict (id) do nothing;

insert into public.template_fields (
  id, template_id, field_type, label, description, placeholder,
  is_required, sort_order, config
)
values (
  '2442e79d-08eb-4b47-9893-17ef24580b71', 'afc4f953-3ad1-432f-abd4-acab80f82e68',
  'textarea', 'Your reflection', null,
  'What happened, and what did you notice?',
  -- Required, unlike the Daily Reflection: this answer is the evidence the
  -- day was done.
  true, 0, '{}'::jsonb
)
on conflict (id) do nothing;

-- 6. Saving a challenge carries each day's rule ------------------------------

create or replace function public.admin_save_challenge_template(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_schedule_mode text,
  p_xp_reward integer,
  p_coin_reward integer,
  p_is_published boolean,
  p_days jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid := p_template_id;
  v_day_count integer;
begin
  if v_user_id is null or (select auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' then
    raise exception 'Admin role required';
  end if;
  if jsonb_typeof(p_days) <> 'array' then raise exception 'Challenge days must be an array'; end if;
  v_day_count := jsonb_array_length(p_days);
  if v_day_count < 1 or v_day_count > 365 then raise exception 'A challenge needs between 1 and 365 days'; end if;
  if p_schedule_mode not in ('sequential', 'strict') then raise exception 'Invalid schedule mode'; end if;

  if v_template_id is null then
    insert into public.challenge_templates (
      created_by, title, description, duration_days, schedule_mode, xp_reward, coin_reward, is_published
    ) values (
      v_user_id, trim(p_title), nullif(trim(p_description), ''), v_day_count, p_schedule_mode,
      p_xp_reward, p_coin_reward, p_is_published
    ) returning id into v_template_id;
  else
    if exists (select 1 from public.challenge_enrollments where template_id = v_template_id) then
      raise exception 'This challenge already has enrollments. Duplicate it to create a new version.';
    end if;
    update public.challenge_templates
    set title = trim(p_title),
        description = nullif(trim(p_description), ''),
        duration_days = v_day_count,
        schedule_mode = p_schedule_mode,
        xp_reward = p_xp_reward,
        coin_reward = p_coin_reward,
        is_published = p_is_published,
        updated_at = now()
    where id = v_template_id;
    if not found then raise exception 'Challenge template not found'; end if;
    delete from public.challenge_days where template_id = v_template_id;
  end if;

  insert into public.challenge_days (
    template_id, day_number, title, instructions, reflection_prompt, completion_rule
  )
  select
    v_template_id,
    item.ordinality::integer,
    trim(item.value ->> 'title'),
    trim(item.value ->> 'instructions'),
    nullif(trim(item.value ->> 'reflection_prompt'), ''),
    -- A JSON null is not an SQL null, so check the type rather than coalesce.
    case
      when jsonb_typeof(item.value -> 'completion_rule') = 'object'
        then item.value -> 'completion_rule'
      else '{"type":"reflection"}'::jsonb
    end
  from jsonb_array_elements(p_days) with ordinality as item(value, ordinality);

  return v_template_id;
end;
$$;

-- 7. Starting refuses a second challenge ------------------------------------

create or replace function public.start_challenge_program(p_template_id uuid)
returns table(enrollment_id uuid, start_date date, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.challenge_templates where id = p_template_id and is_published) then
    raise exception 'Challenge is not available';
  end if;
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;

  select id, challenge_enrollments.start_date, challenge_enrollments.status
  into enrollment_id, start_date, status
  from public.challenge_enrollments
  where template_id = p_template_id and user_id = v_user_id and challenge_enrollments.status = 'active'
  limit 1;

  if enrollment_id is null then
    -- Named here rather than left to the unique index, whose error would
    -- reach the user as a raw constraint name.
    if exists (
      select 1 from public.challenge_enrollments
      where user_id = v_user_id and challenge_enrollments.status = 'active'
    ) then
      raise exception 'An active challenge is already running';
    end if;

    insert into public.challenge_enrollments (template_id, user_id, start_date)
    values (p_template_id, v_user_id, v_today)
    returning id, challenge_enrollments.start_date, challenge_enrollments.status
    into enrollment_id, start_date, status;
  end if;
  return next;
end;
$$;

create or replace function public.restart_challenge_program(p_template_id uuid)
returns table(enrollment_id uuid, start_date date, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.challenge_templates where id = p_template_id and is_published) then
    raise exception 'Challenge is not available';
  end if;
  if exists (
    select 1 from public.challenge_enrollments
    where user_id = v_user_id and challenge_enrollments.status = 'active'
      and template_id <> p_template_id
  ) then
    raise exception 'An active challenge is already running';
  end if;
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;

  update public.challenge_enrollments
  set status = 'abandoned', updated_at = now()
  where template_id = p_template_id and user_id = v_user_id and challenge_enrollments.status = 'active';

  insert into public.challenge_enrollments (template_id, user_id, start_date)
  values (p_template_id, v_user_id, v_today)
  returning id, challenge_enrollments.start_date, challenge_enrollments.status
  into enrollment_id, start_date, status;
  return next;
end;
$$;

-- 8. Completing a day: reflections are verified -----------------------------

-- Dropped rather than replaced: the new third argument would otherwise leave
-- two overloads behind, and a two-argument call would be ambiguous.
drop function public.complete_challenge_program_day(uuid, text);

create function public.complete_challenge_program_day(
  p_enrollment_id uuid,
  p_note text default null,
  p_journal_entry_id uuid default null
)
returns table(
  completed_day integer,
  completed_days integer,
  total_days integer,
  completion_date date,
  challenge_completed boolean,
  total_xp integer,
  coins integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_template_id uuid;
  v_start_date date;
  v_mode text;
  v_xp_reward integer;
  v_coin_reward integer;
  v_title text;
  v_day_id uuid;
  v_rule_type text;
  v_existing_day integer;
  v_last_completed date;
  v_activation date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;
  completion_date := v_today;

  select enrollment.template_id, enrollment.start_date, template.schedule_mode,
         template.duration_days, template.xp_reward, template.coin_reward, template.title
  into v_template_id, v_start_date, v_mode, total_days, v_xp_reward, v_coin_reward, v_title
  from public.challenge_enrollments enrollment
  join public.challenge_templates template on template.id = enrollment.template_id
  where enrollment.id = p_enrollment_id and enrollment.user_id = v_user_id and enrollment.status = 'active'
  for update of enrollment;
  if not found then raise exception 'Active challenge enrollment not found'; end if;

  -- Idempotent per calendar day: a second call returns the first result.
  select progress.day_number into v_existing_day
  from public.challenge_day_progress progress
  where progress.enrollment_id = p_enrollment_id and progress.completed_on = v_today;
  if v_existing_day is not null then
    completed_day := v_existing_day;
    select count(*)::integer into completed_days from public.challenge_day_progress where enrollment_id = p_enrollment_id;
    challenge_completed := completed_days >= total_days;
    select coalesce(profiles.total_xp, 0) into total_xp from public.profiles where id = v_user_id;
    select coalesce(city_states.coins, 0) into coins from public.city_states where user_id = v_user_id;
    return next;
    return;
  end if;

  select count(*)::integer, max(progress.completed_on)
  into completed_days, v_last_completed
  from public.challenge_day_progress progress where progress.enrollment_id = p_enrollment_id;
  completed_day := completed_days + 1;
  v_activation := coalesce(v_last_completed + 1, v_start_date);

  if v_mode = 'strict' and v_today <> v_start_date + completed_days then
    raise exception 'The strict challenge streak has been broken';
  end if;
  if completed_day > total_days then raise exception 'Challenge is already complete'; end if;

  select id, completion_rule ->> 'type' into v_day_id, v_rule_type
  from public.challenge_days
  where template_id = v_template_id and day_number = completed_day;
  if v_day_id is null then raise exception 'The next challenge day is missing'; end if;

  if p_journal_entry_id is null and v_rule_type = 'reflection' then
    raise exception 'This challenge day is completed by writing its reflection';
  end if;

  if p_journal_entry_id is not null then
    if v_rule_type <> 'reflection' then
      raise exception 'This challenge day is not completed by a reflection';
    end if;
    -- Security definer bypasses RLS, so ownership is checked explicitly.
    -- The answer is checked, not just is_complete: the entry form writes the
    -- entry row as complete before it writes the responses.
    if not exists (
      select 1 from public.journal_entries entry
      where entry.id = p_journal_entry_id
        and entry.user_id = v_user_id
        and entry.is_complete
        and entry.template_id = 'afc4f953-3ad1-432f-abd4-acab80f82e68'
        and entry.entry_date >= v_activation
        and exists (
          select 1 from public.journal_responses response
          where response.entry_id = entry.id
            and response.field_id = '2442e79d-08eb-4b47-9893-17ef24580b71'
            and length(trim(coalesce(response.value_text, ''))) > 0
        )
    ) then
      raise exception 'That reflection cannot complete this challenge day';
    end if;
  end if;

  insert into public.challenge_day_progress (
    enrollment_id, challenge_day_id, user_id, day_number, completed_on, note, journal_entry_id
  ) values (
    p_enrollment_id, v_day_id, v_user_id, completed_day, v_today, nullif(trim(p_note), ''), p_journal_entry_id
  );
  completed_days := completed_day;
  challenge_completed := completed_days >= total_days;

  if challenge_completed then
    update public.challenge_enrollments
    set status = 'completed', completed_at = now(), updated_at = now()
    where id = p_enrollment_id and user_id = v_user_id and status = 'active';

    update public.profiles
    set total_xp = coalesce(profiles.total_xp, 0) + v_xp_reward, updated_at = now()
    where id = v_user_id returning profiles.total_xp into total_xp;

    insert into public.city_states (user_id, coins)
    values (v_user_id, v_coin_reward)
    on conflict (user_id) do update
      set coins = public.city_states.coins + excluded.coins, updated_at = now()
    returning public.city_states.coins into coins;

    insert into public.xp_events (user_id, source_type, source_id, xp_amount, description)
    values (v_user_id, 'challenge_program', p_enrollment_id, v_xp_reward, 'Challenge completed: ' || v_title);
  else
    select coalesce(profiles.total_xp, 0) into total_xp from public.profiles where id = v_user_id;
    select coalesce(city_states.coins, 0) into coins from public.city_states where user_id = v_user_id;
  end if;
  total_xp := coalesce(total_xp, 0);
  coins := coalesce(coins, 0);
  return next;
end;
$$;

revoke all on function public.complete_challenge_program_day(uuid, text, uuid) from public;
revoke all on function public.complete_challenge_program_day(uuid, text, uuid) from anon;
grant execute on function public.complete_challenge_program_day(uuid, text, uuid) to authenticated;

-- 9. Leaving a challenge ----------------------------------------------------

-- Users can insert enrollments but not update them, so leaving needs this.
create or replace function public.abandon_challenge_program(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  update public.challenge_enrollments
  set status = 'abandoned', updated_at = now()
  where id = p_enrollment_id and user_id = v_user_id and status = 'active';
  if not found then raise exception 'Active challenge enrollment not found'; end if;
end;
$$;

revoke all on function public.abandon_challenge_program(uuid) from public;
revoke all on function public.abandon_challenge_program(uuid) from anon;
grant execute on function public.abandon_challenge_program(uuid) to authenticated;

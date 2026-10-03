-- One challenge system instead of two.
--
-- 20260922120000_challenge_engine.sql (applied on production) and
-- 20260930130000_challenge_programs_v2.sql were written in parallel and
-- clash: two rule representations (challenge_days.completion_rule jsonb vs.
-- completion_type / completion_target / completion_param), two overloads of
-- complete_challenge_program_day that make every call ambiguous ("function
-- is not unique"), a default day type that rejects any day without a
-- reflection prompt, and "one active challenge per user" against personal
-- challenges running side by side.
--
-- Kept from the engine: reflection days (completed by a Challenge
-- Reflection journal entry, linked through challenge_day_progress.
-- journal_entry_id), the Challenge Reflection template, "habits created" as
-- a rule, abandon_challenge_program, and slugs.
-- Kept from v2: the column-based rules and everything built on them.
-- Dropped: completion_rule (folded into the columns first), the second
-- complete_challenge_program_day, and the per-user active limit.
--
-- Written to be safe on every database state this repo can produce: with or
-- without v2 / personal challenges applied, and on a fresh database.

-- ---------------------------------------------------------------------------
-- Rules: fold completion_rule into the columns
-- ---------------------------------------------------------------------------

alter table public.challenge_days drop constraint if exists challenge_days_reflection_needs_prompt;
alter table public.challenge_days drop constraint if exists challenge_days_rule_type;
alter table public.challenge_days drop constraint if exists challenge_days_completion_type_check;
alter table public.challenge_days drop constraint if exists challenge_days_completion_param_check;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'challenge_days' and column_name = 'completion_rule'
  ) then
    -- Only rows still on the v2 default carry information in completion_rule
    -- alone: anything saved through the v2 editor already has its columns.
    update public.challenge_days d
    set completion_type = case d.completion_rule ->> 'type'
          when 'reflection' then case when d.reflection_prompt is not null then 'reflection' else 'manual' end
          when 'habits_created' then 'habits_created'
          when 'habit_checkins' then 'habit_checkins'
          when 'journal_entry' then 'journal_entries'
          when 'plan_committed' then 'day_plans'
          when 'tasks_created' then 'tasks_created'
          when 'tasks_completed' then 'tasks_completed'
          else 'manual'
        end,
        completion_target = greatest(1, least(100, coalesce(
          case when (d.completion_rule ->> 'count') ~ '^[0-9]+$' then (d.completion_rule ->> 'count')::integer end,
          case when (d.completion_rule ->> 'target') ~ '^[0-9]+$' then (d.completion_rule ->> 'target')::integer end,
          1
        )))
    where d.completion_type = 'manual'
      and coalesce(d.completion_rule ->> 'type', 'manual') <> 'manual';

    alter table public.challenge_days drop column completion_rule;
  end if;
end;
$$;

-- Keep in step with CHALLENGE_RULES in src/lib/challenge-rules.ts.
alter table public.challenge_days
  add constraint challenge_days_completion_type_check
    check (completion_type in (
      'manual',
      'reflection',
      'habits_active',
      'habits_created',
      'habit_checkins',
      'journal_entries',
      'day_plans',
      'tasks_created',
      'tasks_completed',
      'goals_active',
      'goals_created',
      'learnings_captured',
      'tool_entries'
    )),
  add constraint challenge_days_completion_param_check
    check (
      (completion_param is null or char_length(completion_param) between 1 and 64)
      and (completion_type <> 'tool_entries' or completion_param is not null)
    ),
  -- From the engine: a reflection nobody can be asked for cannot be written.
  add constraint challenge_days_reflection_needs_prompt
    check (completion_type <> 'reflection' or reflection_prompt is not null);

-- ---------------------------------------------------------------------------
-- Enrollments: one active run per challenge, any number of challenges
-- ---------------------------------------------------------------------------

drop index if exists public.challenge_enrollments_one_active_per_user;
create unique index if not exists challenge_enrollments_one_active_idx
  on public.challenge_enrollments (template_id, user_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Progress: the reflection behind a day (engine; idempotent)
-- ---------------------------------------------------------------------------

alter table public.challenge_day_progress
  add column if not exists journal_entry_id uuid references public.journal_entries(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'challenge_day_progress_entry_once'
  ) then
    alter table public.challenge_day_progress
      add constraint challenge_day_progress_entry_once unique (journal_entry_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Slugs: the engine's unique constraint makes v2's index redundant
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'challenge_templates_slug_key') then
    drop index if exists public.challenge_templates_slug_idx;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rule evaluation
-- ---------------------------------------------------------------------------

-- The Challenge Reflection template and its one field, seeded by the engine
-- migration. Fixed ids, also in src/lib/challenge-rules.ts.
--   template afc4f953-3ad1-432f-abd4-acab80f82e68
--   field    2442e79d-08eb-4b47-9893-17ef24580b71

create or replace function public.challenge_rule_count(
  p_user_id uuid,
  p_type text,
  p_param text,
  p_since date,
  p_timezone text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := coalesce(nullif(p_timezone, ''), 'Europe/Berlin');
  v_count integer := 0;
begin
  case p_type
    when 'habits_active' then
      select count(*)::integer into v_count
      from public.habits h
      where h.user_id = p_user_id and not h.is_archived;

    when 'habits_created' then
      select count(*)::integer into v_count
      from public.habits h
      where h.user_id = p_user_id
        and (h.created_at at time zone v_tz)::date >= p_since;

    when 'habit_checkins' then
      select count(*)::integer into v_count
      from public.habit_logs hl
      where hl.user_id = p_user_id and hl.completed and hl.log_date >= p_since;

    when 'journal_entries' then
      select count(*)::integer into v_count
      from public.journal_entries je
      where je.user_id = p_user_id
        and je.is_complete
        and je.entry_date >= p_since
        and (p_param is null or je.template_id::text = p_param);

    when 'reflection' then
      -- A written answer, not just a complete entry (the form writes the
      -- entry before its responses), and not one that already completed
      -- another day.
      select count(*)::integer into v_count
      from public.journal_entries je
      where je.user_id = p_user_id
        and je.is_complete
        and je.template_id = 'afc4f953-3ad1-432f-abd4-acab80f82e68'
        and je.entry_date >= p_since
        and exists (
          select 1 from public.journal_responses r
          where r.entry_id = je.id
            and r.field_id = '2442e79d-08eb-4b47-9893-17ef24580b71'
            and length(trim(coalesce(r.value_text, ''))) > 0
        )
        and not exists (
          select 1 from public.challenge_day_progress p where p.journal_entry_id = je.id
        );

    when 'day_plans' then
      select count(*)::integer into v_count
      from public.day_plans dp
      where dp.user_id = p_user_id and dp.plan_date >= p_since;

    when 'tasks_created' then
      select count(*)::integer into v_count
      from public.tasks t
      where t.user_id = p_user_id
        and (t.created_at at time zone v_tz)::date >= p_since;

    when 'tasks_completed' then
      select count(*)::integer into v_count
      from public.tasks t
      where t.user_id = p_user_id
        and t.is_completed
        and t.completed_at is not null
        and (t.completed_at at time zone v_tz)::date >= p_since;

    when 'goals_active' then
      select count(*)::integer into v_count
      from public.goals g
      where g.user_id = p_user_id and g.status in ('active', 'completed');

    when 'goals_created' then
      select count(*)::integer into v_count
      from public.goals g
      where g.user_id = p_user_id
        and g.status <> 'archived'
        and (g.created_at at time zone v_tz)::date >= p_since;

    when 'learnings_captured' then
      select count(*)::integer into v_count
      from public.journal_learnings jl
      where jl.user_id = p_user_id
        and (jl.created_at at time zone v_tz)::date >= p_since;

    when 'tool_entries' then
      select count(*)::integer into v_count
      from public.tool_entries te
      where te.user_id = p_user_id
        and te.tool_id = p_param
        and (greatest(te.created_at, te.updated_at) at time zone v_tz)::date >= p_since;

    else
      v_count := 0;
  end case;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.challenge_rule_count(uuid, text, text, date, text) from public;
revoke all on function public.challenge_rule_count(uuid, text, text, date, text) from anon;
revoke all on function public.challenge_rule_count(uuid, text, text, date, text) from authenticated;

-- ---------------------------------------------------------------------------
-- Completing a day: one function
-- ---------------------------------------------------------------------------

drop function if exists public.complete_challenge_program_day(uuid, text);
drop function if exists public.complete_challenge_program_day(uuid, text, uuid);

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
  v_existing_day integer;
  v_last_completed date;
  v_available_from date;
  v_rule_type text;
  v_rule_target integer;
  v_rule_param text;
  v_entry_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_timezone := coalesce(v_timezone, 'Europe/Berlin');
  v_today := (now() at time zone v_timezone)::date;
  completion_date := v_today;

  select enrollment.template_id, enrollment.start_date, template.schedule_mode,
         template.duration_days, template.xp_reward, template.coin_reward, template.title
  into v_template_id, v_start_date, v_mode, total_days, v_xp_reward, v_coin_reward, v_title
  from public.challenge_enrollments enrollment
  join public.challenge_templates template on template.id = enrollment.template_id
  where enrollment.id = p_enrollment_id and enrollment.user_id = v_user_id and enrollment.status = 'active'
  for update of enrollment;
  if not found then raise exception 'Active challenge enrollment not found'; end if;

  select progress.day_number into v_existing_day
  from public.challenge_day_progress progress
  where progress.enrollment_id = p_enrollment_id and progress.completed_on = v_today;
  if v_existing_day is not null then
    completed_day := v_existing_day;
    select count(*)::integer into completed_days from public.challenge_day_progress where enrollment_id = p_enrollment_id;
    challenge_completed := completed_days >= total_days;
    select coalesce(profiles.total_xp, 0) into total_xp from public.profiles where id = v_user_id;
    select coalesce(city_states.coins, 0) into coins from public.city_states where user_id = v_user_id;
    total_xp := coalesce(total_xp, 0);
    coins := coalesce(coins, 0);
    return next;
    return;
  end if;

  select count(*)::integer, max(completed_on) into completed_days, v_last_completed
  from public.challenge_day_progress where enrollment_id = p_enrollment_id;
  completed_day := completed_days + 1;

  if v_mode = 'strict' and v_today <> v_start_date + completed_days then
    raise exception 'The strict challenge streak has been broken';
  end if;
  if completed_day > total_days then raise exception 'Challenge is already complete'; end if;

  select id, completion_type, completion_target, completion_param
  into v_day_id, v_rule_type, v_rule_target, v_rule_param
  from public.challenge_days
  where template_id = v_template_id and day_number = completed_day;
  if v_day_id is null then raise exception 'The next challenge day is missing'; end if;

  v_available_from := coalesce(v_last_completed + 1, v_start_date);

  if v_rule_type = 'reflection' then
    -- The given entry, or else the oldest qualifying one. Security definer
    -- bypasses RLS, so ownership is part of the match.
    select je.id into v_entry_id
    from public.journal_entries je
    where je.user_id = v_user_id
      and (p_journal_entry_id is null or je.id = p_journal_entry_id)
      and je.is_complete
      and je.template_id = 'afc4f953-3ad1-432f-abd4-acab80f82e68'
      and je.entry_date >= v_available_from
      and exists (
        select 1 from public.journal_responses r
        where r.entry_id = je.id
          and r.field_id = '2442e79d-08eb-4b47-9893-17ef24580b71'
          and length(trim(coalesce(r.value_text, ''))) > 0
      )
      and not exists (select 1 from public.challenge_day_progress p where p.journal_entry_id = je.id)
    order by je.created_at
    limit 1;
    if v_entry_id is null then
      raise exception 'Write today''s reflection to complete this day';
    end if;
  elsif p_journal_entry_id is not null then
    raise exception 'This challenge day is not completed by a reflection';
  elsif v_rule_type <> 'manual' then
    if public.challenge_rule_count(v_user_id, v_rule_type, v_rule_param, v_available_from, v_timezone) < v_rule_target then
      raise exception 'Today''s challenge action is not done yet';
    end if;
  end if;

  insert into public.challenge_day_progress (
    enrollment_id, challenge_day_id, user_id, day_number, completed_on, note, journal_entry_id
  ) values (
    p_enrollment_id, v_day_id, v_user_id, completed_day, v_today, nullif(trim(p_note), ''), v_entry_id
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

-- ---------------------------------------------------------------------------
-- Sync: same behaviour, now calling the one completion function
-- ---------------------------------------------------------------------------

create or replace function public.sync_challenge_progress()
returns table(
  enrollment_id uuid,
  day_number integer,
  completion_type text,
  progress integer,
  target integer,
  met boolean,
  available_from date,
  completed_now boolean,
  challenge_completed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_row record;
  v_completed integer;
  v_last date;
  v_day record;
  v_result record;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_timezone := coalesce(v_timezone, 'Europe/Berlin');
  v_today := (now() at time zone v_timezone)::date;

  for v_row in
    select e.id, e.template_id, e.start_date, t.duration_days, t.schedule_mode
    from public.challenge_enrollments e
    join public.challenge_templates t on t.id = e.template_id
    where e.user_id = v_user_id and e.status = 'active'
    order by e.created_at
  loop
    select count(*)::integer, max(p.completed_on) into v_completed, v_last
    from public.challenge_day_progress p
    where p.enrollment_id = v_row.id;

    if v_completed >= v_row.duration_days then
      continue;
    end if;

    select d.day_number, d.completion_type, d.completion_target, d.completion_param
    into v_day
    from public.challenge_days d
    where d.template_id = v_row.template_id and d.day_number = v_completed + 1;
    if not found then continue; end if;

    enrollment_id := v_row.id;
    day_number := v_day.day_number;
    completion_type := v_day.completion_type;
    target := v_day.completion_target;
    available_from := coalesce(v_last + 1, v_row.start_date);
    completed_now := false;
    challenge_completed := false;

    if v_day.completion_type = 'manual' then
      progress := 0;
      met := false;
    else
      progress := public.challenge_rule_count(
        v_user_id, v_day.completion_type, v_day.completion_param, available_from, v_timezone
      );
      met := progress >= target;
    end if;

    if met
      and v_today >= available_from
      and not (v_row.schedule_mode = 'strict' and v_today <> v_row.start_date + v_completed)
    then
      begin
        select * into v_result from public.complete_challenge_program_day(v_row.id, null, null);
        completed_now := true;
        challenge_completed := coalesce(v_result.challenge_completed, false);
      exception when others then
        -- A lost race (completed from another tab) is not an error for a sync.
        completed_now := false;
      end;
    end if;

    return next;
  end loop;
end;
$$;

revoke all on function public.sync_challenge_progress() from public;
revoke all on function public.sync_challenge_progress() from anon;
grant execute on function public.sync_challenge_progress() to authenticated;

-- ---------------------------------------------------------------------------
-- Leaving a challenge (engine; recreated so a fresh database has it too)
-- ---------------------------------------------------------------------------

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

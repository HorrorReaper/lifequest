-- Challenge programs, second iteration.
--
-- What changes:
--
-- 1. Each day carries a completion rule. `manual` keeps the old "tick it off"
--    behaviour; every other type is detected from what the user actually did
--    in the app (habits created, a journal entry written, a day planned ...).
--    Rules are data, so an admin can build a new auto-detected challenge in
--    /admin/challenges without a deploy. A day may also carry a deep link to
--    the screen where the action happens.
-- 2. Rules are evaluated here, in SQL, never trusted from the client:
--    complete_challenge_program_day refuses an automatic day whose rule is
--    not met, and sync_challenge_progress completes the ones that are.
-- 3. A template may carry a slug. A published template with a slug gets a
--    public landing page at /challenge/<slug>, read through
--    get_public_challenge, which is the only thing `anon` may call.
-- 4. A template with participants can still be edited (texts, rules, links,
--    rewards); only its number of days is frozen, because progress rows point
--    at day rows.
--
-- Activity rules count what happened from the day the challenge day became
-- available: the start date for day 1, and the calendar day after the
-- previous completion for every later day. The two "*_active" rules instead
-- look at current state ("you have at least 3 habits"), so someone who set
-- them up before joining is not asked to do it twice.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.challenge_templates
  add column if not exists slug text,
  add column if not exists tagline text;

alter table public.challenge_templates
  drop constraint if exists challenge_templates_slug_check,
  drop constraint if exists challenge_templates_tagline_check;

alter table public.challenge_templates
  add constraint challenge_templates_slug_check
    check (
      slug is null
      or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80)
    ),
  add constraint challenge_templates_tagline_check
    check (tagline is null or char_length(trim(tagline)) <= 200);

create unique index if not exists challenge_templates_slug_idx
  on public.challenge_templates (slug)
  where slug is not null;

alter table public.challenge_days
  add column if not exists completion_type text not null default 'manual',
  add column if not exists completion_target integer not null default 1,
  add column if not exists completion_param text,
  add column if not exists action_href text,
  add column if not exists action_label text;

alter table public.challenge_days
  drop constraint if exists challenge_days_completion_type_check,
  drop constraint if exists challenge_days_completion_target_check,
  drop constraint if exists challenge_days_completion_param_check,
  drop constraint if exists challenge_days_action_href_check,
  drop constraint if exists challenge_days_action_label_check;

-- Keep this list in step with CHALLENGE_RULES in src/lib/challenge-rules.ts.
alter table public.challenge_days
  add constraint challenge_days_completion_type_check
    check (completion_type in (
      'manual',
      'habits_active',
      'habit_checkins',
      'journal_entries',
      'day_plans',
      'tasks_created',
      'tasks_completed',
      'goals_active',
      'learnings_captured',
      'tool_entries'
    )),
  add constraint challenge_days_completion_target_check
    check (completion_target between 1 and 100),
  add constraint challenge_days_completion_param_check
    check (
      (completion_param is null or char_length(completion_param) between 1 and 64)
      and (completion_type <> 'tool_entries' or completion_param is not null)
    ),
  -- Same-origin paths only: a day's button must never become an open redirect.
  add constraint challenge_days_action_href_check
    check (
      action_href is null
      or (
        char_length(action_href) between 1 and 200
        and action_href ~ '^/'
        and action_href !~ '^//'
        and action_href !~ '^/\\'
      )
    ),
  add constraint challenge_days_action_label_check
    check (action_label is null or char_length(trim(action_label)) between 1 and 40);

-- ---------------------------------------------------------------------------
-- Rule evaluation
-- ---------------------------------------------------------------------------

-- Internal: how far a user is towards a rule. Security definer because it
-- reads several users' tables in one place; execute is revoked from every
-- client role below, so only the definer functions in this file call it.
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
        and (te.created_at at time zone v_tz)::date >= p_since;

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
-- Starting a challenge
-- ---------------------------------------------------------------------------

-- Was security invoker, which made every start fail with "infinite recursion
-- detected in policy for relation challenge_enrollments": the enrollment
-- insert policy reads challenge_templates, whose select policy reads
-- challenge_enrollments again. As a definer it checks the same things
-- (signed in, template published, own row) explicitly instead.
create or replace function public.start_challenge_program(p_template_id uuid)
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
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;

  select e.id, e.start_date, e.status
  into enrollment_id, start_date, status
  from public.challenge_enrollments e
  where e.template_id = p_template_id and e.user_id = v_user_id and e.status = 'active'
  limit 1;

  if enrollment_id is null then
    insert into public.challenge_enrollments (template_id, user_id, start_date)
    values (p_template_id, v_user_id, v_today)
    returning id, challenge_enrollments.start_date, challenge_enrollments.status
    into enrollment_id, start_date, status;
  end if;
  return next;
end;
$$;

revoke all on function public.start_challenge_program(uuid) from public;
revoke all on function public.start_challenge_program(uuid) from anon;
grant execute on function public.start_challenge_program(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Completing a day
-- ---------------------------------------------------------------------------

-- Same signature and result as before, so existing callers keep working. New:
-- an automatic day is only accepted once its rule is met.
create or replace function public.complete_challenge_program_day(p_enrollment_id uuid, p_note text default null)
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

  if v_rule_type <> 'manual' then
    v_available_from := coalesce(v_last_completed + 1, v_start_date);
    if public.challenge_rule_count(v_user_id, v_rule_type, v_rule_param, v_available_from, v_timezone) < v_rule_target then
      raise exception 'Today''s challenge action is not done yet';
    end if;
  end if;

  insert into public.challenge_day_progress (
    enrollment_id, challenge_day_id, user_id, day_number, completed_on, note
  ) values (
    p_enrollment_id, v_day_id, v_user_id, completed_day, v_today, nullif(trim(p_note), '')
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

revoke all on function public.complete_challenge_program_day(uuid, text) from public;
revoke all on function public.complete_challenge_program_day(uuid, text) from anon;
grant execute on function public.complete_challenge_program_day(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Syncing automatic days
-- ---------------------------------------------------------------------------

-- Called when a challenge surface loads. For every active enrollment of the
-- caller it reports where the current day stands and, when an automatic day's
-- rule is met, completes it. Still at most one day per calendar day.
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
        select * into v_result from public.complete_challenge_program_day(v_row.id, null);
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
-- Public landing page
-- ---------------------------------------------------------------------------

-- The only challenge data readable without an account: what a landing page
-- needs to sell the challenge. Day instructions stay behind the login.
create or replace function public.get_public_challenge(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'slug', t.slug,
    'title', t.title,
    'tagline', t.tagline,
    'description', t.description,
    'duration_days', t.duration_days,
    'schedule_mode', t.schedule_mode,
    'xp_reward', t.xp_reward,
    'coin_reward', t.coin_reward,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day_number', d.day_number, 'title', d.title, 'automatic', d.completion_type <> 'manual') order by d.day_number)
      from public.challenge_days d
      where d.template_id = t.id
    ), '[]'::jsonb)
  )
  from public.challenge_templates t
  where t.slug = lower(trim(p_slug)) and t.is_published
  limit 1;
$$;

revoke all on function public.get_public_challenge(text) from public;
grant execute on function public.get_public_challenge(text) to anon;
grant execute on function public.get_public_challenge(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin editor
-- ---------------------------------------------------------------------------

drop function if exists public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb);

create or replace function public.admin_save_challenge_template(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_schedule_mode text,
  p_xp_reward integer,
  p_coin_reward integer,
  p_is_published boolean,
  p_days jsonb,
  p_slug text default null,
  p_tagline text default null
)
returns uuid
language plpgsql
-- Definer so the participant check below sees every user's enrollments; as
-- invoker, RLS limited it to the admin's own and it never fired. The admin
-- test right below is therefore the whole gate.
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid := p_template_id;
  v_day_count integer;
  v_existing_count integer;
  v_has_enrollments boolean := false;
  v_item record;
  v_type text;
  v_param text;
begin
  if v_user_id is null or (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin role required';
  end if;
  if jsonb_typeof(p_days) <> 'array' then raise exception 'Challenge days must be an array'; end if;
  v_day_count := jsonb_array_length(p_days);
  if v_day_count < 1 or v_day_count > 365 then raise exception 'A challenge needs between 1 and 365 days'; end if;
  if p_schedule_mode not in ('sequential', 'strict') then raise exception 'Invalid schedule mode'; end if;

  for v_item in select value from jsonb_array_elements(p_days) as item(value) loop
    v_type := coalesce(nullif(trim(v_item.value ->> 'completion_type'), ''), 'manual');
    v_param := nullif(trim(v_item.value ->> 'completion_param'), '');
    if v_type = 'journal_entries' and v_param is not null
      and v_param !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Journal rule needs a valid template id';
    end if;
    if v_type = 'tool_entries' and v_param is null then
      raise exception 'Tool rule needs a tool';
    end if;
  end loop;

  if v_template_id is null then
    insert into public.challenge_templates (
      created_by, title, description, duration_days, schedule_mode, xp_reward, coin_reward, is_published, slug, tagline
    ) values (
      v_user_id, trim(p_title), nullif(trim(p_description), ''), v_day_count, p_schedule_mode,
      p_xp_reward, p_coin_reward, p_is_published, nullif(lower(trim(p_slug)), ''), nullif(trim(p_tagline), '')
    ) returning id into v_template_id;
  else
    select duration_days into v_existing_count from public.challenge_templates where id = v_template_id;
    if not found then raise exception 'Challenge template not found'; end if;
    v_has_enrollments := exists (select 1 from public.challenge_enrollments where template_id = v_template_id);
    if v_has_enrollments and v_day_count <> v_existing_count then
      raise exception 'This challenge already has participants. You can edit its days, but not add or remove them. Duplicate it to change its length.';
    end if;

    update public.challenge_templates
    set title = trim(p_title),
        description = nullif(trim(p_description), ''),
        duration_days = v_day_count,
        schedule_mode = p_schedule_mode,
        xp_reward = p_xp_reward,
        coin_reward = p_coin_reward,
        is_published = p_is_published,
        slug = nullif(lower(trim(p_slug)), ''),
        tagline = nullif(trim(p_tagline), ''),
        updated_at = now()
    where id = v_template_id;

    delete from public.challenge_days
    where template_id = v_template_id and challenge_days.day_number > v_day_count;
  end if;

  -- Upsert by position so progress rows (which point at day ids) survive an
  -- edit of a challenge people are already doing.
  insert into public.challenge_days (
    template_id, day_number, title, instructions, reflection_prompt,
    completion_type, completion_target, completion_param, action_href, action_label
  )
  select
    v_template_id,
    item.ordinality::integer,
    trim(item.value ->> 'title'),
    trim(item.value ->> 'instructions'),
    nullif(trim(item.value ->> 'reflection_prompt'), ''),
    coalesce(nullif(trim(item.value ->> 'completion_type'), ''), 'manual'),
    greatest(1, least(100, coalesce(nullif(item.value ->> 'completion_target', '')::integer, 1))),
    case
      when coalesce(nullif(trim(item.value ->> 'completion_type'), ''), 'manual') in ('journal_entries', 'tool_entries')
        then nullif(trim(item.value ->> 'completion_param'), '')
      else null
    end,
    nullif(trim(item.value ->> 'action_href'), ''),
    nullif(trim(item.value ->> 'action_label'), '')
  from jsonb_array_elements(p_days) with ordinality as item(value, ordinality)
  on conflict (template_id, day_number) do update
  set title = excluded.title,
      instructions = excluded.instructions,
      reflection_prompt = excluded.reflection_prompt,
      completion_type = excluded.completion_type,
      completion_target = excluded.completion_target,
      completion_param = excluded.completion_param,
      action_href = excluded.action_href,
      action_label = excluded.action_label;

  return v_template_id;
end;
$$;

revoke all on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb, text, text) from public;
revoke all on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb, text, text) from anon;
grant execute on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin visibility
-- ---------------------------------------------------------------------------

-- The editor shows how many people are in a challenge, and warns before an
-- edit that affects them. Read-only; enrollments still change only through
-- the RPCs above.
drop policy if exists "Admins read all challenge enrollments" on public.challenge_enrollments;
create policy "Admins read all challenge enrollments" on public.challenge_enrollments
for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

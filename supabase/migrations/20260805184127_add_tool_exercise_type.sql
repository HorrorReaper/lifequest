-- Lets a lesson embed a self-improvement tool as an exercise.
--
-- Deliberately ONE new exercise type ('tool') that carries a toolId and
-- delegates to TOOL_REGISTRY, rather than one exercise type per tool. Adding
-- an exercise type touches the constraint below, the catalog validation, the
-- submission scoring, and several TypeScript places. Paying that once means
-- every future tool stays at "one component plus one registry entry".
--
-- The two functions below are reproduced in full because plpgsql has no
-- partial replace. They were extracted verbatim from
-- 20260726180730_interactive_learning_paths_backend.sql; the only edits are
-- marked with comments. Future changes to either function must be made
-- against this copy, which is now the newest definition.

alter table public.learning_exercises
  drop constraint if exists learning_exercises_exercise_type_check,
  add constraint learning_exercises_exercise_type_check
    check (exercise_type in ('concept', 'choice', 'scenario', 'order', 'reflection', 'tool'));

create or replace function public.learning_replace_catalog(
  p_catalog jsonb,
  p_actor uuid,
  p_change_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path jsonb;
  v_unit jsonb;
  v_lesson jsonb;
  v_exercise jsonb;
  v_path_id uuid;
  v_version_id uuid;
  v_unit_id uuid;
  v_lesson_id uuid;
  v_path_position bigint;
  v_unit_position bigint;
  v_lesson_position bigint;
  v_exercise_position bigint;
  v_version_number integer;
  v_type text;
  v_content jsonb;
  v_answer_key jsonb;
begin
  if jsonb_typeof(p_catalog) <> 'object'
    or (p_catalog ->> 'version')::integer <> 1
    or jsonb_typeof(p_catalog -> 'paths') <> 'array'
    or jsonb_array_length(p_catalog -> 'paths') <> 3
  then
    raise exception 'Catalog must contain version 1 and exactly three paths';
  end if;

  if (
    select count(distinct path_item ->> 'id')
    from jsonb_array_elements(p_catalog -> 'paths') path_item
    where path_item ->> 'id' in ('social-skills', 'entrepreneurship', 'fitness')
  ) <> 3 then
    raise exception 'Catalog must include social-skills, entrepreneurship, and fitness';
  end if;

  for v_path, v_path_position in
    select value, ordinality - 1
    from jsonb_array_elements(p_catalog -> 'paths') with ordinality
  loop
    if coalesce(trim(v_path ->> 'title'), '') = ''
      or coalesce(trim(v_path ->> 'shortTitle'), '') = ''
      or coalesce(trim(v_path ->> 'description'), '') = ''
      or coalesce(trim(v_path ->> 'outcome'), '') = ''
      or coalesce(trim(v_path ->> 'icon'), '') = ''
      or v_path ->> 'accent' not in ('violet', 'amber', 'emerald')
      or jsonb_typeof(v_path -> 'units') <> 'array'
      or jsonb_array_length(v_path -> 'units') = 0
    then
      raise exception 'Invalid path %', v_path ->> 'id';
    end if;

    insert into public.learning_paths(slug)
    values (v_path ->> 'id')
    on conflict (slug) do update set updated_at = now()
    returning id into v_path_id;

    select id
    into v_version_id
    from public.learning_path_versions
    where path_id = v_path_id and status = 'draft'
    order by version_number desc
    limit 1
    for update;

    if v_version_id is null then
      select coalesce(max(version_number), 0) + 1
      into v_version_number
      from public.learning_path_versions
      where path_id = v_path_id;

      insert into public.learning_path_versions(
        path_id,
        version_number,
        status,
        title,
        short_title,
        description,
        outcome,
        icon,
        accent,
        change_summary,
        created_by
      )
      values (
        v_path_id,
        v_version_number,
        'draft',
        v_path ->> 'title',
        v_path ->> 'shortTitle',
        v_path ->> 'description',
        v_path ->> 'outcome',
        v_path ->> 'icon',
        v_path ->> 'accent',
        nullif(trim(p_change_summary), ''),
        p_actor
      )
      returning id into v_version_id;
    else
      update public.learning_path_versions
      set
        title = v_path ->> 'title',
        short_title = v_path ->> 'shortTitle',
        description = v_path ->> 'description',
        outcome = v_path ->> 'outcome',
        icon = v_path ->> 'icon',
        accent = v_path ->> 'accent',
        change_summary = nullif(trim(p_change_summary), ''),
        updated_at = now()
      where id = v_version_id;

      delete from public.learning_units where path_version_id = v_version_id;
    end if;

    for v_unit, v_unit_position in
      select value, ordinality - 1
      from jsonb_array_elements(v_path -> 'units') with ordinality
    loop
      if coalesce(trim(v_unit ->> 'id'), '') = ''
        or coalesce(trim(v_unit ->> 'title'), '') = ''
        or coalesce(trim(v_unit ->> 'description'), '') = ''
        or jsonb_typeof(v_unit -> 'lessons') <> 'array'
        or jsonb_array_length(v_unit -> 'lessons') = 0
      then
        raise exception 'Invalid unit in path %', v_path ->> 'id';
      end if;

      insert into public.learning_units(path_version_id, slug, title, description, position)
      values (
        v_version_id,
        v_unit ->> 'id',
        v_unit ->> 'title',
        v_unit ->> 'description',
        v_unit_position::integer
      )
      returning id into v_unit_id;

      for v_lesson, v_lesson_position in
        select value, ordinality - 1
        from jsonb_array_elements(v_unit -> 'lessons') with ordinality
      loop
        if coalesce(trim(v_lesson ->> 'id'), '') = ''
          or coalesce(trim(v_lesson ->> 'title'), '') = ''
          or coalesce(trim(v_lesson ->> 'description'), '') = ''
          or coalesce(trim(v_lesson ->> 'icon'), '') = ''
          or v_lesson ->> 'difficulty' not in ('foundation', 'intermediate', 'advanced')
          or coalesce((v_lesson ->> 'estimatedMinutes')::integer, 0) < 1
          or coalesce((v_lesson ->> 'masteryPoints')::integer, -1) < 0
          or jsonb_typeof(v_lesson -> 'exercises') <> 'array'
          or jsonb_array_length(v_lesson -> 'exercises') = 0
        then
          raise exception 'Invalid lesson in unit %', v_unit ->> 'id';
        end if;

        insert into public.learning_lessons(
          path_version_id,
          unit_id,
          slug,
          title,
          description,
          icon,
          difficulty,
          estimated_minutes,
          mastery_points,
          xp_reward,
          coin_reward,
          position
        )
        values (
          v_version_id,
          v_unit_id,
          v_lesson ->> 'id',
          v_lesson ->> 'title',
          v_lesson ->> 'description',
          v_lesson ->> 'icon',
          v_lesson ->> 'difficulty',
          (v_lesson ->> 'estimatedMinutes')::integer,
          (v_lesson ->> 'masteryPoints')::integer,
          greatest(10, least(100, (v_lesson ->> 'masteryPoints')::integer / 2)),
          greatest(5, least(50, (v_lesson ->> 'masteryPoints')::integer / 5)),
          v_lesson_position::integer
        )
        returning id into v_lesson_id;

        for v_exercise, v_exercise_position in
          select value, ordinality - 1
          from jsonb_array_elements(v_lesson -> 'exercises') with ordinality
        loop
          v_type := v_exercise ->> 'type';
          if coalesce(trim(v_exercise ->> 'id'), '') = ''
            or v_type not in ('concept', 'choice', 'scenario', 'order', 'reflection', 'tool')
          then
            raise exception 'Invalid exercise in lesson %', v_lesson ->> 'id';
          end if;

          if v_type = 'tool' then
            -- A tool exercise only points at a registered tool; the tool owns
            -- its own UI and storage. The id is validated for shape here, but
            -- whether it exists is a TypeScript concern (TOOL_REGISTRY), since
            -- the database has no knowledge of the registry.
            if coalesce(trim(v_exercise ->> 'toolId'), '') = '' then
              raise exception 'Tool exercise % is missing toolId', v_exercise ->> 'id';
            end if;
            v_content := v_exercise - 'id' - 'type';
            v_answer_key := '{}'::jsonb;
          elsif v_type in ('choice', 'scenario') then
            if jsonb_typeof(v_exercise -> 'options') <> 'array'
              or jsonb_array_length(v_exercise -> 'options') < 2
              or (v_exercise ->> 'correctIndex')::integer < 0
              or (v_exercise ->> 'correctIndex')::integer >= jsonb_array_length(v_exercise -> 'options')
            then
              raise exception 'Invalid answer key for exercise %', v_exercise ->> 'id';
            end if;
            v_content := v_exercise - 'id' - 'type' - 'correctIndex';
            v_answer_key := jsonb_build_object('correctIndex', (v_exercise ->> 'correctIndex')::integer);
          elsif v_type = 'order' then
            if jsonb_typeof(v_exercise -> 'items') <> 'array'
              or jsonb_array_length(v_exercise -> 'items') < 2
            then
              raise exception 'Invalid order exercise %', v_exercise ->> 'id';
            end if;
            v_content := v_exercise - 'id' - 'type' - 'items';
            v_answer_key := jsonb_build_object('items', v_exercise -> 'items');
          else
            v_content := v_exercise - 'id' - 'type';
            v_answer_key := '{}'::jsonb;
          end if;

          insert into public.learning_exercises(
            lesson_id,
            slug,
            exercise_type,
            position,
            content,
            answer_key
          )
          values (
            v_lesson_id,
            v_exercise ->> 'id',
            v_type,
            v_exercise_position::integer,
            v_content,
            v_answer_key
          );
        end loop;
      end loop;
    end loop;
  end loop;

  return public.learning_build_catalog(p_actor, true, true);
end;
$$;

revoke all on function public.learning_replace_catalog(jsonb, uuid, text) from public, anon, authenticated;

create or replace function public.submit_learning_exercise(
  p_lesson_slug text,
  p_exercise_slug text,
  p_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_lesson public.learning_lessons%rowtype;
  v_exercise public.learning_exercises%rowtype;
  v_path_id uuid;
  v_version_id uuid;
  v_enrollment_id uuid;
  v_attempt_id uuid;
  v_progress_id uuid;
  v_response_number integer;
  v_mistakes integer;
  v_score integer;
  v_is_correct boolean;
  v_completed boolean := false;
  v_rewarded boolean := false;
  v_previous_lesson_id uuid;
  v_explanation text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_response) <> 'object' then
    raise exception 'Response must be a JSON object';
  end if;

  select
    p.id,
    coalesce(en.path_version_id, p.published_version_id)
  into v_path_id, v_version_id
  from public.learning_paths p
  left join public.learning_enrollments en
    on en.path_id = p.id and en.user_id = v_user_id
  join public.learning_path_versions pv
    on pv.id = coalesce(en.path_version_id, p.published_version_id)
  join public.learning_lessons l
    on l.path_version_id = pv.id and l.slug = p_lesson_slug
  limit 1;

  if v_version_id is null then
    raise exception 'Published lesson not found';
  end if;

  select *
  into v_lesson
  from public.learning_lessons
  where path_version_id = v_version_id and slug = p_lesson_slug;

  select *
  into v_exercise
  from public.learning_exercises
  where lesson_id = v_lesson.id and slug = p_exercise_slug;

  if v_exercise.id is null or v_exercise.exercise_type = 'concept' then
    raise exception 'Gradable exercise not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || v_lesson.id::text, 0)
  );

  insert into public.learning_enrollments(user_id, path_id, path_version_id)
  values (v_user_id, v_path_id, v_version_id)
  on conflict (user_id, path_id) do nothing;

  select id
  into v_enrollment_id
  from public.learning_enrollments
  where user_id = v_user_id and path_id = v_path_id;

  select sequenced.previous_lesson_id
  into v_previous_lesson_id
  from (
    select
      l.id,
      lag(l.id) over (order by u.position, l.position) as previous_lesson_id
    from public.learning_lessons l
    join public.learning_units u on u.id = l.unit_id
    where l.path_version_id = v_version_id
  ) sequenced
  where sequenced.id = v_lesson.id;

  if v_previous_lesson_id is not null
    and not exists (
      select 1
      from public.learning_lesson_progress lp
      where lp.user_id = v_user_id
        and lp.lesson_id = v_previous_lesson_id
        and lp.status = 'completed'
    )
  then
    raise exception 'Complete the previous lesson first' using errcode = '42501';
  end if;

  insert into public.learning_lesson_progress(
    user_id,
    enrollment_id,
    lesson_id,
    status,
    attempt_count
  )
  values (v_user_id, v_enrollment_id, v_lesson.id, 'in_progress', 1)
  on conflict (user_id, lesson_id) do update
  set updated_at = now()
  returning id into v_progress_id;

  if exists (
    select 1
    from public.learning_lesson_progress
    where id = v_progress_id and status = 'completed'
  ) then
    v_completed := true;
  end if;

  select id
  into v_attempt_id
  from public.learning_attempts
  where user_id = v_user_id
    and lesson_id = v_lesson.id
    and completed_at is null
  limit 1
  for update;

  if v_attempt_id is null and not v_completed then
    insert into public.learning_attempts(user_id, enrollment_id, lesson_id)
    values (v_user_id, v_enrollment_id, v_lesson.id)
    returning id into v_attempt_id;
  end if;

  if v_exercise.exercise_type in ('choice', 'scenario') then
    v_is_correct :=
      (p_response ->> 'selectedIndex') ~ '^[0-9]+$'
      and (p_response ->> 'selectedIndex')::integer =
        (v_exercise.answer_key ->> 'correctIndex')::integer;
  elsif v_exercise.exercise_type = 'order' then
    v_is_correct :=
      jsonb_typeof(p_response -> 'items') = 'array'
      and p_response -> 'items' = v_exercise.answer_key -> 'items';
  elsif v_exercise.exercise_type = 'tool' then
    -- Verified against stored data rather than trusting the client: the
    -- lesson step counts as done only once the user actually has an entry
    -- for that tool. Unlike the reflection branch below, this cannot be
    -- satisfied by submitting arbitrary text.
    v_is_correct := exists (
      select 1
      from public.tool_entries
      where user_id = v_user_id
        and tool_id = v_exercise.content ->> 'toolId'
    );
  else
    v_is_correct := length(trim(coalesce(p_response ->> 'text', ''))) >= 3;
  end if;

  v_explanation := v_exercise.content ->> 'explanation';

  if not v_completed then
    select coalesce(max(response_number), 0) + 1
    into v_response_number
    from public.learning_exercise_responses
    where attempt_id = v_attempt_id and exercise_id = v_exercise.id;

    insert into public.learning_exercise_responses(
      user_id,
      attempt_id,
      exercise_id,
      response_number,
      response,
      is_correct
    )
    values (
      v_user_id,
      v_attempt_id,
      v_exercise.id,
      v_response_number,
      p_response,
      v_is_correct
    );

    if not v_is_correct then
      update public.learning_attempts
      set mistakes = mistakes + 1
      where id = v_attempt_id;
    end if;

    select mistakes
    into v_mistakes
    from public.learning_attempts
    where id = v_attempt_id;

    select not exists (
      select 1
      from public.learning_exercises required
      where required.lesson_id = v_lesson.id
        and required.exercise_type <> 'concept'
        and not exists (
          select 1
          from public.learning_exercise_responses response
          where response.attempt_id = v_attempt_id
            and response.exercise_id = required.id
            and response.is_correct
        )
    )
    into v_completed;

    if v_completed then
      v_score := greatest(60, 100 - v_mistakes * 10);

      update public.learning_attempts
      set score = v_score, completed_at = now()
      where id = v_attempt_id;

      update public.learning_lesson_progress
      set
        status = 'completed',
        best_score = greatest(best_score, v_score),
        best_mistakes = case
          when completed_at is null then v_mistakes
          else least(best_mistakes, v_mistakes)
        end,
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
      where id = v_progress_id
        and status <> 'completed'
      returning true into v_rewarded;

      if coalesce(v_rewarded, false) then
        update public.profiles
        set total_xp = coalesce(total_xp, 0) + v_lesson.xp_reward
        where id = v_user_id;

        update public.city_states
        set coins = coins + v_lesson.coin_reward
        where user_id = v_user_id;

        insert into public.xp_events(
          user_id,
          source_type,
          source_id,
          xp_amount,
          description
        )
        values (
          v_user_id,
          'learning_path_lesson',
          v_lesson.id,
          v_lesson.xp_reward,
          'Completed learning lesson: ' || v_lesson.title
        );
      end if;

      if not exists (
        select 1
        from public.learning_lessons remaining
        where remaining.path_version_id = v_version_id
          and not exists (
            select 1
            from public.learning_lesson_progress completed_progress
            where completed_progress.user_id = v_user_id
              and completed_progress.lesson_id = remaining.id
              and completed_progress.status = 'completed'
          )
      ) then
        update public.learning_enrollments
        set completed_at = coalesce(completed_at, now())
        where id = v_enrollment_id;
      end if;
    end if;
  else
    select best_mistakes, best_score
    into v_mistakes, v_score
    from public.learning_lesson_progress
    where id = v_progress_id;
  end if;

  return jsonb_build_object(
    'correct', v_is_correct,
    'explanation', v_explanation,
    'completed', v_completed,
    'rewarded', coalesce(v_rewarded, false),
    'mistakes', coalesce(v_mistakes, 0),
    'score', case when v_completed then coalesce(v_score, greatest(60, 100 - coalesce(v_mistakes, 0) * 10)) else null end,
    'masteryPoints', v_lesson.mastery_points,
    'xpAwarded', case when coalesce(v_rewarded, false) then v_lesson.xp_reward else 0 end,
    'coinsAwarded', case when coalesce(v_rewarded, false) then v_lesson.coin_reward else 0 end
  );
end;
$$;

revoke all on function public.submit_learning_exercise(text, text, jsonb) from public, anon;
grant execute on function public.submit_learning_exercise(text, text, jsonb) to authenticated;

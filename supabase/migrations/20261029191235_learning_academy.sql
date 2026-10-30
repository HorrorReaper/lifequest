-- Admin Academy: optional personal course and protected learner RPCs.
-- No curriculum is seeded or published by this migration.
-- Visual blocks, perspectives and practice duration are retained in exercise content JSON.

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
    or jsonb_array_length(p_catalog -> 'paths') not between 3 and 4
  then
    raise exception 'Catalog must contain version 1 and three or four paths';
  end if;

  if (
    select count(distinct path_item ->> 'id')
    from jsonb_array_elements(p_catalog -> 'paths') path_item
    where path_item ->> 'id' in ('social-skills', 'entrepreneurship', 'fitness')
  ) <> 3 then
    raise exception 'Catalog must include social-skills, entrepreneurship, and fitness';
  end if;

  if (
    select count(distinct path_item ->> 'id')
    from jsonb_array_elements(p_catalog -> 'paths') path_item
    where path_item ->> 'id' in ('social-skills', 'entrepreneurship', 'fitness', 'entrepreneurial-information-systems')
  ) <> jsonb_array_length(p_catalog -> 'paths') then
    raise exception 'Unknown or duplicate learning path';
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
          or not exists (select 1 from jsonb_array_elements(v_lesson -> 'exercises') e where e ->> 'type' <> 'concept')
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

-- Preserve the scoring/versioning implementation behind a checked, admin-only API.
alter function public.get_published_learning_catalog() rename to learning_internal_get_published_learning_catalog;
revoke all on function public.learning_internal_get_published_learning_catalog() from public, anon, authenticated;
create function public.get_published_learning_catalog()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin'
  then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return public.learning_internal_get_published_learning_catalog();
end;
$$;
revoke all on function public.get_published_learning_catalog() from public, anon;
grant execute on function public.get_published_learning_catalog() to authenticated;

-- Preserve the scoring/versioning implementation behind a checked, admin-only API.
alter function public.get_learning_progress() rename to learning_internal_get_learning_progress;
revoke all on function public.learning_internal_get_learning_progress() from public, anon, authenticated;
create function public.get_learning_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin'
  then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return public.learning_internal_get_learning_progress();
end;
$$;
revoke all on function public.get_learning_progress() from public, anon;
grant execute on function public.get_learning_progress() to authenticated;

-- Preserve the scoring/versioning implementation behind a checked, admin-only API.
alter function public.submit_learning_exercise(text, text, jsonb) rename to learning_internal_submit_learning_exercise;
revoke all on function public.learning_internal_submit_learning_exercise(text, text, jsonb) from public, anon, authenticated;
create function public.submit_learning_exercise(p_lesson_slug text, p_exercise_slug text, p_response jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin'
  then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return public.learning_internal_submit_learning_exercise(p_lesson_slug, p_exercise_slug, p_response);
end;
$$;
revoke all on function public.submit_learning_exercise(text, text, jsonb) from public, anon;
grant execute on function public.submit_learning_exercise(text, text, jsonb) to authenticated;

-- Interactive learning paths backend.
-- Published curriculum is immutable. Learners are pinned to the version on
-- which they start, and answer keys are only exposed to trusted admins.

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learning_path_versions (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title text not null check (length(trim(title)) > 0),
  short_title text not null check (length(trim(short_title)) > 0),
  description text not null check (length(trim(description)) > 0),
  outcome text not null check (length(trim(outcome)) > 0),
  icon text not null check (length(trim(icon)) > 0),
  accent text not null check (accent in ('violet', 'amber', 'emerald')),
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (path_id, version_number)
);

alter table public.learning_paths
  add constraint learning_paths_published_version_id_fkey
  foreign key (published_version_id)
  references public.learning_path_versions(id)
  on delete set null;

create unique index learning_path_versions_one_draft_per_path
  on public.learning_path_versions(path_id)
  where status = 'draft';

create unique index learning_path_versions_one_published_per_path
  on public.learning_path_versions(path_id)
  where status = 'published';

create index learning_path_versions_path_status_idx
  on public.learning_path_versions(path_id, status, version_number desc);

create table public.learning_units (
  id uuid primary key default gen_random_uuid(),
  path_version_id uuid not null references public.learning_path_versions(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) > 0),
  description text not null check (length(trim(description)) > 0),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (path_version_id, slug),
  unique (path_version_id, position)
);

create index learning_units_path_version_position_idx
  on public.learning_units(path_version_id, position);

create table public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  path_version_id uuid not null references public.learning_path_versions(id) on delete cascade,
  unit_id uuid not null references public.learning_units(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) > 0),
  description text not null check (length(trim(description)) > 0),
  icon text not null check (length(trim(icon)) > 0),
  difficulty text not null check (difficulty in ('foundation', 'intermediate', 'advanced')),
  estimated_minutes integer not null check (estimated_minutes between 1 and 180),
  mastery_points integer not null check (mastery_points between 0 and 10000),
  xp_reward integer not null default 50 check (xp_reward between 0 and 10000),
  coin_reward integer not null default 20 check (coin_reward between 0 and 10000),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (path_version_id, slug),
  unique (unit_id, position)
);

create index learning_lessons_version_sequence_idx
  on public.learning_lessons(path_version_id, unit_id, position);

create table public.learning_exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learning_lessons(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  exercise_type text not null check (exercise_type in ('concept', 'choice', 'scenario', 'order', 'reflection')),
  position integer not null check (position >= 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  answer_key jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_key) = 'object'),
  created_at timestamptz not null default now(),
  unique (lesson_id, slug),
  unique (lesson_id, position)
);

create index learning_exercises_lesson_position_idx
  on public.learning_exercises(lesson_id, position);

create table public.learning_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  path_version_id uuid not null references public.learning_path_versions(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, path_id)
);

create index learning_enrollments_user_version_idx
  on public.learning_enrollments(user_id, path_version_id);

create table public.learning_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.learning_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  best_score integer not null default 0 check (best_score between 0 and 100),
  best_mistakes integer not null default 0 check (best_mistakes >= 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index learning_lesson_progress_user_status_idx
  on public.learning_lesson_progress(user_id, status, completed_at desc);

create table public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.learning_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.learning_lessons(id) on delete restrict,
  mistakes integer not null default 0 check (mistakes >= 0),
  score integer check (score between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index learning_attempts_one_active_per_user_lesson
  on public.learning_attempts(user_id, lesson_id)
  where completed_at is null;

create index learning_attempts_user_lesson_idx
  on public.learning_attempts(user_id, lesson_id, started_at desc);

create table public.learning_exercise_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null references public.learning_attempts(id) on delete cascade,
  exercise_id uuid not null references public.learning_exercises(id) on delete restrict,
  response_number integer not null check (response_number > 0),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, exercise_id, response_number)
);

create index learning_exercise_responses_attempt_correct_idx
  on public.learning_exercise_responses(attempt_id, exercise_id, is_correct);

alter table public.learning_paths enable row level security;
alter table public.learning_path_versions enable row level security;
alter table public.learning_units enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.learning_exercises enable row level security;
alter table public.learning_enrollments enable row level security;
alter table public.learning_lesson_progress enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_exercise_responses enable row level security;

create policy "Learners can read own learning enrollments"
  on public.learning_enrollments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Learners can read own lesson progress"
  on public.learning_lesson_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Learners can read own learning attempts"
  on public.learning_attempts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Learners can read own exercise responses"
  on public.learning_exercise_responses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.learning_paths from anon, authenticated;
revoke all on table public.learning_path_versions from anon, authenticated;
revoke all on table public.learning_units from anon, authenticated;
revoke all on table public.learning_lessons from anon, authenticated;
revoke all on table public.learning_exercises from anon, authenticated;
revoke all on table public.learning_enrollments from anon, authenticated;
revoke all on table public.learning_lesson_progress from anon, authenticated;
revoke all on table public.learning_attempts from anon, authenticated;
revoke all on table public.learning_exercise_responses from anon, authenticated;

grant select on table public.learning_enrollments to authenticated;
grant select on table public.learning_lesson_progress to authenticated;
grant select on table public.learning_attempts to authenticated;
grant select on table public.learning_exercise_responses to authenticated;

create or replace function public.learning_build_catalog(
  p_user_id uuid,
  p_include_answers boolean,
  p_admin_drafts boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_versions as (
    select
      p.id as path_id,
      p.slug as path_slug,
      case
        when p_admin_drafts then coalesce(
          (
            select v.id
            from public.learning_path_versions v
            where v.path_id = p.id and v.status = 'draft'
            order by v.version_number desc
            limit 1
          ),
          p.published_version_id
        )
        else coalesce(
          (
            select e.path_version_id
            from public.learning_enrollments e
            where e.user_id = p_user_id and e.path_id = p.id
            limit 1
          ),
          p.published_version_id
        )
      end as version_id
    from public.learning_paths p
  ),
  path_payloads as (
    select
      sv.path_slug,
      jsonb_build_object(
        'id', sv.path_slug,
        'title', v.title,
        'shortTitle', v.short_title,
        'description', v.description,
        'outcome', v.outcome,
        'icon', v.icon,
        'accent', v.accent,
        'units', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', u.slug,
                'title', u.title,
                'description', u.description,
                'lessons', coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', l.slug,
                        'title', l.title,
                        'description', l.description,
                        'icon', l.icon,
                        'difficulty', l.difficulty,
                        'estimatedMinutes', l.estimated_minutes,
                        'masteryPoints', l.mastery_points,
                        'exercises', coalesce(
                          (
                            select jsonb_agg(
                              (
                                e.content
                                || jsonb_build_object('id', e.slug, 'type', e.exercise_type)
                                || case
                                  when p_include_answers and e.exercise_type in ('choice', 'scenario')
                                    then jsonb_build_object('correctIndex', (e.answer_key ->> 'correctIndex')::integer)
                                  when p_include_answers and e.exercise_type = 'order'
                                    then jsonb_build_object('items', e.answer_key -> 'items')
                                  when not p_include_answers and e.exercise_type = 'order'
                                    then jsonb_build_object(
                                      'items',
                                      coalesce(
                                        (
                                          select jsonb_agg(item.value order by item.ordinality desc)
                                          from jsonb_array_elements(e.answer_key -> 'items')
                                            with ordinality as item(value, ordinality)
                                        ),
                                        '[]'::jsonb
                                      )
                                    )
                                  else '{}'::jsonb
                                end
                              )
                              order by e.position
                            )
                            from public.learning_exercises e
                            where e.lesson_id = l.id
                          ),
                          '[]'::jsonb
                        )
                      )
                      order by l.position
                    )
                    from public.learning_lessons l
                    where l.unit_id = u.id
                  ),
                  '[]'::jsonb
                )
              )
              order by u.position
            )
            from public.learning_units u
            where u.path_version_id = v.id
          ),
          '[]'::jsonb
        )
      ) as payload
    from selected_versions sv
    join public.learning_path_versions v on v.id = sv.version_id
  )
  select jsonb_build_object(
    'version',
    1,
    'paths',
    coalesce(
      jsonb_agg(
        payload
        order by case path_slug
          when 'social-skills' then 1
          when 'entrepreneurship' then 2
          when 'fitness' then 3
          else 4
        end
      ),
      '[]'::jsonb
    )
  )
  from path_payloads;
$$;

revoke all on function public.learning_build_catalog(uuid, boolean, boolean) from public, anon, authenticated;

create or replace function public.get_published_learning_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return public.learning_build_catalog(v_user_id, false, false);
end;
$$;

revoke all on function public.get_published_learning_catalog() from public, anon;
grant execute on function public.get_published_learning_catalog() to authenticated;

create or replace function public.get_learning_progress()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then
      jsonb_build_object('version', 1, 'completions', '{}'::jsonb, 'reflections', '{}'::jsonb)
    else
      jsonb_build_object(
        'version',
        1,
        'completions',
        coalesce(
          (
            select jsonb_object_agg(
              l.slug,
              jsonb_build_object(
                'lessonId', l.slug,
                'completedAt', p.completed_at,
                'score', p.best_score,
                'mistakes', p.best_mistakes
              )
            )
            from public.learning_lesson_progress p
            join public.learning_lessons l on l.id = p.lesson_id
            where p.user_id = (select auth.uid())
              and p.status = 'completed'
          ),
          '{}'::jsonb
        ),
        'reflections',
        coalesce(
          (
            select jsonb_object_agg(e.slug, r.response ->> 'text')
            from public.learning_exercise_responses r
            join public.learning_exercises e on e.id = r.exercise_id
            where r.user_id = (select auth.uid())
              and e.exercise_type = 'reflection'
              and r.is_correct
              and r.created_at = (
                select max(r2.created_at)
                from public.learning_exercise_responses r2
                where r2.user_id = r.user_id
                  and r2.exercise_id = r.exercise_id
                  and r2.is_correct
              )
          ),
          '{}'::jsonb
        )
      )
  end;
$$;

revoke all on function public.get_learning_progress() from public, anon;
grant execute on function public.get_learning_progress() to authenticated;

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
            or v_type not in ('concept', 'choice', 'scenario', 'order', 'reflection')
          then
            raise exception 'Invalid exercise in lesson %', v_lesson ->> 'id';
          end if;

          if v_type in ('choice', 'scenario') then
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

create or replace function public.admin_get_learning_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin'
  then
    raise exception 'Trusted admin role required' using errcode = '42501';
  end if;

  return public.learning_build_catalog(v_user_id, true, true);
end;
$$;

revoke all on function public.admin_get_learning_catalog() from public, anon;
grant execute on function public.admin_get_learning_catalog() to authenticated;

create or replace function public.admin_save_learning_catalog(
  p_catalog jsonb,
  p_change_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin'
  then
    raise exception 'Trusted admin role required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lifequest-learning-admin', 0)
  );

  return public.learning_replace_catalog(p_catalog, v_user_id, p_change_summary);
end;
$$;

revoke all on function public.admin_save_learning_catalog(jsonb, text) from public, anon;
grant execute on function public.admin_save_learning_catalog(jsonb, text) to authenticated;

create or replace function public.learning_publish_drafts(
  p_actor uuid,
  p_change_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path record;
  v_draft_id uuid;
begin
  for v_path in
    select id, slug, published_version_id
    from public.learning_paths
    order by slug
    for update
  loop
    select id
    into v_draft_id
    from public.learning_path_versions
    where path_id = v_path.id and status = 'draft'
    limit 1
    for update;

    if v_draft_id is null then
      continue;
    end if;

    if not exists (
      select 1
      from public.learning_units u
      join public.learning_lessons l on l.unit_id = u.id
      join public.learning_exercises e on e.lesson_id = l.id
      where u.path_version_id = v_draft_id
    ) then
      raise exception 'Path % has incomplete curriculum', v_path.slug;
    end if;

    update public.learning_path_versions
    set status = 'archived', updated_at = now()
    where id = v_path.published_version_id;

    update public.learning_path_versions
    set
      status = 'published',
      change_summary = coalesce(nullif(trim(p_change_summary), ''), change_summary),
      published_at = now(),
      updated_at = now()
    where id = v_draft_id;

    update public.learning_paths
    set published_version_id = v_draft_id, updated_at = now()
    where id = v_path.id;
  end loop;

  return public.learning_build_catalog(p_actor, true, true);
end;
$$;

revoke all on function public.learning_publish_drafts(uuid, text) from public, anon, authenticated;

create or replace function public.admin_publish_learning_catalog(
  p_change_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') <> 'admin'
  then
    raise exception 'Trusted admin role required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('lifequest-learning-admin', 0)
  );

  return public.learning_publish_drafts(v_user_id, p_change_summary);
end;
$$;

revoke all on function public.admin_publish_learning_catalog(text) from public, anon;
grant execute on function public.admin_publish_learning_catalog(text) to authenticated;

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

-- The authored v1 catalog is inserted and published in this same migration.
select public.learning_replace_catalog(
  $learning_catalog${"version":1,"paths":[{"id":"social-skills","title":"Social Intelligence","shortTitle":"Social","description":"Build calm confidence, create real connection, and handle everyday social moments with intention.","outcome":"Connect without performing and communicate with clarity.","icon":"🤝","accent":"violet","units":[{"id":"social-presence","title":"Presence before performance","description":"Make people feel safe, seen, and comfortable around you.","lessons":[{"difficulty":"foundation","estimatedMinutes":6,"masteryPoints":100,"id":"social-warm-start","title":"The warm start","description":"Use small signals that make conversation easier for both people.","icon":"👋","exercises":[{"id":"signal-safety","type":"concept","title":"Connection starts before the first sentence","body":"People rapidly scan posture, face, distance, and tone for signs of safety. A relaxed face, brief eye contact, visible hands, and a small smile reduce uncertainty without demanding attention.","takeaway":"Aim to make the next interaction 10% warmer, not to look perfectly confident."},{"id":"warm-signal","type":"choice","prompt":"Which opening signal is most likely to feel welcoming?","options":["Unbroken eye contact","A brief smile and relaxed “hey”","Looking away until they speak","Speaking as loudly as possible"],"correctIndex":1,"explanation":"Warmth is low-pressure. Brief eye contact and a relaxed greeting acknowledge the person without crowding them."},{"id":"elevator-start","type":"scenario","context":"You enter an elevator with a neighbor you have seen twice but never met.","prompt":"What is the strongest first move?","options":["Immediately ask what they do for work","Put in headphones","Smile and say, “Hey, I think we live on the same floor—I’m Patrick.”","Wait for them to earn your attention"],"correctIndex":2,"explanation":"A shared observation plus a simple introduction gives context and makes responding easy."},{"id":"warm-rep","type":"reflection","prompt":"Where could you practice one warm start in the next 24 hours?","placeholder":"Name the person or setting and the exact first sentence you will use."}]},{"difficulty":"foundation","estimatedMinutes":6,"masteryPoints":100,"id":"social-curious-questions","title":"Questions that open people up","description":"Replace interview mode with genuine, useful curiosity.","icon":"❓","exercises":[{"id":"question-funnel","type":"concept","title":"Move from broad to meaningful","body":"Good conversations often follow a gentle funnel: begin with the shared context, ask an open question, then follow the energy in the answer. The goal is not more questions; it is one thread worth exploring.","takeaway":"Listen for energy words—people become more animated around what matters to them."},{"id":"open-question","type":"choice","prompt":"Which question creates the most room for an interesting answer?","options":["Did you like the event?","What has been the most useful idea so far?","Are you from here?","Is your job busy?"],"correctIndex":1,"explanation":"“What” questions invite detail and give the other person control over how much to share."},{"id":"follow-energy","type":"scenario","context":"A colleague says, “The launch was chaotic, but I loved solving the onboarding problem.”","prompt":"What should you ask next?","options":["“Was the launch on Tuesday?”","“How long have you worked here?”","“What made the onboarding problem interesting?”","“Do you like launches?”"],"correctIndex":2,"explanation":"They signaled energy around the onboarding problem. Following that thread shows attention and invites a story."},{"id":"curiosity-plan","type":"reflection","prompt":"Write one open question you can use in a real conversation this week.","placeholder":"Start with “What…”, “How…”, or “Tell me about…”."}]}]},{"id":"social-connection","title":"Create real connection","description":"Listen, respond, and share in a way that builds trust.","lessons":[{"difficulty":"intermediate","estimatedMinutes":6,"masteryPoints":100,"id":"social-listening-loop","title":"The listening loop","description":"Prove you understood before moving the conversation forward.","icon":"👂","exercises":[{"id":"loop-model","type":"concept","title":"Receive, reflect, deepen","body":"A listening loop has three moves: receive the full thought, reflect its meaning in your own words, and deepen with one relevant question. It prevents the common mistake of waiting only for your turn to speak.","takeaway":"Understanding first makes advice, humor, and disagreement land better."},{"id":"loop-order","type":"order","prompt":"Put the listening loop in the strongest order.","items":["Let the person finish","Reflect the meaning you heard","Ask one relevant follow-up"],"explanation":"Receiving before reflecting prevents interruption; reflecting before asking confirms that your follow-up is grounded."},{"id":"friend-stressed","type":"scenario","context":"A friend says, “I keep accepting extra work and now I’m exhausted.”","prompt":"Which response best closes a listening loop?","options":["“You should just say no.”","“Same, my week is worse.”","“It sounds like being dependable is costing you energy. What makes it hard to push back?”","“At least you have a job.”"],"correctIndex":2,"explanation":"The response names the tension without judging it, then asks a question that helps the friend explore it."},{"id":"listening-rep","type":"reflection","prompt":"Who would benefit from you listening without fixing this week?","placeholder":"Write their name and a follow-up question you could ask."}]},{"difficulty":"intermediate","estimatedMinutes":6,"masteryPoints":100,"id":"social-stories","title":"Tell stories people can follow","description":"Turn rambling updates into short, memorable stories.","icon":"🎬","exercises":[{"id":"story-spine","type":"concept","title":"Context, tension, turn","body":"A useful short story needs only three parts: just enough context, the moment something became uncertain, and the turn that changed the outcome. Detail is valuable only when it helps the listener picture the tension.","takeaway":"Start closer to the interesting moment and leave sooner after the point lands."},{"id":"story-order","type":"order","prompt":"Arrange the short-story spine.","items":["Set the minimum context","Name the tension or surprise","Reveal the turn and meaning"],"explanation":"The listener first needs orientation, then a reason to care, then a satisfying change or insight."},{"id":"story-detail","type":"choice","prompt":"Which detail is most worth keeping in a story?","options":["Every person’s full name","The detail that changes how the listener understands the moment","The exact route you drove","All events in chronological order"],"correctIndex":1,"explanation":"Keep details that sharpen the picture, tension, or meaning. Cut details that merely prove the event happened."},{"id":"story-draft","type":"reflection","prompt":"Draft a three-sentence story from your week.","placeholder":"Sentence 1: context. Sentence 2: tension. Sentence 3: turn or lesson."}]}]},{"id":"social-confidence","title":"Confident communication","description":"Express needs and create momentum without becoming forceful.","lessons":[{"difficulty":"advanced","estimatedMinutes":6,"masteryPoints":100,"id":"social-boundaries","title":"Clear boundaries, warm tone","description":"Say no, disagree, and ask for changes without unnecessary friction.","icon":"🧭","exercises":[{"id":"boundary-model","type":"concept","title":"Clarity is kinder than vague resentment","body":"A clean boundary names the situation, states your limit, and offers an alternative only when you genuinely want one. Long defenses invite negotiation and can make a reasonable limit sound uncertain.","takeaway":"Warmth belongs in your tone; clarity belongs in your words."},{"id":"clean-no","type":"choice","prompt":"Which response is the clearest respectful boundary?","options":["“Maybe, I’ll see, things are crazy…”","“No, you always ask too much.”","“I can’t take this on this week. I can review it next Tuesday.”","Say yes and quietly resent it"],"correctIndex":2,"explanation":"It states the limit without blame and offers a specific alternative that can actually be honored."},{"id":"different-opinion","type":"scenario","context":"Your team is rushing toward a decision you think ignores customer evidence.","prompt":"What is the strongest response?","options":["Stay quiet to avoid tension","“This is a terrible idea.”","“I see the speed advantage. I’m concerned the last five interviews point the other way—can we test that assumption first?”","Complain privately afterward"],"correctIndex":2,"explanation":"The response acknowledges the goal, names evidence, and proposes a next step instead of attacking competence."},{"id":"boundary-script","type":"reflection","prompt":"Write one boundary you need to communicate.","placeholder":"Use: “I can’t / I need… What I can do is…”"}]},{"difficulty":"advanced","estimatedMinutes":6,"masteryPoints":100,"id":"social-invitations","title":"Turn rapport into plans","description":"Make invitations that are easy to understand and answer.","icon":"📅","exercises":[{"id":"specific-invite","type":"concept","title":"Specific beats “we should”","body":"Most social momentum dies in vague goodwill. A strong invitation connects to something discussed and includes a concrete activity, time window, and low-pressure way to respond.","takeaway":"Initiative is a gift when the other person can comfortably say yes or no."},{"id":"best-invite","type":"choice","prompt":"Which invitation is easiest to act on?","options":["“We should hang out sometime.”","“Want to grab coffee at North Café next Thursday after work?”","“Let me know whenever.”","“Why don’t people ever make plans?”"],"correctIndex":1,"explanation":"A specific plan reduces coordination work and makes the response simple."},{"id":"follow-up","type":"scenario","context":"Someone liked your invitation but did not confirm a time.","prompt":"What is the best follow-up?","options":["Send five question marks","Assume rejection and disappear","“I’m booking my week—does Thursday at 18:00 work, or should we leave it for another time?”","Accuse them of being flaky"],"correctIndex":2,"explanation":"The message is concrete and gives a graceful exit, protecting both your time and the relationship."},{"id":"invite-plan","type":"reflection","prompt":"Who could you invite to something specific this week?","placeholder":"Write the person, activity, place, and time window."}]}]}]},{"id":"entrepreneurship","title":"Entrepreneurship","shortTitle":"Business","description":"Learn to find painful problems, test demand, sell clearly, and operate with evidence.","outcome":"Move from ideas to validated offers and repeatable execution.","icon":"🚀","accent":"amber","units":[{"id":"business-discovery","title":"Find a problem worth solving","description":"Replace idea attachment with evidence about customers and pain.","lessons":[{"difficulty":"foundation","estimatedMinutes":6,"masteryPoints":100,"id":"business-problem-first","title":"Problem before product","description":"Separate an exciting idea from a valuable customer problem.","icon":"🔎","exercises":[{"id":"pain-evidence","type":"concept","title":"Problems leave evidence","body":"A valuable problem appears in behavior: people spend money, build workarounds, lose time, accept risk, or repeatedly complain. Opinions about an imagined product are weak evidence compared with what people already do.","takeaway":"Look for costly behavior, not compliments about your idea."},{"id":"strong-signal","type":"choice","prompt":"Which is the strongest evidence that a problem matters?","options":["Ten friends say the idea is cool","A prospect already pays for a clumsy workaround","A large market report exists","The logo tests well"],"correctIndex":1,"explanation":"Existing spend or effort shows the customer has already prioritized the problem."},{"id":"idea-praise","type":"scenario","context":"Five interviewees praise your concept, but none can describe when they last faced the problem.","prompt":"What should you conclude?","options":["Demand is validated","The price is too low","The interviews produced weak evidence; investigate real past behavior","Build the full product immediately"],"correctIndex":2,"explanation":"Polite enthusiasm predicts little. Specific recent behavior is much more reliable."},{"id":"problem-hunt","type":"reflection","prompt":"Name one customer group and one costly behavior you want to investigate.","placeholder":"“I want to understand why [customer] currently [behavior/workaround].”"}]},{"difficulty":"foundation","estimatedMinutes":6,"masteryPoints":100,"id":"business-interviews","title":"Customer interviews without bias","description":"Ask about reality without selling the answer you hope to hear.","icon":"🎤","exercises":[{"id":"past-not-future","type":"concept","title":"Ask about the past, not promises","body":"People are poor at predicting hypothetical buying behavior and often try to be encouraging. Ask about the last specific time the problem occurred, what triggered it, what they tried, and what the outcome cost.","takeaway":"A detailed past event beats a confident future promise."},{"id":"interview-question","type":"choice","prompt":"Which interview question is least biased?","options":["Would you pay €20 for my app?","Don’t you hate managing invoices?","Tell me about the last time an invoice was paid late.","Would an AI reminder solve this?"],"correctIndex":2,"explanation":"It asks for a concrete event and does not reveal the answer you want."},{"id":"interview-flow","type":"order","prompt":"Arrange a useful discovery sequence.","items":["Ask for the last specific occurrence","Trace what happened step by step","Explore consequences and current workarounds"],"explanation":"Start concrete, reconstruct behavior, then quantify pain and alternatives."},{"id":"interview-script","type":"reflection","prompt":"Write the first three questions for your next customer interview.","placeholder":"Keep them about past behavior. Avoid pitching your solution."}]}]},{"id":"business-validation","title":"Test value quickly","description":"Design the smallest experiment that can change your decision.","lessons":[{"difficulty":"intermediate","estimatedMinutes":6,"masteryPoints":100,"id":"business-smallest-test","title":"The smallest credible test","description":"Learn before you spend months building.","icon":"🧪","exercises":[{"id":"assumption-map","type":"concept","title":"Test the riskiest assumption first","body":"Every venture rests on assumptions about the customer, pain, channel, willingness to pay, and your ability to deliver. The best first test targets the assumption that could kill the idea and produces behavior you can observe.","takeaway":"An experiment is useful only if different results lead to different decisions."},{"id":"test-choice","type":"choice","prompt":"Before building scheduling software, what is the strongest first demand test?","options":["Choose a database","Offer a manual scheduling service to five target customers for a real price","Design twenty settings screens","Register every social handle"],"correctIndex":1,"explanation":"A paid concierge offer tests pain, willingness to pay, and delivery learning without product infrastructure."},{"id":"landing-page","type":"scenario","context":"One hundred people visit your landing page. Twelve join a waitlist, but nobody accepts a paid pilot.","prompt":"What did you validate?","options":["A scalable business","Some message interest, but not willingness to pay","The final product price","Retention"],"correctIndex":1,"explanation":"A waitlist is a weak intent signal. A paid pilot asks for a meaningful commitment."},{"id":"experiment-card","type":"reflection","prompt":"Define one seven-day validation experiment.","placeholder":"Assumption → test → success threshold → what you will do if it fails."}]},{"difficulty":"intermediate","estimatedMinutes":6,"masteryPoints":100,"id":"business-offer","title":"Build an offer people understand","description":"Connect a specific customer, painful situation, outcome, and proof.","icon":"🎯","exercises":[{"id":"offer-shape","type":"concept","title":"Clarity compresses the decision","body":"A strong offer tells a specific customer what outcome they can expect, how the mechanism differs, what effort or risk is removed, and why they should believe you. Feature lists make customers translate the value themselves.","takeaway":"Describe the progress the customer buys, not the machinery you built."},{"id":"positioning","type":"choice","prompt":"Which statement is the clearest offer?","options":["An AI-powered synergistic platform","We help 10–50 person agencies cut overdue invoices by automating polite follow-up","The future of finance","Software with dashboards and integrations"],"correctIndex":1,"explanation":"It names the customer, costly problem, and mechanism in ordinary language."},{"id":"price-objection","type":"scenario","context":"A prospect says, “That feels expensive.”","prompt":"What should you do first?","options":["Immediately discount 50%","Defend every feature","Ask what they are comparing it with and quantify the current cost of the problem","End the call"],"correctIndex":2,"explanation":"“Expensive” is incomplete information. Understand the comparison and value gap before changing price."},{"id":"offer-draft","type":"reflection","prompt":"Draft your offer in one sentence.","placeholder":"We help [specific customer] achieve [outcome] without [cost/risk] by [mechanism]."}]}]},{"id":"business-execution","title":"Sell and operate","description":"Turn learning into revenue and a repeatable weekly rhythm.","lessons":[{"difficulty":"advanced","estimatedMinutes":6,"masteryPoints":100,"id":"business-sales-conversation","title":"A useful sales conversation","description":"Diagnose before you prescribe and ask clearly for commitment.","icon":"🤝","exercises":[{"id":"sales-diagnosis","type":"concept","title":"Sales is joint diagnosis","body":"A good sales conversation establishes the current situation, desired outcome, obstacles, cost of inaction, decision process, and fit. A demo matters only after both sides understand what needs to change.","takeaway":"Do not present every feature; connect the few relevant capabilities to diagnosed pain."},{"id":"sales-flow","type":"order","prompt":"Arrange the core sales flow.","items":["Understand the current situation and pain","Clarify desired outcome and decision constraints","Recommend the relevant solution and agree on a next step"],"explanation":"Diagnosis creates the context that makes a recommendation credible."},{"id":"vague-next-step","type":"scenario","context":"The prospect says, “Send me something and I’ll think about it.”","prompt":"What is the strongest response?","options":["“Sure” and hope","“No.”","“Happy to. What question should the material answer, and shall we review it together Friday?”","Send a 60-page deck"],"correctIndex":2,"explanation":"It uncovers the real concern and turns a vague promise into a mutual next step."},{"id":"sales-question","type":"reflection","prompt":"What question are you currently avoiding in a sales conversation?","placeholder":"Write the direct, respectful version you will ask next time."}]},{"difficulty":"advanced","estimatedMinutes":6,"masteryPoints":100,"id":"business-operating-cadence","title":"The founder operating cadence","description":"Use a weekly evidence loop instead of reacting to noise.","icon":"📈","exercises":[{"id":"weekly-loop","type":"concept","title":"Focus, evidence, decision","body":"A useful operating week starts with one bottleneck, commits to a small set of leading actions, reviews evidence at a fixed time, and records decisions. Metrics without decisions become theater; activity without a bottleneck becomes busyness.","takeaway":"Pick the constraint that most limits customer value or growth, then align the week around it."},{"id":"leading-metric","type":"choice","prompt":"If the bottleneck is too few qualified conversations, which is the best weekly leading metric?","options":["Total lifetime revenue","Number of targeted outreach messages and booked conversations","Website font size","Company valuation"],"correctIndex":1,"explanation":"It measures controllable actions close to the bottleneck and can change within the week."},{"id":"too-many-priorities","type":"scenario","context":"Your team has twelve “top priorities” this week.","prompt":"What is the best operator move?","options":["Work longer on all twelve","Choose the bottleneck, define one outcome, and explicitly defer lower-leverage work","Add more dashboards","Avoid making a choice"],"correctIndex":1,"explanation":"Strategy requires tradeoffs. A visible not-now list protects the work that matters most."},{"id":"weekly-scorecard","type":"reflection","prompt":"Design your next weekly founder scorecard.","placeholder":"One bottleneck, one outcome, three leading actions, one review time."}]}]}]},{"id":"fitness","title":"Strength & Fitness","shortTitle":"Fitness","description":"Train with sound principles, recover deliberately, and build a body through sustainable progression.","outcome":"Make confident training decisions without chasing noise.","icon":"💪","accent":"emerald","units":[{"id":"fitness-training","title":"Train for adaptation","description":"Understand the signals that make strength and muscle grow.","lessons":[{"difficulty":"foundation","estimatedMinutes":6,"masteryPoints":100,"id":"fitness-progressive-overload","title":"Progressive overload","description":"Create a measurable reason for your body to adapt.","icon":"📊","exercises":[{"id":"overload-model","type":"concept","title":"Progress is more than adding weight","body":"Progressive overload means increasing the training challenge over time while preserving the target movement and useful technique. Load, repetitions, range of motion, control, and total hard sets can all progress.","takeaway":"Compare similar work. A heavier sloppy rep is not automatically better stimulus."},{"id":"progress-example","type":"choice","prompt":"Which is the clearest example of useful overload?","options":["Bench 70 kg for 8 clean reps after doing 7 last week","Add 20 kg and halve the range of motion","Change every exercise weekly","Train until exhausted every day"],"correctIndex":0,"explanation":"One additional clean rep at the same load and technique is measurable progress."},{"id":"stalled-load","type":"scenario","context":"You cannot add weight to an exercise this week, but your technique and recovery are good.","prompt":"What is a sensible next progression?","options":["Quit the program","Add one controlled rep within the target range","Double all sets immediately","Use momentum to move the load"],"correctIndex":1,"explanation":"Rep progression is a small, trackable increase that preserves exercise quality."},{"id":"overload-target","type":"reflection","prompt":"Choose one lift and define its next smallest progression.","placeholder":"Exercise, current load/reps, and the next target."}]},{"difficulty":"foundation","estimatedMinutes":6,"masteryPoints":100,"id":"fitness-effort-technique","title":"Hard sets with stable technique","description":"Balance effort, proximity to failure, and repeatable execution.","icon":"🎚️","exercises":[{"id":"rir-model","type":"concept","title":"Effort needs a reference","body":"Reps in reserve (RIR) estimates how many clean repetitions remained before technical failure. Many productive hypertrophy sets finish around 0–3 RIR, but the right effort depends on exercise safety, skill, fatigue, and program design.","takeaway":"A hard set should challenge the target muscle without turning into a different movement."},{"id":"rir-check","type":"choice","prompt":"You finish a set and could perform two more clean reps. What is the estimate?","options":["0 RIR","1 RIR","2 RIR","5 RIR"],"correctIndex":2,"explanation":"RIR counts the clean repetitions you believe remained."},{"id":"form-breakdown","type":"scenario","context":"During curls, your torso swing increases and the elbow position changes to finish more reps.","prompt":"What is the best interpretation?","options":["The target muscle received perfect overload","The set has reached technical failure for the intended execution","Technique never matters","Add more weight immediately"],"correctIndex":1,"explanation":"When the agreed technique breaks, the target movement has ended even if the weight still moves."},{"id":"technique-standard","type":"reflection","prompt":"Define one non-negotiable technique standard for a key exercise.","placeholder":"Example: full controlled depth, stable torso, or a one-second pause."}]}]},{"id":"fitness-recovery","title":"Fuel and recover","description":"Support training with practical nutrition and sleep decisions.","lessons":[{"difficulty":"intermediate","estimatedMinutes":6,"masteryPoints":100,"id":"fitness-protein-energy","title":"Protein and energy balance","description":"Build a simple nutrition base for muscle gain or fat loss.","icon":"🥗","exercises":[{"id":"nutrition-hierarchy","type":"concept","title":"Start with the large levers","body":"Body-weight direction is primarily influenced by sustained energy balance, while adequate protein supports muscle retention and growth. Food quality, fiber, and micronutrients support health and adherence; timing fine-tunes a sound base.","takeaway":"A repeatable nutrition system beats perfect targets followed for three days."},{"id":"priority","type":"choice","prompt":"For a lifter starting a fat-loss phase, which foundation matters most?","options":["A sustainable calorie deficit with adequate protein","Eliminating all carbohydrates","One exact meal timing window","Buying more supplements"],"correctIndex":0,"explanation":"A manageable deficit drives weight loss while protein and resistance training help preserve lean mass."},{"id":"protein-gap","type":"scenario","context":"You consistently miss your protein target at dinner and then snack randomly.","prompt":"What is the most practical system fix?","options":["Rely on more willpower at night","Add a repeatable protein anchor to breakfast or lunch","Skip breakfast and lunch","Change targets every day"],"correctIndex":1,"explanation":"Moving some protein earlier reduces the size of the evening problem and creates a reliable default."},{"id":"protein-anchor","type":"reflection","prompt":"Choose one repeatable protein anchor for your day.","placeholder":"Food, portion, meal, and approximate protein."}]},{"difficulty":"intermediate","estimatedMinutes":6,"masteryPoints":100,"id":"fitness-sleep-recovery","title":"Recovery is part of training","description":"Use sleep, fatigue signals, and rest to protect adaptation.","icon":"😴","exercises":[{"id":"stress-balance","type":"concept","title":"Training spends recovery capacity","body":"Muscle and strength adaptation happen after the workout. Sleep, nutrition, life stress, and training load draw from the same recovery budget. One bad night is not a crisis; a repeated mismatch between stress and recovery is a programming signal.","takeaway":"Judge recovery by trends in performance, motivation, soreness, sleep, and joint comfort."},{"id":"recovery-signal","type":"choice","prompt":"Which pattern most strongly suggests accumulated fatigue?","options":["One difficult warm-up rep","Several sessions of falling performance plus worse sleep and persistent soreness","Feeling energetic after rest","A single missed meal"],"correctIndex":1,"explanation":"Multiple worsening signals across several sessions are more informative than one noisy data point."},{"id":"bad-night","type":"scenario","context":"You slept poorly once before a normal training day.","prompt":"What is the best first response?","options":["Abandon training for a month","Use the warm-up to assess readiness and adjust load or volume if needed","Attempt a personal record regardless","Double caffeine and ignore technique"],"correctIndex":1,"explanation":"Autoregulation uses current performance evidence without overreacting to one night."},{"id":"shutdown-routine","type":"reflection","prompt":"Design a 20-minute pre-sleep shutdown you could repeat.","placeholder":"Time, screens, light, preparation, and one calming action."}]}]},{"id":"fitness-programming","title":"Program for the long game","description":"Organize training and respond intelligently when progress slows.","lessons":[{"difficulty":"advanced","estimatedMinutes":6,"masteryPoints":100,"id":"fitness-program-design","title":"A program you can progress","description":"Choose enough structure to learn what is working.","icon":"🗓️","exercises":[{"id":"program-structure","type":"concept","title":"Consistency makes data useful","body":"A useful program repeats key movement patterns long enough to practice technique and compare performance. It distributes weekly volume, manages fatigue, and fits the days you can realistically train. Novelty can be enjoyable, but constant change hides whether you are progressing.","takeaway":"The best split is one you can recover from and execute consistently."},{"id":"program-order","type":"order","prompt":"Arrange the basic programming decisions.","items":["Choose realistic weekly training days","Distribute priority muscle groups and movements","Set progression rules and track comparable work"],"explanation":"Schedule constraints come first, then training distribution, then a clear way to progress."},{"id":"missed-day","type":"scenario","context":"Your four-day plan repeatedly becomes three days because Friday is unpredictable.","prompt":"What is the best adjustment?","options":["Keep failing the same schedule","Build a three-day base that covers priorities, with an optional fourth day","Do all four sessions on Sunday","Stop tracking"],"correctIndex":1,"explanation":"Programming around reality improves consistency and makes the optional work genuinely optional."},{"id":"program-audit","type":"reflection","prompt":"What is the biggest mismatch between your current program and your real week?","placeholder":"Name the conflict and one structural change."}]},{"difficulty":"advanced","estimatedMinutes":6,"masteryPoints":100,"id":"fitness-plateaus","title":"Diagnose a plateau","description":"Respond to stalled progress with evidence instead of random changes.","icon":"🛠️","exercises":[{"id":"plateau-check","type":"concept","title":"A plateau is a diagnosis, not a mood","body":"Before changing a program, confirm that comparable performance has stalled across enough exposures. Then check technique, effort, sleep, nutrition, body-weight trend, pain, and total fatigue. The solution may be more stimulus, better recovery, a technique correction, or a planned deload.","takeaway":"Change one likely constraint at a time so the result teaches you something."},{"id":"plateau-order","type":"order","prompt":"Put the plateau response in the strongest order.","items":["Confirm the stall with comparable logged sessions","Check execution, recovery, nutrition, and pain","Change the smallest likely constraint and reassess"],"explanation":"First establish that a real pattern exists, then diagnose, then intervene."},{"id":"everything-stalled","type":"scenario","context":"Several lifts fall for two weeks, sleep is poor, motivation is low, and joints feel irritated.","prompt":"What is the most reasonable first move?","options":["Add failure sets to every exercise","Consider a short deload and restore recovery before rebuilding","Change every exercise and diet variable","Ignore it indefinitely"],"correctIndex":1,"explanation":"System-wide decline plus recovery symptoms suggests fatigue management before adding more stress."},{"id":"plateau-decision","type":"reflection","prompt":"Write a decision rule for your next plateau.","placeholder":"If [evidence persists], I will check [inputs] and change [smallest variable]."}]}]}]}]}$learning_catalog$::jsonb,
  null,
  'Initial authored curriculum'
);

select public.learning_publish_drafts(null, 'Initial authored curriculum');

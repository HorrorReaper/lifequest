create table public.challenge_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text,
  duration_days integer not null check (duration_days between 1 and 365),
  schedule_mode text not null default 'sequential' check (schedule_mode in ('sequential', 'strict')),
  xp_reward integer not null default 500 check (xp_reward between 0 and 99999),
  coin_reward integer not null default 250 check (coin_reward between 0 and 99999),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.challenge_days (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.challenge_templates(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  title text not null check (char_length(trim(title)) between 1 and 120),
  instructions text not null check (char_length(trim(instructions)) between 1 and 2000),
  reflection_prompt text check (reflection_prompt is null or char_length(trim(reflection_prompt)) <= 500),
  created_at timestamptz not null default now(),
  unique (template_id, day_number)
);

create table public.challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.challenge_templates(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'completed', 'failed', 'abandoned')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index challenge_enrollments_one_active_idx
  on public.challenge_enrollments (template_id, user_id)
  where status = 'active';
create index challenge_enrollments_template_user_idx
  on public.challenge_enrollments (template_id, user_id);
create index challenge_enrollments_user_status_idx
  on public.challenge_enrollments (user_id, status, created_at desc);

create table public.challenge_day_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.challenge_enrollments(id) on delete cascade,
  challenge_day_id uuid not null references public.challenge_days(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 365),
  completed_on date not null,
  note text check (note is null or char_length(trim(note)) <= 2000),
  created_at timestamptz not null default now(),
  unique (enrollment_id, day_number),
  unique (enrollment_id, completed_on)
);

create index challenge_day_progress_user_date_idx
  on public.challenge_day_progress (user_id, completed_on desc);

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 20000),
  tags text[] not null default '{}',
  module text not null default 'general' check (module in ('general', 'productivity', 'workouts', 'nutrition', 'challenges', 'tools')),
  status text not null default 'idea' check (status in ('idea', 'testing', 'validated', 'rejected')),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_notes_user_updated_idx on public.admin_notes (user_id, is_pinned desc, updated_at desc);
create index admin_notes_tags_idx on public.admin_notes using gin (tags);

alter table public.challenge_templates enable row level security;
alter table public.challenge_days enable row level security;
alter table public.challenge_enrollments enable row level security;
alter table public.challenge_day_progress enable row level security;
alter table public.admin_notes enable row level security;

create policy "Published challenges are readable" on public.challenge_templates
for select to authenticated
using (
  is_published
  or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (
    select 1 from public.challenge_enrollments enrollment
    where enrollment.template_id = challenge_templates.id
      and enrollment.user_id = (select auth.uid())
  )
);

create policy "Admins create challenge templates" on public.challenge_templates
for insert to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and created_by = (select auth.uid()));

create policy "Admins update challenge templates" on public.challenge_templates
for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins delete challenge templates" on public.challenge_templates
for delete to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Readable challenge days" on public.challenge_days
for select to authenticated
using (exists (
  select 1 from public.challenge_templates template
  where template.id = challenge_days.template_id
    and (
      template.is_published
      or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      or exists (
        select 1 from public.challenge_enrollments enrollment
        where enrollment.template_id = template.id
          and enrollment.user_id = (select auth.uid())
      )
    )
));

create policy "Admins create challenge days" on public.challenge_days
for insert to authenticated
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins update challenge days" on public.challenge_days
for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins delete challenge days" on public.challenge_days
for delete to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Users read own challenge enrollments" on public.challenge_enrollments
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users start published challenges" on public.challenge_enrollments
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'active'
  and completed_at is null
  and exists (
    select 1 from public.challenge_templates template
    where template.id = challenge_enrollments.template_id and template.is_published
  )
);

create policy "Users read own challenge progress" on public.challenge_day_progress
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Admins manage own notes" on public.admin_notes
for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

grant select, insert, update, delete on public.challenge_templates to authenticated;
grant select, insert, update, delete on public.challenge_days to authenticated;
grant select, insert on public.challenge_enrollments to authenticated;
grant select on public.challenge_day_progress to authenticated;
grant select, insert, update, delete on public.admin_notes to authenticated;

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

  insert into public.challenge_days (template_id, day_number, title, instructions, reflection_prompt)
  select
    v_template_id,
    item.ordinality::integer,
    trim(item.value ->> 'title'),
    trim(item.value ->> 'instructions'),
    nullif(trim(item.value ->> 'reflection_prompt'), '')
  from jsonb_array_elements(p_days) with ordinality as item(value, ordinality);

  return v_template_id;
end;
$$;

revoke all on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb) from public;
revoke all on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb) from anon;
grant execute on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb) to authenticated;

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

revoke all on function public.restart_challenge_program(uuid) from public;
revoke all on function public.restart_challenge_program(uuid) from anon;
grant execute on function public.restart_challenge_program(uuid) to authenticated;

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

  select count(*)::integer into completed_days
  from public.challenge_day_progress where enrollment_id = p_enrollment_id;
  completed_day := completed_days + 1;

  if v_mode = 'strict' and v_today <> v_start_date + completed_days then
    raise exception 'The strict challenge streak has been broken';
  end if;
  if completed_day > total_days then raise exception 'Challenge is already complete'; end if;

  select id into v_day_id from public.challenge_days
  where template_id = v_template_id and day_number = completed_day;
  if v_day_id is null then raise exception 'The next challenge day is missing'; end if;

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

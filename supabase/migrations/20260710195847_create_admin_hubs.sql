create table public.productivity_daily_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  priority_date date not null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order between 0 and 99),
  created_at timestamptz not null default now(),
  unique (user_id, priority_date, task_id),
  unique (user_id, priority_date, sort_order)
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  planned_minutes integer not null check (planned_minutes between 1 and 240),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  actual_seconds integer check (actual_seconds is null or actual_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index focus_sessions_one_active_per_user
  on public.focus_sessions (user_id) where status = 'active';
create index productivity_priorities_user_date_idx
  on public.productivity_daily_priorities (user_id, priority_date, sort_order);
create index focus_sessions_user_started_idx
  on public.focus_sessions (user_id, started_at desc);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  muscle_group text not null default 'other',
  equipment text not null default 'other',
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null default 0,
  target_sets integer not null default 3 check (target_sets between 1 and 20),
  rep_min integer check (rep_min is null or rep_min between 1 and 100),
  rep_max integer check (rep_max is null or rep_max between 1 and 100),
  rest_seconds integer not null default 120 check (rest_seconds between 0 and 1800),
  created_at timestamptz not null default now(),
  unique (template_id, exercise_id)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sort_order integer not null default 0,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, exercise_id)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  set_order integer not null default 0,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'failure')),
  reps integer check (reps is null or reps between 0 and 200),
  weight_kg numeric(7,2) check (weight_kg is null or weight_kg >= 0),
  rir numeric(3,1) check (rir is null or rir between 0 and 10),
  is_complete boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_order)
);

create index exercises_user_active_idx on public.exercises (user_id, is_archived, name);
create index workout_templates_user_order_idx on public.workout_templates (user_id, sort_order, created_at);
create index workout_template_exercises_order_idx on public.workout_template_exercises (template_id, sort_order);
create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create unique index workout_sessions_one_active_per_user
  on public.workout_sessions (user_id) where status = 'active';
create index workout_session_exercises_order_idx on public.workout_session_exercises (session_id, sort_order);
create index workout_sets_order_idx on public.workout_sets (session_exercise_id, set_order);

create table public.nutrition_targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories integer not null default 2500 check (calories between 0 and 20000),
  protein_g numeric(7,2) not null default 180 check (protein_g >= 0),
  carbs_g numeric(7,2) not null default 250 check (carbs_g >= 0),
  fat_g numeric(7,2) not null default 75 check (fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  meal_type text not null default 'other' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  name text not null check (char_length(trim(name)) between 1 and 160),
  calories integer not null default 0 check (calories between 0 and 20000),
  protein_g numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7,2) not null default 0 check (fat_g >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nutrition_entries_user_date_idx on public.nutrition_entries (user_id, entry_date desc, created_at);

alter table public.productivity_daily_priorities enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.nutrition_entries enable row level security;

create policy "Admins manage own productivity priorities" on public.productivity_daily_priorities
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id)
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id);
create policy "Admins manage own focus sessions" on public.focus_sessions
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id)
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id);
create policy "Admins manage own exercises" on public.exercises
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id)
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id);
create policy "Admins manage own workout templates" on public.workout_templates
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id)
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id);
create policy "Admins manage own workout sessions" on public.workout_sessions
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id)
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id);
create policy "Admins manage own nutrition targets" on public.nutrition_targets
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id)
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id);
create policy "Admins manage own nutrition entries" on public.nutrition_entries
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id)
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select auth.uid()) = user_id);

create policy "Admins manage own template exercises" on public.workout_template_exercises
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())
  ))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())
  ));
create policy "Admins manage own session exercises" on public.workout_session_exercises
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())
  ))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())
  ));
create policy "Admins manage own workout sets" on public.workout_sets
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = (select auth.uid())
  ))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.productivity_daily_priorities to authenticated;
grant select, insert, update, delete on public.focus_sessions to authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.workout_templates to authenticated;
grant select, insert, update, delete on public.workout_template_exercises to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.workout_session_exercises to authenticated;
grant select, insert, update, delete on public.workout_sets to authenticated;
grant select, insert, update, delete on public.nutrition_targets to authenticated;
grant select, insert, update, delete on public.nutrition_entries to authenticated;

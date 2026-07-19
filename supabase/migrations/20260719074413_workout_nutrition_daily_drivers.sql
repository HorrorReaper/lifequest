-- Daily-driver workout and nutrition trackers.
-- Additive only: existing exercises, workouts and nutrition entries are preserved.

alter table public.exercises
  alter column user_id drop not null,
  add column if not exists slug text,
  add column if not exists tracking_type text not null default 'weight_reps'
    check (tracking_type in ('weight_reps', 'bodyweight_reps', 'assisted_reps', 'duration', 'distance_duration', 'weight_duration')),
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists instructions text[] not null default '{}',
  add column if not exists aliases text[] not null default '{}',
  add column if not exists is_system boolean not null default false,
  add column if not exists source text not null default 'custom'
    check (source in ('system', 'custom'));

update public.exercises
set slug = lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(id::text, 8)
where slug is null;

alter table public.exercises alter column slug set not null;
create unique index if not exists exercises_system_slug_idx
  on public.exercises (slug) where is_system;
create index if not exists exercises_catalog_filter_idx
  on public.exercises (is_system, is_archived, muscle_group, equipment, tracking_type, name);

create table public.workout_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_rest_seconds integer not null default 120 check (default_rest_seconds between 0 and 1800),
  previous_scope text not null default 'same_template' check (previous_scope in ('same_template', 'any_workout')),
  weight_unit text not null default 'kg' check (weight_unit = 'kg'),
  distance_unit text not null default 'km' check (distance_unit = 'km'),
  timer_sound boolean not null default true,
  timer_vibration boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercise_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  is_favorite boolean not null default false,
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 1800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.workout_template_exercises
  add column if not exists superset_group text,
  add column if not exists notes text;

create table public.workout_template_sets (
  id uuid primary key default gen_random_uuid(),
  template_exercise_id uuid not null references public.workout_template_exercises(id) on delete cascade,
  set_order integer not null default 0 check (set_order between 0 and 49),
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'failure')),
  target_reps integer check (target_reps is null or target_reps between 0 and 999),
  target_weight_kg numeric(8,2) check (target_weight_kg is null or target_weight_kg >= 0),
  target_assistance_kg numeric(8,2) check (target_assistance_kg is null or target_assistance_kg >= 0),
  target_duration_seconds integer check (target_duration_seconds is null or target_duration_seconds >= 0),
  target_distance_meters numeric(10,2) check (target_distance_meters is null or target_distance_meters >= 0),
  target_rir numeric(3,1) check (target_rir is null or target_rir between 0 and 10),
  created_at timestamptz not null default now(),
  unique (template_exercise_id, set_order)
);

insert into public.workout_template_sets (template_exercise_id, set_order, target_reps)
select item.id, generated.set_order, item.rep_min
from public.workout_template_exercises item
cross join lateral generate_series(0, greatest(item.target_sets, 1) - 1) generated(set_order)
on conflict (template_exercise_id, set_order) do nothing;

alter table public.workout_session_exercises
  add column if not exists superset_group text,
  add column if not exists rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 1800),
  add column if not exists notes text;

alter table public.workout_sets
  add column if not exists assistance_kg numeric(8,2) check (assistance_kg is null or assistance_kg >= 0),
  add column if not exists duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists distance_meters numeric(10,2) check (distance_meters is null or distance_meters >= 0);

create index if not exists exercise_preferences_favorites_idx
  on public.exercise_preferences (user_id, is_favorite, updated_at desc);
create index if not exists workout_template_sets_order_idx
  on public.workout_template_sets (template_exercise_id, set_order);

create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'custom' check (source in ('custom', 'usda', 'open_food_facts')),
  external_id text,
  barcode text,
  name text not null check (char_length(trim(name)) between 1 and 200),
  brand text,
  calories_per_100g numeric(9,3) not null default 0 check (calories_per_100g >= 0),
  protein_per_100g numeric(9,3) not null default 0 check (protein_per_100g >= 0),
  carbs_per_100g numeric(9,3) not null default 0 check (carbs_per_100g >= 0),
  fat_per_100g numeric(9,3) not null default 0 check (fat_per_100g >= 0),
  fiber_per_100g numeric(9,3) not null default 0 check (fiber_per_100g >= 0),
  sugar_per_100g numeric(9,3) not null default 0 check (sugar_per_100g >= 0),
  sodium_mg_per_100g numeric(10,3) not null default 0 check (sodium_mg_per_100g >= 0),
  default_serving_grams numeric(9,3) not null default 100 check (default_serving_grams > 0),
  default_serving_label text not null default '100 g',
  source_updated_at timestamptz,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index food_items_external_idx
  on public.food_items (user_id, source, external_id) where external_id is not null;
create index food_items_barcode_idx on public.food_items (user_id, barcode) where barcode is not null;
create index food_items_search_idx on public.food_items (user_id, is_archived, name);

create table public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 100),
  grams numeric(9,3) not null check (grams > 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index food_portions_food_idx on public.food_portions (food_item_id, is_default desc);

create table public.food_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_item_id)
);

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.saved_meals(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete restrict,
  serving_grams numeric(9,3) not null check (serving_grams > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  servings numeric(8,2) not null default 1 check (servings > 0),
  yield_weight_g numeric(10,2) check (yield_weight_g is null or yield_weight_g > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete restrict,
  grams numeric(10,3) not null check (grams > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index saved_meals_user_idx on public.saved_meals (user_id, updated_at desc);
create index saved_meal_items_meal_idx on public.saved_meal_items (saved_meal_id, sort_order);
create index recipes_user_idx on public.recipes (user_id, updated_at desc);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, sort_order);

alter table public.nutrition_targets
  add column if not exists fiber_g numeric(7,2) check (fiber_g is null or fiber_g >= 0),
  add column if not exists sodium_mg numeric(9,2) check (sodium_mg is null or sodium_mg >= 0);

alter table public.nutrition_entries
  add column if not exists entry_kind text not null default 'quick_add'
    check (entry_kind in ('food', 'quick_add', 'saved_meal', 'recipe')),
  add column if not exists food_item_id uuid references public.food_items(id) on delete set null,
  add column if not exists serving_grams numeric(9,3) check (serving_grams is null or serving_grams > 0),
  add column if not exists serving_count numeric(9,3) not null default 1 check (serving_count > 0),
  add column if not exists serving_label text,
  add column if not exists fiber_g numeric(9,3) not null default 0 check (fiber_g >= 0),
  add column if not exists sugar_g numeric(9,3) not null default 0 check (sugar_g >= 0),
  add column if not exists sodium_mg numeric(10,3) not null default 0 check (sodium_mg >= 0),
  add column if not exists source_id uuid,
  add column if not exists source_details jsonb not null default '{}'::jsonb;

create index if not exists nutrition_entries_food_recent_idx
  on public.nutrition_entries (user_id, food_item_id, created_at desc) where food_item_id is not null;

-- Existing exercises are custom; seeded catalog exercises are global and immutable.
update public.exercises set is_system = false, source = 'custom' where user_id is not null;

with exercise_seed(name, muscle_group, equipment, tracking_type) as (
  values
    ('Barbell Bench Press','chest','barbell','weight_reps'),
    ('Paused Barbell Bench Press','chest','barbell','weight_reps'),
    ('Close-Grip Bench Press','triceps','barbell','weight_reps'),
    ('Incline Barbell Bench Press','chest','barbell','weight_reps'),
    ('Decline Barbell Bench Press','chest','barbell','weight_reps'),
    ('Dumbbell Bench Press','chest','dumbbell','weight_reps'),
    ('Incline Dumbbell Press','chest','dumbbell','weight_reps'),
    ('Dumbbell Fly','chest','dumbbell','weight_reps'),
    ('Cable Fly','chest','cable','weight_reps'),
    ('Low-to-High Cable Fly','chest','cable','weight_reps'),
    ('Machine Chest Press','chest','machine','weight_reps'),
    ('Pec Deck','chest','machine','weight_reps'),
    ('Push-Up','chest','bodyweight','bodyweight_reps'),
    ('Weighted Push-Up','chest','bodyweight','bodyweight_reps'),
    ('Dip','chest','bodyweight','bodyweight_reps'),
    ('Weighted Dip','chest','bodyweight','bodyweight_reps'),
    ('Assisted Dip','chest','machine','assisted_reps'),
    ('Barbell Deadlift','back','barbell','weight_reps'),
    ('Sumo Deadlift','back','barbell','weight_reps'),
    ('Rack Pull','back','barbell','weight_reps'),
    ('Barbell Row','back','barbell','weight_reps'),
    ('Pendlay Row','back','barbell','weight_reps'),
    ('T-Bar Row','back','machine','weight_reps'),
    ('Dumbbell Row','back','dumbbell','weight_reps'),
    ('Chest-Supported Dumbbell Row','back','dumbbell','weight_reps'),
    ('Seated Cable Row','back','cable','weight_reps'),
    ('Wide-Grip Cable Row','back','cable','weight_reps'),
    ('Lat Pulldown','back','cable','weight_reps'),
    ('Neutral-Grip Pulldown','back','cable','weight_reps'),
    ('Straight-Arm Pulldown','back','cable','weight_reps'),
    ('Machine High Row','back','machine','weight_reps'),
    ('Machine Low Row','back','machine','weight_reps'),
    ('Pull-Up','back','bodyweight','bodyweight_reps'),
    ('Chin-Up','back','bodyweight','bodyweight_reps'),
    ('Weighted Pull-Up','back','bodyweight','bodyweight_reps'),
    ('Assisted Pull-Up','back','machine','assisted_reps'),
    ('Back Extension','lower back','bodyweight','bodyweight_reps'),
    ('Barbell Overhead Press','shoulders','barbell','weight_reps'),
    ('Seated Barbell Press','shoulders','barbell','weight_reps'),
    ('Dumbbell Shoulder Press','shoulders','dumbbell','weight_reps'),
    ('Arnold Press','shoulders','dumbbell','weight_reps'),
    ('Machine Shoulder Press','shoulders','machine','weight_reps'),
    ('Dumbbell Lateral Raise','shoulders','dumbbell','weight_reps'),
    ('Cable Lateral Raise','shoulders','cable','weight_reps'),
    ('Machine Lateral Raise','shoulders','machine','weight_reps'),
    ('Dumbbell Front Raise','shoulders','dumbbell','weight_reps'),
    ('Rear Delt Fly','shoulders','dumbbell','weight_reps'),
    ('Reverse Pec Deck','shoulders','machine','weight_reps'),
    ('Face Pull','shoulders','cable','weight_reps'),
    ('Upright Row','shoulders','barbell','weight_reps'),
    ('Dumbbell Shrug','traps','dumbbell','weight_reps'),
    ('Barbell Shrug','traps','barbell','weight_reps'),
    ('Barbell Curl','biceps','barbell','weight_reps'),
    ('EZ-Bar Curl','biceps','barbell','weight_reps'),
    ('Dumbbell Curl','biceps','dumbbell','weight_reps'),
    ('Incline Dumbbell Curl','biceps','dumbbell','weight_reps'),
    ('Hammer Curl','biceps','dumbbell','weight_reps'),
    ('Preacher Curl','biceps','machine','weight_reps'),
    ('Cable Curl','biceps','cable','weight_reps'),
    ('Bayesian Cable Curl','biceps','cable','weight_reps'),
    ('Concentration Curl','biceps','dumbbell','weight_reps'),
    ('Reverse Curl','forearms','barbell','weight_reps'),
    ('Triceps Pushdown','triceps','cable','weight_reps'),
    ('Rope Pushdown','triceps','cable','weight_reps'),
    ('Overhead Cable Extension','triceps','cable','weight_reps'),
    ('Skull Crusher','triceps','barbell','weight_reps'),
    ('Dumbbell Overhead Extension','triceps','dumbbell','weight_reps'),
    ('Triceps Kickback','triceps','dumbbell','weight_reps'),
    ('JM Press','triceps','barbell','weight_reps'),
    ('Machine Triceps Extension','triceps','machine','weight_reps'),
    ('Diamond Push-Up','triceps','bodyweight','bodyweight_reps'),
    ('Bench Dip','triceps','bodyweight','bodyweight_reps'),
    ('Back Squat','quadriceps','barbell','weight_reps'),
    ('Front Squat','quadriceps','barbell','weight_reps'),
    ('Pause Squat','quadriceps','barbell','weight_reps'),
    ('Box Squat','quadriceps','barbell','weight_reps'),
    ('Goblet Squat','quadriceps','dumbbell','weight_reps'),
    ('Hack Squat','quadriceps','machine','weight_reps'),
    ('Leg Press','quadriceps','machine','weight_reps'),
    ('Single-Leg Press','quadriceps','machine','weight_reps'),
    ('Leg Extension','quadriceps','machine','weight_reps'),
    ('Bulgarian Split Squat','quadriceps','dumbbell','weight_reps'),
    ('Walking Lunge','quadriceps','dumbbell','weight_reps'),
    ('Reverse Lunge','quadriceps','dumbbell','weight_reps'),
    ('Step-Up','quadriceps','dumbbell','weight_reps'),
    ('Sissy Squat','quadriceps','bodyweight','bodyweight_reps'),
    ('Wall Sit','quadriceps','bodyweight','duration'),
    ('Romanian Deadlift','hamstrings','barbell','weight_reps'),
    ('Dumbbell Romanian Deadlift','hamstrings','dumbbell','weight_reps'),
    ('Stiff-Leg Deadlift','hamstrings','barbell','weight_reps'),
    ('Good Morning','hamstrings','barbell','weight_reps'),
    ('Seated Leg Curl','hamstrings','machine','weight_reps'),
    ('Lying Leg Curl','hamstrings','machine','weight_reps'),
    ('Nordic Hamstring Curl','hamstrings','bodyweight','bodyweight_reps'),
    ('Glute-Ham Raise','hamstrings','bodyweight','bodyweight_reps'),
    ('Barbell Hip Thrust','glutes','barbell','weight_reps'),
    ('Machine Hip Thrust','glutes','machine','weight_reps'),
    ('Glute Bridge','glutes','bodyweight','bodyweight_reps'),
    ('Cable Pull-Through','glutes','cable','weight_reps'),
    ('Cable Kickback','glutes','cable','weight_reps'),
    ('Hip Abduction','glutes','machine','weight_reps'),
    ('Hip Adduction','adductors','machine','weight_reps'),
    ('Kettlebell Swing','glutes','kettlebell','weight_reps'),
    ('Standing Calf Raise','calves','machine','weight_reps'),
    ('Seated Calf Raise','calves','machine','weight_reps'),
    ('Leg Press Calf Raise','calves','machine','weight_reps'),
    ('Single-Leg Calf Raise','calves','bodyweight','bodyweight_reps'),
    ('Tibialis Raise','calves','bodyweight','bodyweight_reps'),
    ('Crunch','core','bodyweight','bodyweight_reps'),
    ('Cable Crunch','core','cable','weight_reps'),
    ('Hanging Knee Raise','core','bodyweight','bodyweight_reps'),
    ('Hanging Leg Raise','core','bodyweight','bodyweight_reps'),
    ('Ab Wheel Rollout','core','bodyweight','bodyweight_reps'),
    ('Reverse Crunch','core','bodyweight','bodyweight_reps'),
    ('Bicycle Crunch','core','bodyweight','bodyweight_reps'),
    ('Russian Twist','core','bodyweight','bodyweight_reps'),
    ('Pallof Press','core','cable','weight_reps'),
    ('Plank','core','bodyweight','duration'),
    ('Side Plank','core','bodyweight','duration'),
    ('Dead Bug','core','bodyweight','bodyweight_reps'),
    ('Bird Dog','core','bodyweight','bodyweight_reps'),
    ('Farmer Carry','full body','dumbbell','distance_duration'),
    ('Suitcase Carry','core','dumbbell','distance_duration'),
    ('Treadmill Run','cardio','treadmill','distance_duration'),
    ('Outdoor Run','cardio','none','distance_duration'),
    ('Track Sprint','cardio','none','distance_duration'),
    ('Incline Walk','cardio','treadmill','distance_duration'),
    ('Outdoor Walk','cardio','none','distance_duration'),
    ('Stationary Bike','cardio','bike','distance_duration'),
    ('Outdoor Cycling','cardio','bike','distance_duration'),
    ('Rowing Machine','cardio','rower','distance_duration'),
    ('Ski Erg','cardio','ski erg','distance_duration'),
    ('Elliptical','cardio','elliptical','duration'),
    ('Stair Climber','cardio','machine','duration'),
    ('Jump Rope','cardio','rope','duration'),
    ('Battle Ropes','cardio','rope','duration'),
    ('Sled Push','full body','sled','distance_duration'),
    ('Sled Pull','full body','sled','distance_duration'),
    ('Burpee','full body','bodyweight','bodyweight_reps'),
    ('Mountain Climber','full body','bodyweight','duration'),
    ('Bear Crawl','full body','bodyweight','distance_duration'),
    ('Turkish Get-Up','full body','kettlebell','weight_reps'),
    ('Kettlebell Clean and Press','full body','kettlebell','weight_reps'),
    ('Dumbbell Thruster','full body','dumbbell','weight_reps'),
    ('Sandbag Carry','full body','sandbag','weight_duration'),
    ('Static Dumbbell Hold','forearms','dumbbell','weight_duration'),
    ('Dead Hang','forearms','bodyweight','duration'),
    ('Plate Pinch Hold','forearms','plate','weight_duration'),
    ('Wrist Curl','forearms','dumbbell','weight_reps'),
    ('Reverse Wrist Curl','forearms','dumbbell','weight_reps'),
    ('Couch Stretch','mobility','none','duration'),
    ('Hip Flexor Stretch','mobility','none','duration'),
    ('Hamstring Stretch','mobility','none','duration'),
    ('Calf Stretch','mobility','none','duration'),
    ('Pigeon Stretch','mobility','none','duration'),
    ('Child Pose','mobility','none','duration'),
    ('Thoracic Rotation','mobility','none','bodyweight_reps'),
    ('Shoulder Dislocate','mobility','band','bodyweight_reps'),
    ('Band Pull-Apart','shoulders','band','bodyweight_reps'),
    ('Ankle Dorsiflexion Drill','mobility','none','bodyweight_reps'),
    ('Deep Squat Hold','mobility','none','duration'),
    ('World Greatest Stretch','mobility','none','bodyweight_reps'),
    ('Cat-Cow','mobility','none','bodyweight_reps'),
    ('90/90 Hip Switch','mobility','none','bodyweight_reps'),
    ('Foam Roll Quadriceps','mobility','foam roller','duration')
)
insert into public.exercises (
  user_id, name, slug, muscle_group, equipment, tracking_type,
  instructions, is_system, source
)
select
  null,
  seed.name,
  lower(trim(both '-' from regexp_replace(seed.name, '[^a-zA-Z0-9]+', '-', 'g'))),
  seed.muscle_group,
  seed.equipment,
  seed.tracking_type,
  array[
    'Set up the exercise with a stable position and a controlled range of motion.',
    'Complete each repetition deliberately and stop the set when technique breaks down.'
  ],
  true,
  'system'
from exercise_seed seed
on conflict (slug) where is_system do nothing;

-- Replace the original exercise policy so global catalog rows are readable but immutable.
drop policy if exists "Admins manage own exercises" on public.exercises;
create policy "Admins read exercise catalog" on public.exercises
  for select to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and (user_id is null or user_id = (select auth.uid()))
  );
create policy "Admins create own exercises" on public.exercises
  for insert to authenticated
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and not is_system
    and source = 'custom'
  );
create policy "Admins update own exercises" on public.exercises
  for update to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and not is_system
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and not is_system
    and source = 'custom'
  );
create policy "Admins delete own exercises" on public.exercises
  for delete to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and not is_system
  );

alter table public.workout_preferences enable row level security;
alter table public.exercise_preferences enable row level security;
alter table public.workout_template_sets enable row level security;
alter table public.food_items enable row level security;
alter table public.food_portions enable row level security;
alter table public.food_favorites enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "Admins manage own workout preferences" on public.workout_preferences
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()));
create policy "Admins manage own exercise preferences" on public.exercise_preferences
  for all to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises exercise
      where exercise.id = exercise_id and (exercise.user_id is null or exercise.user_id = (select auth.uid()))
    )
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises exercise
      where exercise.id = exercise_id and (exercise.user_id is null or exercise.user_id = (select auth.uid()))
    )
  );
create policy "Admins manage own template sets" on public.workout_template_sets
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1
    from public.workout_template_exercises item
    join public.workout_templates template on template.id = item.template_id
    where item.id = template_exercise_id and template.user_id = (select auth.uid())
  ))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1
    from public.workout_template_exercises item
    join public.workout_templates template on template.id = item.template_id
    where item.id = template_exercise_id and template.user_id = (select auth.uid())
  ));
create policy "Admins manage own foods" on public.food_items
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()));
create policy "Admins manage own food portions" on public.food_portions
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid())
  ))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and exists (
    select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid())
  ));
create policy "Admins manage own food favorites" on public.food_favorites
  for all to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid())
    )
  );
create policy "Admins manage own saved meals" on public.saved_meals
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()));
create policy "Admins manage own saved meal items" on public.saved_meal_items
  for all to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and exists (select 1 from public.saved_meals meal where meal.id = saved_meal_id and meal.user_id = (select auth.uid()))
    and exists (select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid()))
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and exists (select 1 from public.saved_meals meal where meal.id = saved_meal_id and meal.user_id = (select auth.uid()))
    and exists (select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid()))
  );
create policy "Admins manage own recipes" on public.recipes
  for all to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()))
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and user_id = (select auth.uid()));
create policy "Admins manage own recipe ingredients" on public.recipe_ingredients
  for all to authenticated
  using (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and exists (select 1 from public.recipes recipe where recipe.id = recipe_id and recipe.user_id = (select auth.uid()))
    and exists (select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid()))
  )
  with check (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and exists (select 1 from public.recipes recipe where recipe.id = recipe_id and recipe.user_id = (select auth.uid()))
    and exists (select 1 from public.food_items food where food.id = food_item_id and food.user_id = (select auth.uid()))
  );

grant select, insert, update, delete on public.workout_preferences to authenticated;
grant select, insert, update, delete on public.exercise_preferences to authenticated;
grant select, insert, update, delete on public.workout_template_sets to authenticated;
grant select, insert, update, delete on public.food_items to authenticated;
grant select, insert, update, delete on public.food_portions to authenticated;
grant select, insert, update, delete on public.food_favorites to authenticated;
grant select, insert, update, delete on public.saved_meals to authenticated;
grant select, insert, update, delete on public.saved_meal_items to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;

create or replace function public.start_workout(
  p_template_id uuid default null,
  p_name text default 'Open workout'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid;
  v_template_name text;
  v_item record;
  v_session_exercise_id uuid;
begin
  if v_user_id is null or (select auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' then
    raise exception 'Admin access required';
  end if;

  if exists (select 1 from public.workout_sessions where user_id = v_user_id and status = 'active') then
    raise exception 'An active workout already exists';
  end if;

  if p_template_id is not null then
    select name into v_template_name
    from public.workout_templates
    where id = p_template_id and user_id = v_user_id;
    if v_template_name is null then raise exception 'Template not found'; end if;
  end if;

  insert into public.workout_sessions (user_id, template_id, name)
  values (v_user_id, p_template_id, coalesce(v_template_name, nullif(trim(p_name), ''), 'Open workout'))
  returning id into v_session_id;

  for v_item in
    select item.*
    from public.workout_template_exercises item
    where item.template_id = p_template_id
    order by item.sort_order
  loop
    insert into public.workout_session_exercises (
      session_id, exercise_id, sort_order, superset_group, rest_seconds, notes
    )
    values (
      v_session_id, v_item.exercise_id, v_item.sort_order, v_item.superset_group, v_item.rest_seconds, v_item.notes
    )
    returning id into v_session_exercise_id;

    insert into public.workout_sets (
      session_exercise_id, set_order, set_type, reps, weight_kg,
      assistance_kg, duration_seconds, distance_meters, rir
    )
    select
      v_session_exercise_id, planned.set_order, planned.set_type, planned.target_reps,
      planned.target_weight_kg, planned.target_assistance_kg, planned.target_duration_seconds,
      planned.target_distance_meters, planned.target_rir
    from public.workout_template_sets planned
    where planned.template_exercise_id = v_item.id
    order by planned.set_order;

    if not found then
      insert into public.workout_sets (session_exercise_id, set_order)
      select v_session_exercise_id, generate_series(0, greatest(v_item.target_sets, 1) - 1);
    end if;
  end loop;

  return v_session_id;
end;
$$;

create or replace function public.finish_workout(p_session_id uuid, p_status text default 'completed')
returns public.workout_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.workout_sessions;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin'
     or p_status not in ('completed', 'cancelled') then
    raise exception 'Invalid workout completion request';
  end if;

  update public.workout_sessions
  set status = p_status,
      ended_at = now(),
      duration_seconds = greatest(0, extract(epoch from (now() - started_at))::integer),
      updated_at = now()
  where id = p_session_id and user_id = (select auth.uid()) and status = 'active'
  returning * into v_session;

  if v_session.id is null then raise exception 'Active workout not found'; end if;
  return v_session;
end;
$$;

create or replace function public.clone_workout_template(p_template_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_new_template_id uuid;
  v_source public.workout_templates;
  v_item record;
  v_new_item_id uuid;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' then raise exception 'Admin access required'; end if;
  select * into v_source from public.workout_templates where id = p_template_id and user_id = v_user_id;
  if v_source.id is null then raise exception 'Template not found'; end if;

  insert into public.workout_templates (user_id, name, notes, sort_order)
  values (v_user_id, v_source.name || ' copy', v_source.notes,
    coalesce((select max(sort_order) + 1 from public.workout_templates where user_id = v_user_id), 0))
  returning id into v_new_template_id;

  for v_item in select * from public.workout_template_exercises where template_id = p_template_id order by sort_order loop
    insert into public.workout_template_exercises (
      template_id, exercise_id, sort_order, target_sets, rep_min, rep_max, rest_seconds, superset_group, notes
    ) values (
      v_new_template_id, v_item.exercise_id, v_item.sort_order, v_item.target_sets,
      v_item.rep_min, v_item.rep_max, v_item.rest_seconds, v_item.superset_group, v_item.notes
    ) returning id into v_new_item_id;
    insert into public.workout_template_sets (
      template_exercise_id, set_order, set_type, target_reps, target_weight_kg,
      target_assistance_kg, target_duration_seconds, target_distance_meters, target_rir
    )
    select v_new_item_id, set_order, set_type, target_reps, target_weight_kg,
      target_assistance_kg, target_duration_seconds, target_distance_meters, target_rir
    from public.workout_template_sets where template_exercise_id = v_item.id;
  end loop;
  return v_new_template_id;
end;
$$;

create or replace function public.save_workout_template(
  p_template_id uuid,
  p_name text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_template_id uuid := p_template_id;
  v_item jsonb;
  v_item_id uuid;
  v_index integer := 0;
  v_sets integer;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin'
     or char_length(trim(p_name)) not between 1 and 120
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Invalid routine';
  end if;

  if v_template_id is null then
    insert into public.workout_templates (user_id, name, notes, sort_order)
    values (
      v_user_id,
      trim(p_name),
      nullif(trim(p_notes), ''),
      coalesce((select max(sort_order) + 1 from public.workout_templates where user_id = v_user_id), 0)
    )
    returning id into v_template_id;
  else
    update public.workout_templates
    set name = trim(p_name), notes = nullif(trim(p_notes), ''), updated_at = now()
    where id = v_template_id and user_id = v_user_id;
    if not found then raise exception 'Routine not found'; end if;
    delete from public.workout_template_exercises where template_id = v_template_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if not exists (
      select 1 from public.exercises exercise
      where exercise.id = (v_item ->> 'exercise_id')::uuid
        and not exercise.is_archived
        and (exercise.user_id is null or exercise.user_id = v_user_id)
    ) then
      raise exception 'Exercise is unavailable';
    end if;

    v_sets := greatest(1, least(20, coalesce((v_item ->> 'target_sets')::integer, 3)));
    insert into public.workout_template_exercises (
      template_id, exercise_id, sort_order, target_sets, rep_min, rep_max,
      rest_seconds, superset_group, notes
    )
    values (
      v_template_id,
      (v_item ->> 'exercise_id')::uuid,
      v_index,
      v_sets,
      nullif(v_item ->> 'rep_min', '')::integer,
      nullif(v_item ->> 'rep_max', '')::integer,
      greatest(0, least(1800, coalesce((v_item ->> 'rest_seconds')::integer, 120))),
      nullif(trim(v_item ->> 'superset_group'), ''),
      nullif(trim(v_item ->> 'notes'), '')
    )
    returning id into v_item_id;

    insert into public.workout_template_sets (template_exercise_id, set_order, target_reps)
    select v_item_id, generated, nullif(v_item ->> 'rep_min', '')::integer
    from generate_series(0, v_sets - 1) generated;
    v_index := v_index + 1;
  end loop;
  return v_template_id;
end;
$$;

create or replace function public.log_saved_meal(
  p_saved_meal_id uuid,
  p_entry_date date,
  p_meal_type text default 'other'
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_meal public.saved_meals;
  v_count integer;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' then raise exception 'Admin access required'; end if;
  select * into v_meal from public.saved_meals where id = p_saved_meal_id and user_id = v_user_id;
  if v_meal.id is null then raise exception 'Saved meal not found'; end if;

  insert into public.nutrition_entries (
    user_id, entry_date, meal_type, name, entry_kind, food_item_id, serving_grams,
    serving_label, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source_id
  )
  select
    v_user_id, p_entry_date, p_meal_type, food.name, 'saved_meal', food.id, item.serving_grams,
    item.serving_grams || ' g', round(food.calories_per_100g * item.serving_grams / 100)::integer,
    food.protein_per_100g * item.serving_grams / 100,
    food.carbs_per_100g * item.serving_grams / 100,
    food.fat_per_100g * item.serving_grams / 100,
    food.fiber_per_100g * item.serving_grams / 100,
    food.sugar_per_100g * item.serving_grams / 100,
    food.sodium_mg_per_100g * item.serving_grams / 100,
    v_meal.id
  from public.saved_meal_items item
  join public.food_items food on food.id = item.food_item_id
  where item.saved_meal_id = v_meal.id and food.user_id = v_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.log_recipe(
  p_recipe_id uuid,
  p_entry_date date,
  p_meal_type text default 'other',
  p_serving_count numeric default 1
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_recipe public.recipes;
  v_entry_id uuid;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin' or p_serving_count <= 0 then
    raise exception 'Invalid recipe log request';
  end if;
  select * into v_recipe from public.recipes where id = p_recipe_id and user_id = v_user_id;
  if v_recipe.id is null then raise exception 'Recipe not found'; end if;

  insert into public.nutrition_entries (
    user_id, entry_date, meal_type, name, entry_kind, serving_count, serving_label,
    calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source_id
  )
  select
    v_user_id, p_entry_date, p_meal_type, v_recipe.name, 'recipe', p_serving_count,
    p_serving_count || ' serving',
    round(sum(food.calories_per_100g * ingredient.grams / 100) / v_recipe.servings * p_serving_count)::integer,
    sum(food.protein_per_100g * ingredient.grams / 100) / v_recipe.servings * p_serving_count,
    sum(food.carbs_per_100g * ingredient.grams / 100) / v_recipe.servings * p_serving_count,
    sum(food.fat_per_100g * ingredient.grams / 100) / v_recipe.servings * p_serving_count,
    sum(food.fiber_per_100g * ingredient.grams / 100) / v_recipe.servings * p_serving_count,
    sum(food.sugar_per_100g * ingredient.grams / 100) / v_recipe.servings * p_serving_count,
    sum(food.sodium_mg_per_100g * ingredient.grams / 100) / v_recipe.servings * p_serving_count,
    v_recipe.id
  from public.recipe_ingredients ingredient
  join public.food_items food on food.id = ingredient.food_item_id
  where ingredient.recipe_id = v_recipe.id and food.user_id = v_user_id
  having count(*) > 0
  returning id into v_entry_id;
  if v_entry_id is null then raise exception 'Recipe has no ingredients'; end if;
  return v_entry_id;
end;
$$;

revoke all on function public.start_workout(uuid, text) from public, anon;
revoke all on function public.finish_workout(uuid, text) from public, anon;
revoke all on function public.clone_workout_template(uuid) from public, anon;
revoke all on function public.save_workout_template(uuid, text, text, jsonb) from public, anon;
revoke all on function public.log_saved_meal(uuid, date, text) from public, anon;
revoke all on function public.log_recipe(uuid, date, text, numeric) from public, anon;
grant execute on function public.start_workout(uuid, text) to authenticated;
grant execute on function public.finish_workout(uuid, text) to authenticated;
grant execute on function public.clone_workout_template(uuid) to authenticated;
grant execute on function public.save_workout_template(uuid, text, text, jsonb) to authenticated;
grant execute on function public.log_saved_meal(uuid, date, text) to authenticated;
grant execute on function public.log_recipe(uuid, date, text, numeric) to authenticated;

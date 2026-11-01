// Isolated PostgreSQL checks; never reads .env or connects to Supabase.
// Applies the standalone-metrics migrations to minimal journal fixtures.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(
  process.env.LIFEQUEST_PGLITE_MODULE ?? '@electric-sql/pglite'
)
const db = new PGlite()
const root = new URL('../', import.meta.url)
const load = (path) => readFile(new URL(path, root), 'utf8')
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const id = (n) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`
const [t1, t2, tb, t3, tSys] = [id(1), id(2), id(3), id(4), id(5)]
const [f1, f2, fSteps, fb, fMood, fSys] = [
  id(11),
  id(12),
  id(13),
  id(14),
  id(17),
  id(18),
]
let checks = 0
function check(value, message) {
  assert.ok(value, message)
  checks++
}
function same(actual, expected, message) {
  assert.deepEqual(actual, expected, message)
  checks++
}
async function fails(sql, code) {
  await assert.rejects(
    () => db.query(sql),
    (error) => error.code === code,
    `${sql} should fail with ${code}`,
  )
  checks++
}
async function actor(userId) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    userId,
  ])
  await db.exec('set role authenticated')
}
const rows = async (sql) => (await db.query(sql)).rows
const one = async (sql) => (await rows(sql))[0]
const count = async (sql) => (await one(sql)).n
const dayValues = async (metricId) =>
  (
    await rows(
      `select value_date::text as d, value::float as v, source_entry_id as s from public.metric_values where metric_id = '${metricId}' order by value_date`,
    )
  ).map((r) => [r.d, r.v, r.s])
const backfill = async () => {
  await db.exec('reset role')
  return (await one('select public.backfill_metric_values() as n')).n
}
const migrations = [
  'supabase/migrations/20260906130000_create_metric_targets.sql',
  'supabase/migrations/20261101120000_create_standalone_metrics.sql',
  'supabase/migrations/20261101120100_migrate_tracked_metrics.sql',
]
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant usage on schema public to authenticated, anon;
    -- Supabase grants new public tables to anon and authenticated by default.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');

    create table public.journal_templates(
      id uuid primary key default gen_random_uuid(),
      user_id uuid references auth.users(id),
      name text not null,
      is_active boolean not null default true,
      is_system boolean not null default false,
      created_at timestamptz not null default now());
    create table public.template_fields(
      id uuid primary key default gen_random_uuid(),
      template_id uuid not null references public.journal_templates(id) on delete cascade,
      field_type text not null,
      label text not null,
      config jsonb not null default '{}');
    create table public.journal_entries(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      template_id uuid not null references public.journal_templates(id),
      entry_date date not null,
      created_at timestamptz not null default now());
    create table public.journal_responses(
      entry_id uuid not null references public.journal_entries(id) on delete cascade,
      field_id uuid not null references public.template_fields(id) on delete cascade,
      value_number numeric);

    -- T1 archived (older), T2 active (newer), both alice's; bob has his own.
    insert into public.journal_templates(id, user_id, name, is_active, created_at) values
      ('${t1}', '${alice}', 'Old check-in', false, '2026-01-01'),
      ('${t2}', '${alice}', 'Morning check-in', true, '2026-06-01'),
      ('${tb}', '${bob}', 'Bob check-in', true, '2026-06-01'),
      ('${t3}', '${alice}', 'Archived only', false, '2026-02-01'),
      ('${tSys}', null, 'System template', true, '2026-01-01');
    insert into public.template_fields(id, template_id, field_type, label, config) values
      ('${f1}', '${t1}', 'number', 'Weight', '{"track_as_metric": true, "metric_unit": "kg"}'),
      ('${f2}', '${t2}', 'number', 'weight ', '{"track_as_metric": true, "metric_unit": "kg "}'),
      ('${fSteps}', '${t2}', 'number', 'Steps', '{"track_as_metric": "true"}'),
      ('${fb}', '${tb}', 'number', 'Weight', '{"track_as_metric": true, "metric_unit": "kg"}'),
      ('${fMood}', '${t3}', 'number', 'Mood', '{"track_as_metric": true}'),
      ('${fSys}', '${tSys}', 'number', 'System weight', '{"track_as_metric": true}'),
      ('${id(15)}', '${t2}', 'number', 'Not tracked', '{}'),
      ('${id(16)}', '${t2}', 'text', 'Note', '{"track_as_metric": "true"}');
    insert into public.journal_entries(id, user_id, template_id, entry_date, created_at) values
      ('${id(21)}', '${alice}', '${t1}', '2026-10-01', '2026-10-01 08:00'),
      ('${id(22)}', '${alice}', '${t1}', '2026-10-02', '2026-10-02 08:00'),
      ('${id(23)}', '${alice}', '${t2}', '2026-10-02', '2026-10-02 20:00'),
      ('${id(24)}', '${alice}', '${t2}', '2026-10-03', '2026-10-03 08:00'),
      ('${id(25)}', '${bob}', '${tb}', '2026-10-01', '2026-10-01 08:00'),
      ('${id(29)}', '${alice}', '${t3}', '2026-10-01', '2026-10-01 09:00'),
      ('${id(30)}', '${alice}', '${tSys}', '2026-10-01', '2026-10-01 09:00');
    insert into public.journal_responses(entry_id, field_id, value_number) values
      ('${id(21)}', '${f1}', 85),
      ('${id(22)}', '${f1}', 84),
      ('${id(23)}', '${f2}', 83),
      ('${id(24)}', '${f2}', 82),
      ('${id(25)}', '${fb}', 70),
      ('${id(29)}', '${fMood}', 6),
      ('${id(30)}', '${fSys}', 79);
  `)
  await db.exec(await load(migrations[0]))
  await db.exec(`
    insert into public.metric_targets(user_id, field_id, target_value, direction) values
      ('${alice}', '${f2}', 80, 'at_most'),
      ('${alice}', '${f1}', 90, 'at_least');
  `)
  for (const path of migrations.slice(1)) await db.exec(await load(path))

  // Part A: metrics, links, targets.
  await db.exec('reset role')
  const aliceMetrics = await rows(
    `select id, name, unit, template_id, source_field_id, target_value::float as tv, target_direction as td from public.metrics where user_id = '${alice}' order by name`,
  )
  check(
    aliceMetrics.length === 3,
    'Alice has exactly three metrics: system-template field skipped',
  )
  const weight = aliceMetrics.find((m) => m.name.toLowerCase() === 'weight')
  const steps = aliceMetrics.find((m) => m.name === 'Steps')
  const mood = aliceMetrics.find((m) => m.name === 'Mood')
  check(weight && steps && mood, 'Weight, Steps and Mood exist')
  check(
    weight.name === 'weight',
    "The active template's trimmed label names the merged metric",
  )
  check(
    !aliceMetrics.some((m) => m.source_field_id === fSys) &&
      (await count('select count(*)::int as n from public.metrics')) === 4,
    'A tracked field on a system template produces no metric',
  )
  check(
    mood.template_id === null && mood.source_field_id === null,
    'A group only on archived templates has no link',
  )
  check(weight.unit === 'kg', 'Unit is trimmed')
  check(
    weight.template_id === t2 && weight.source_field_id === f2,
    'Weight links to the field on the active template',
  )
  check(
    weight.tv === 80 && weight.td === 'at_most',
    'Linked field target wins over the archived field target',
  )
  check(
    steps.tv === null && steps.td === null && steps.unit === null,
    'Steps has no target and no unit',
  )
  check(
    steps.template_id === t2 && steps.source_field_id === fSteps,
    'Steps links to its active field',
  )
  same(
    (
      await rows(
        `select field_id from public.metric_legacy_fields where metric_id = '${weight.id}' order by field_id`,
      )
    ).map((r) => r.field_id),
    [f1, f2],
    'Both Weight fields are recorded in the legacy mapping',
  )
  check(
    (await count('select count(*)::int as n from public.metric_legacy_fields')) === 5,
    'Only tracked number fields on user templates are mapped',
  )
  check(
    (await count(`select count(*)::int as n from public.metrics where user_id = '${bob}'`)) === 1,
    'Bob has one metric',
  )

  // Part B: values.
  same(
    await dayValues(weight.id),
    [
      ['2026-10-01', 85, id(21)],
      ['2026-10-02', 83, id(23)],
      ['2026-10-03', 82, id(24)],
    ],
    'Weight history merges both fields; latest entry wins on a shared day',
  )
  same(await dayValues(steps.id), [], 'Steps has no values')
  same(
    await dayValues(mood.id),
    [['2026-10-01', 6, id(29)]],
    'The archived-only metric keeps its values',
  )
  check(
    (await count(`select count(*)::int as n from public.metric_values where user_id = '${alice}'`)) === 4,
    'Values are owned by the metric owner',
  )

  // Re-running changes nothing.
  const before = await dayValues(weight.id)
  check((await backfill()) === 0, 'A second backfill writes nothing')
  same(await dayValues(weight.id), before, 'Values are unchanged after re-run')

  // Part A does nothing the second time.
  await db.exec(await load(migrations[2]))
  check(
    (await count(`select count(*)::int as n from public.metrics where user_id = '${alice}'`)) === 3 &&
      (await count('select count(*)::int as n from public.metric_legacy_fields')) === 5,
    'Running the migration file again creates no duplicate metrics',
  )
  same(await dayValues(weight.id), before, 'Values survive the repeated file')

  // A manual value is never overwritten.
  await actor(alice)
  await db.exec(
    `insert into public.metric_values(metric_id, user_id, value_date, value, source_entry_id)
     values ('${weight.id}', '${alice}', '2026-10-03', 81.5, null)
     on conflict (metric_id, value_date) do update set value = excluded.value, source_entry_id = null`,
  )
  check((await backfill()) === 0, 'Backfill skips a manually entered day')
  check(
    (await dayValues(weight.id)).some(
      ([d, v, s]) => d === '2026-10-03' && v === 81.5 && s === null,
    ),
    'The manual value stays',
  )

  // Another user's entry on Alice's mapped field is never copied.
  await db.exec(`
    insert into public.journal_entries(id, user_id, template_id, entry_date, created_at)
      values ('${id(31)}', '${bob}', '${t2}', '2026-10-05', '2026-10-05 08:00');
    insert into public.journal_responses values ('${id(31)}', '${f2}', 12);`)
  check((await backfill()) === 0, "Bob's entry is not copied into Alice's metric")
  check(
    !(await dayValues(weight.id)).some(([d]) => d === '2026-10-05'),
    "Alice's metric has no value from Bob's entry",
  )

  // A new journal value is picked up.
  await db.exec(`
    insert into public.journal_entries(id, user_id, template_id, entry_date, created_at)
      values ('${id(26)}', '${alice}', '${t2}', '2026-10-04', '2026-10-04 08:00');
    insert into public.journal_responses values ('${id(26)}', '${f2}', 81);`)
  check((await backfill()) === 1, 'A new journal value is written once')
  check(
    (await dayValues(weight.id)).some(
      ([d, v, s]) => d === '2026-10-04' && v === 81 && s === id(26),
    ),
    'The new value carries its source entry',
  )
  // A newer entry on an already imported day replaces it, an older one does not.
  await db.exec(`
    insert into public.journal_entries(id, user_id, template_id, entry_date, created_at)
      values ('${id(27)}', '${alice}', '${t2}', '2026-10-04', '2026-10-04 21:00');
    insert into public.journal_responses values ('${id(27)}', '${f2}', 80.5);`)
  check((await backfill()) === 1, 'A newer entry on the same day is written')
  check(
    (await dayValues(weight.id)).some(
      ([d, v, s]) => d === '2026-10-04' && v === 80.5 && s === id(27),
    ),
    'The newer entry replaces the older one',
  )
  await db.exec(`
    insert into public.journal_entries(id, user_id, template_id, entry_date, created_at)
      values ('${id(28)}', '${alice}', '${t2}', '2026-10-04', '2026-10-04 07:00');
    insert into public.journal_responses values ('${id(28)}', '${f2}', 99);`)
  check((await backfill()) === 0, 'An older entry does not replace a newer value')
  check(
    (await dayValues(weight.id)).some(
      ([d, v, s]) => d === '2026-10-04' && v === 80.5 && s === id(27),
    ),
    'The newer value stays',
  )

  // An imported response edited since is taken again; an unchanged re-run is not.
  await db.exec(
    `update public.journal_responses set value_number = 83.5 where entry_id = '${id(23)}'`,
  )
  check((await backfill()) === 1, 'An edited response is written once')
  check(
    (await dayValues(weight.id)).some(
      ([d, v, s]) => d === '2026-10-02' && v === 83.5 && s === id(23),
    ),
    'The edited value replaces the imported one',
  )
  check((await backfill()) === 0, 'The re-run after an edit writes nothing')

  // RLS.
  await actor(bob)
  check(
    (await count('select count(*)::int as n from public.metrics')) === 1,
    "Bob sees only his own metric, not Alice's",
  )
  check(
    (await count('select count(*)::int as n from public.metric_values')) === 1,
    "Bob sees only his own value, not Alice's",
  )
  await fails(
    `insert into public.metric_values(metric_id, user_id, value_date, value) values ('${weight.id}', '${bob}', '2026-11-01', 1)`,
    '42501',
  )
  await fails(
    `insert into public.metric_values(metric_id, user_id, value_date, value) values ('${weight.id}', '${alice}', '2026-11-01', 1)`,
    '42501',
  )
  check(
    (await db.query(`update public.metric_values set value = 1 where metric_id = '${weight.id}' returning 1`)).rows.length === 0,
    "Bob cannot update Alice's values",
  )
  check(
    (await db.query(`delete from public.metrics where id = '${weight.id}' returning 1`)).rows.length === 0,
    "Bob cannot delete Alice's metric",
  )
  await fails(
    `insert into public.metrics(user_id, name) values ('${alice}', 'Forged')`,
    '42501',
  )
  await actor(alice)
  await fails(
    `insert into public.metric_values(metric_id, user_id, value_date, value) values ('${weight.id}', '${alice}', '2026-10-01', 1)`,
    '23505',
  )
  await fails(
    `insert into public.metric_values(metric_id, user_id, value_date, value) values ('${weight.id}', '${alice}', '2026-11-01', 1), ('${weight.id}', '${alice}', '2026-11-01', 2)`,
    '23505',
  )
  const own = await one(
    `insert into public.metrics(user_id, name, unit, target_value, target_direction) values ('${alice}', 'Sleep', 'h', 8, 'at_least') returning id`,
  )
  check(own.id, 'Alice can create her own metric')
  await fails(
    `insert into public.metrics(user_id, name, target_value) values ('${alice}', 'Bad', 5)`,
    '23514',
  )
  await fails(
    `insert into public.metrics(user_id, name) values ('${alice}', '   ')`,
    '23514',
  )
  await db.exec(`delete from public.metrics where id = '${own.id}'`)
  check(
    (await count(`select count(*)::int as n from public.metrics where id = '${own.id}'`)) === 0,
    'Alice can delete her own metric',
  )

  // Deleting an entry keeps its value as a plain value.
  await db.exec('reset role')
  await db.exec(`delete from public.journal_entries where id = '${id(21)}'`)
  check(
    (await dayValues(weight.id)).some(
      ([d, v, s]) => d === '2026-10-01' && v === 85 && s === null,
    ),
    'A value outlives its deleted entry as a plain value',
  )

  // Anon and the legacy table / function.
  await db.exec('reset role; set role anon')
  await fails('select * from public.metrics', '42501')
  await fails('select * from public.metric_values', '42501')
  await fails('select * from public.metric_legacy_fields', '42501')
  await fails('select public.backfill_metric_values()', '42501')
  await actor(alice)
  await fails('select public.backfill_metric_values()', '42501')
  await fails('select * from public.metric_legacy_fields', '42501')

  console.log(`ok: ${checks} checks`)
} finally {
  await db.close()
}

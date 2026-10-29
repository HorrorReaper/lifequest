// Isolated PostgreSQL regression check. Does not connect to Supabase or use .env.
// LIFEQUEST_PGLITE_MODULE optionally names a separately installed PGlite module URL.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const { PGlite } = await import(
  process.env.LIFEQUEST_PGLITE_MODULE ?? '@electric-sql/pglite'
)
const db = new PGlite()
const repo = new URL('../', import.meta.url)
const load = (name) => readFile(new URL(name, repo), 'utf8')
let checks = 0
function check(value, message) {
  assert.ok(value, message)
  checks += 1
}
async function denied(sql, args = []) {
  await assert.rejects(
    () => db.query(sql, args),
    (error) => error.code === '42501',
  )
  checks += 1
}
const firstUser = '00000000-0000-4000-8000-000000000001'
const secondUser = '00000000-0000-4000-8000-000000000002'
async function actor(id, admin = true) {
  await db.query(
    "select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [
      id,
      JSON.stringify({
        app_metadata: { role: admin ? 'admin' : 'user' },
        user_metadata: { role: 'admin' },
      }),
    ],
  )
  await db.exec('set role authenticated')
}
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to authenticated, anon;
    create table public.profiles(id uuid primary key references auth.users(id), total_xp integer default 0);
    create table public.city_states(user_id uuid primary key references auth.users(id), coins integer default 0);
    create table public.xp_events(id uuid default gen_random_uuid(), user_id uuid, source_type text, source_id uuid, xp_amount integer, description text);
    create table public.tool_entries(id uuid default gen_random_uuid(), user_id uuid, tool_id text);
    insert into auth.users values ('${firstUser}'), ('${secondUser}');
    insert into public.profiles(id) select id from auth.users;
    insert into public.city_states(user_id) select id from auth.users;
  `)
  for (const name of [
    '20260726180730_interactive_learning_paths_backend.sql',
    '20260726182058_learning_paths_covering_indexes.sql',
    '20260805184127_add_tool_exercise_type.sql',
  ]) {
    await db.exec(await load(`supabase/migrations/${name}`))
  }
  const migration = (await readdir(new URL('supabase/migrations/', repo))).find(
    (name) => name.endsWith('_learning_academy.sql'),
  )
  assert.ok(migration)
  await db.exec(await load(`supabase/migrations/${migration}`))
  check(
    (await db.query('select count(*)::int as n from learning_paths')).rows[0]
      .n === 3,
    'Migration must not seed or publish the personal course',
  )

  await actor(firstUser, false)
  await denied('select public.get_published_learning_catalog()')
  await denied('select public.get_learning_progress()')
  await denied(
    "select public.submit_learning_exercise('anything', 'anything', '{}')",
  )
  await denied('select public.admin_get_learning_catalog()')
  await denied(
    'select public.learning_internal_get_published_learning_catalog()',
  )
  await denied('select public.learning_build_catalog(null, true, true)')

  await actor(firstUser)
  const base = (
    await db.query('select public.admin_get_learning_catalog() as catalog')
  ).rows[0].catalog
  const source = await load('src/lib/personal-learning.ts')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const { PERSONAL_LEARNING_PATH } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  )
  const catalog = { ...base, paths: [...base.paths, PERSONAL_LEARNING_PATH] }
  const saved = (
    await db.query(
      'select public.admin_save_learning_catalog($1::jsonb, $2) as catalog',
      [JSON.stringify(catalog), 'Isolated test'],
    )
  ).rows[0].catalog
  check(saved.paths.length === 4, 'Admin can save the fourth path')
  check(
    saved.paths.at(-1).units[0].lessons[0].exercises[0].perspectives.company
      .blocks[0].items.length === 3,
    'Visual content survives database round trip',
  )
  check(
    saved.paths.at(-1).units[0].lessons[3].exercises.at(-1).practiceMinutes ===
      45,
    'Practice duration survives round trip',
  )
  check(
    (await db.query('select public.get_published_learning_catalog() as c'))
      .rows[0].c.paths.length === 3,
    'Draft is absent from learner catalog before explicit publication',
  )
  await db.query('select public.admin_publish_learning_catalog($1)', [
    'Publish in isolated test',
  ])
  const published = (
    await db.query('select public.get_published_learning_catalog() as c')
  ).rows[0].c
  check(
    published.paths.length === 4,
    'Explicit publication exposes the personal path to admins',
  )
  check(
    !JSON.stringify(published).includes('correctIndex'),
    'Published learner catalog does not expose answer indexes',
  )

  const lesson = PERSONAL_LEARNING_PATH.units[0].lessons[0]
  const second = PERSONAL_LEARNING_PATH.units[0].lessons[1]
  await denied('select public.submit_learning_exercise($1, $2, $3)', [
    second.id,
    second.exercises[1].id,
    JSON.stringify({ selectedIndex: 2 }),
  ])
  const submit = async (exercise, response) =>
    (
      await db.query(
        'select public.submit_learning_exercise($1, $2, $3) as r',
        [lesson.id, exercise, JSON.stringify(response)],
      )
    ).rows[0].r
  check(
    !(await submit(lesson.exercises[1].id, { selectedIndex: 0 })).correct,
    'Wrong answer is graded on server',
  )
  check(
    (await submit(lesson.exercises[1].id, { selectedIndex: 1 })).correct,
    'Corrected answer is accepted',
  )
  const finished = await submit(lesson.exercises[3].id, {
    text: 'Observe three synthetic service requests.',
  })
  check(
    finished.completed &&
      finished.rewarded &&
      finished.xpAwarded === 50 &&
      finished.coinsAwarded === 20,
    'Lesson completes and awards real rewards',
  )
  const repeated = await submit(lesson.exercises[3].id, {
    text: 'Observe three synthetic service requests.',
  })
  check(
    repeated.completed && !repeated.rewarded && repeated.xpAwarded === 0,
    'Repeating completion does not award twice',
  )
  await db.exec('reset role')
  check(
    (await db.query('select count(*)::int as n from xp_events')).rows[0].n ===
      1,
    'Exactly one reward ledger event exists',
  )
  await actor(secondUser)
  check(
    Object.keys(
      (await db.query('select public.get_learning_progress() as p')).rows[0].p
        .reflections,
    ).length === 0,
    'Another admin cannot read the first admin reflections',
  )
  check(
    (await db.query('select * from public.learning_exercise_responses')).rows
      .length === 0,
    'Direct progress table reads respect ownership RLS',
  )

  await actor(firstUser)
  const updated = structuredClone(catalog)
  updated.paths.at(-1).title = 'A newly published title'
  await db.query('select public.admin_save_learning_catalog($1::jsonb, $2)', [
    JSON.stringify(updated),
    'New version',
  ])
  await db.query('select public.admin_publish_learning_catalog($1)', [
    'New version',
  ])
  const oldView = (
    await db.query('select public.get_published_learning_catalog() as c')
  ).rows[0].c
  check(
    oldView.paths.at(-1).title === PERSONAL_LEARNING_PATH.title,
    'Enrolled admin remains pinned to the original version',
  )
  await actor(secondUser)
  check(
    (
      await db.query('select public.get_published_learning_catalog() as c')
    ).rows[0].c.paths.at(-1).title === 'A newly published title',
    'New learner receives the new published version',
  )
  console.log(
    `PASS: ${checks} isolated PostgreSQL checks (roles, drafts, publication, scoring, rewards, ownership, pinned versions).`,
  )
} finally {
  await db.close()
}

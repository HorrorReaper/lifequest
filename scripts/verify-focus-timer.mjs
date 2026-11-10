// Isolated PostgreSQL checks; never reads .env or connects to Supabase.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
const { PGlite } = await import(
  process.env.LIFEQUEST_PGLITE_MODULE ?? '@electric-sql/pglite'
)
const db = new PGlite()
const root = new URL('../', import.meta.url)
const load = (path) => readFile(new URL(path, root), 'utf8')
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const task = '00000000-0000-4000-8000-000000000003'
let checks = 0
function check(value, message) {
  assert.ok(value, message)
  checks++
}
async function fails(sql, code) {
  await assert.rejects(
    () => db.query(sql),
    (error) => error.code === code,
  )
  checks++
}
async function actor(id) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec('set role authenticated')
}
const one = async (sql) => (await db.query(sql)).rows[0]
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{"app_metadata":{"role":"user"},"user_metadata":{"role":"admin"}}'::jsonb $$;
    grant usage on schema auth to authenticated, anon;
    create table public.tasks(id uuid primary key, user_id uuid);
    create table public.profiles(id uuid primary key, total_xp integer default 100);
    create table public.xp_events(id uuid default gen_random_uuid(), user_id uuid, source_type text, source_id uuid, xp_amount integer, description text);
    insert into auth.users values ('${alice}'), ('${bob}');
    insert into public.profiles(id) select id from auth.users;
    insert into public.tasks values ('${task}', '${bob}');
  `)
  const original = await load(
    'supabase/migrations/20260710195847_create_admin_hubs.sql',
  )
  await db.exec(
    original.slice(0, original.indexOf('create table public.exercises')),
  )
  await db.exec(`alter table public.focus_sessions enable row level security;
    grant select, insert, update, delete on public.focus_sessions to authenticated;`)
  await db.exec(
    original.match(
      /create policy "Admins manage own focus sessions"[\s\S]*?;/,
    )[0],
  )
  const file = (await readdir(new URL('supabase/migrations/', root))).find(
    (name) => name.endsWith('_library_focus_timer.sql'),
  )
  await db.exec(await load(`supabase/migrations/${file}`))
  await actor(alice)
  await fails('select public.start_focus_session(0)', '22023')
  await fails('select public.start_focus_session(241)', '22023')
  await fails(`select public.start_focus_session(25, '${task}')`, '42501')
  const session = (await one('select public.start_focus_session(25) as s')).s
  check(
    session.user_id === alice && session.status === 'active',
    'Normal user starts their own session',
  )
  check(
    (await one('select public.start_focus_session(50) as s')).s.id ===
      session.id,
    'A repeated start resumes the existing session',
  )
  check(
    (await one('select count(*)::int as n from public.focus_sessions')).n === 1,
    'Owner can read their session',
  )
  await fails(
    `insert into public.focus_sessions(user_id, planned_minutes) values ('${alice}', 25)`,
    '42501',
  )
  check(
    (
      await db.query(
        "update public.focus_sessions set started_at = now() - interval '1 day' returning id",
      )
    ).rows.length === 0,
    'Normal user cannot forge start time',
  )
  await actor(bob)
  check(
    (await one('select count(*)::int as n from public.focus_sessions')).n === 0,
    'Another user sees no session',
  )
  await fails(
    `select public.finish_focus_session('${session.id}', 'completed')`,
    '42501',
  )
  await actor(alice)
  await fails(
    `select public.finish_focus_session('${session.id}', 'active')`,
    '22023',
  )
  await db.exec(
    `reset role; update public.focus_sessions set started_at = now() - interval '125 seconds' where id = '${session.id}'`,
  )
  await actor(alice)
  const result = (
    await one(
      `select public.finish_focus_session('${session.id}', 'completed') as r`,
    )
  ).r
  check(
    result.awarded &&
      result.xpAwarded === 2 &&
      result.previousTotal === 100 &&
      result.newTotal === 102,
    'XP uses whole server-timed minutes',
  )
  const closed = await one('select * from public.focus_sessions')
  check(
    closed.status === 'completed' &&
      closed.actual_seconds >= 125 &&
      closed.actual_seconds < 130,
    'Completion stores server time',
  )
  check(
    !(
      await one(
        `select public.finish_focus_session('${session.id}', 'completed') as r`,
      )
    ).r.awarded,
    'Repeated completion awards nothing',
  )
  check(
    !(
      await one(
        `select public.finish_focus_session('${session.id}', 'cancelled') as r`,
      )
    ).r.awarded,
    'A closed session cannot be changed',
  )
  const cancelled = (await one('select public.start_focus_session(15) as s')).s
  check(
    !(
      await one(
        `select public.finish_focus_session('${cancelled.id}', 'cancelled') as r`,
      )
    ).r.awarded,
    'Cancel awards no XP',
  )
  const short = (await one('select public.start_focus_session(1) as s')).s
  check(
    !(
      await one(
        `select public.finish_focus_session('${short.id}', 'completed') as r`,
      )
    ).r.awarded,
    'Immediate completion awards no XP',
  )
  await db.exec('reset role')
  check(
    (await one(`select total_xp from public.profiles where id = '${alice}'`))
      .total_xp === 102,
    'Profile increments exactly once',
  )
  check(
    (await one('select count(*)::int as n from public.xp_events')).n === 1,
    'Exactly one XP event',
  )
  await actor(alice)
  const retry = (await one('select public.start_focus_session(25) as s')).s
  await db.exec(
    `reset role; update public.focus_sessions set started_at = now() - interval '2 minutes' where id = '${retry.id}'; alter table public.xp_events add constraint simulate_write_failure check (xp_amount < 0) not valid`,
  )
  await actor(alice)
  await fails(
    `select public.finish_focus_session('${retry.id}', 'completed')`,
    '23514',
  )
  check(
    (
      await one(
        `select status from public.focus_sessions where id = '${retry.id}'`,
      )
    ).status === 'active',
    'Failed XP write rolls back completion for retry',
  )
  await db.exec(
    'reset role; alter table public.xp_events drop constraint simulate_write_failure; set role anon',
  )
  await fails('select public.start_focus_session(25)', '42501')
  await fails(
    `select public.finish_focus_session('${retry.id}', 'completed')`,
    '42501',
  )
  await actor('')
  await fails('select public.start_focus_session(25)', '42501')
  console.log(`Focus timer database: ${checks} checks passed.`)
} finally {
  await db.close()
}

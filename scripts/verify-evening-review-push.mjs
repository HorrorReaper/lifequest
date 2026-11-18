// Isolated PostgreSQL checks for the push migrations
// (supabase/migrations/20261115120000_push_subscriptions.sql and
// 20261115130000_evening_review_reminders.sql). Never reads .env or connects
// to Supabase. Run with a separately installed PGlite:
//   LIFEQUEST_PGLITE_MODULE=file:///…/@electric-sql/pglite/dist/index.js node scripts/verify-evening-review-push.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.LIFEQUEST_PGLITE_MODULE ?? '@electric-sql/pglite')

const db = new PGlite()
const root = new URL('../', import.meta.url)
const load = (path) => readFile(new URL(path, root), 'utf8')
const id = (n) => `00000000-0000-4000-8000-00000000000${n}`
const [alice, bob, carol, dave, erin] = [1, 2, 3, 4, 5].map(id)
const template = id(9)
let checks = 0
const check = (value, message) => {
  assert.ok(value, message)
  checks++
}
async function fails(sql, code) {
  await assert.rejects(() => db.query(sql), (error) => error.code === code, sql)
  checks++
}
async function as(role, user = null) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ''])
  await db.exec(`set role ${role}`)
}
const rows = async (sql) => (await db.query(sql)).rows

try {
  // Whatever minute it is in UTC right now, open the window ten minutes ago.
  const utc = (await rows(`select extract(hour from now() at time zone 'UTC') * 60 + extract(minute from now() at time zone 'UTC') as m`))[0].m
  const fromMinutes = Math.max(0, Number(utc) - 10)

  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.profiles(id uuid primary key references auth.users, timezone text not null default 'UTC');
    create table public.journal_templates(id uuid primary key);
    create table public.journal_entries(id uuid primary key default gen_random_uuid(), user_id uuid, template_id uuid, entry_date date, is_complete boolean default true);
    create table public.ritual_settings(ritual text primary key, enabled boolean not null default true, weekday smallint, from_minutes smallint not null default 0, template_id uuid);
    insert into auth.users values ('${alice}'), ('${bob}'), ('${carol}'), ('${dave}'), ('${erin}');
    insert into public.profiles values ('${alice}', 'UTC'), ('${bob}', 'Etc/GMT+6'), ('${carol}', 'UTC'), ('${dave}', 'Not/A_Zone'), ('${erin}', 'UTC');
    insert into public.journal_templates values ('${template}');
    insert into public.ritual_settings values ('evening_review', true, null, ${fromMinutes}, '${template}');
    insert into public.journal_entries(user_id, template_id, entry_date) values ('${carol}', '${template}', (now() at time zone 'UTC')::date);
  `)
  await db.exec(await load('supabase/migrations/20261115120000_push_subscriptions.sql'))
  await db.exec(await load('supabase/migrations/20261115130000_evening_review_reminders.sql'))

  // Saving a subscription: own rows only, endpoint moves to the current account.
  await as('authenticated', alice)
  await db.query(`select public.save_push_subscription('https://push.example/a1', 'k1', 'x1')`)
  await db.query(`select public.save_push_subscription('https://push.example/a2', 'k2', 'x2')`)
  await db.query(`select public.save_push_subscription('https://push.example/shared', 'k3', 'x3')`)
  check((await rows('select * from public.push_subscriptions')).length === 3, 'alice sees her three devices')
  await fails(`insert into public.push_subscriptions(user_id, endpoint, p256dh, auth) values ('${alice}', 'https://push.example/z', 'k', 'x')`, '42501')
  await fails(`select public.save_push_subscription('http://push.example/insecure', 'k', 'x')`, '23514')

  await as('authenticated', bob)
  await db.query(`select public.save_push_subscription('https://push.example/shared', 'k4', 'x4')`)
  check((await rows('select * from public.push_subscriptions')).length === 1, 'bob now owns the shared endpoint only')
  await db.exec(`update public.push_subscriptions set user_id = '${alice}'`).catch(() => {})
  check((await rows(`select * from public.push_subscriptions where user_id = '${bob}'`)).length === 1, 'bob cannot hand his row to someone else')

  await as('authenticated', alice)
  check((await rows('select * from public.push_subscriptions')).length === 2, 'alice lost the shared endpoint')

  for (const user of [carol, dave]) {
    await as('authenticated', user)
    await db.query(`select public.save_push_subscription('https://push.example/${user}', 'k', 'x')`)
  }

  // The claim: only the service role may run it.
  await as('authenticated', alice)
  await fails('select * from public.claim_evening_review_reminders()', '42501')
  await fails('select * from public.push_reminder_log', '42501')
  await as('anon')
  await fails('select * from public.claim_evening_review_reminders()', '42501')

  await as('service_role')
  const first = await rows('select * from public.claim_evening_review_reminders(120)')
  const users = new Set(first.map((row) => row.user_id))
  check(users.has(alice) && first.filter((row) => row.user_id === alice).length === 2, 'alice is due on both devices')
  check(users.has(dave), 'an unknown timezone falls back to UTC and is due')
  check(!users.has(bob), 'bob is outside his window')
  check(!users.has(carol), 'carol already wrote her evening review today')
  check(!users.has(erin), 'erin has no device')
  check(first.every((row) => row.template_id === template), 'rows carry the ritual template')

  const second = await rows('select * from public.claim_evening_review_reminders(120)')
  check(second.length === 0, 'a second run on the same day claims nobody')

  await db.exec('reset role')
  await db.exec(`update public.ritual_settings set enabled = false`)
  await db.exec(`delete from public.push_reminder_log`)
  await as('service_role')
  check((await rows('select * from public.claim_evening_review_reminders(120)')).length === 0, 'a disabled ritual reminds nobody')

  console.log(`verify-evening-review-push: ${checks} checks passed`)
} finally {
  await db.close()
}

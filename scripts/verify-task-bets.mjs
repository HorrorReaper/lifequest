// Isolated PostgreSQL checks for supabase/migrations/20261119120000_task_bets.sql.
// Never reads .env or connects to Supabase. Run with a separately installed PGlite:
//   LIFEQUEST_PGLITE_MODULE=file:///…/@electric-sql/pglite/dist/index.js node scripts/verify-task-bets.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.LIFEQUEST_PGLITE_MODULE ?? '@electric-sql/pglite')

const db = new PGlite()
const root = new URL('../', import.meta.url)
const id = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`
const [alice, bob] = [1, 2].map(id)
let checks = 0
const check = (value, message) => {
  assert.ok(value, message)
  checks++
}
async function fails(sql, pattern) {
  await assert.rejects(
    () => db.query(sql),
    (error) => (typeof pattern === 'string' ? error.code === pattern : pattern.test(error.message)),
    sql
  )
  checks++
}
async function as(role, user = null) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ''])
  await db.exec(`set role ${role}`)
}
const rows = async (sql) => (await db.query(sql)).rows
const one = async (sql) => (await rows(sql))[0]

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.profiles(id uuid primary key references auth.users, timezone text not null default 'UTC');
    create table public.tasks(
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      title text not null,
      due_date date,
      is_completed boolean not null default false
    );
    create table public.city_states(user_id uuid primary key, coins integer not null default 0, updated_at timestamptz);
    alter table public.tasks enable row level security;
    create policy own on public.tasks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    grant select, insert, update, delete on public.tasks to authenticated;
    insert into auth.users values ('${alice}'), ('${bob}');
    insert into public.profiles values ('${alice}', 'UTC'), ('${bob}', 'UTC');
  `)
  await db.exec(await readFile(new URL('supabase/migrations/20261119120000_task_bets.sql', root), 'utf8'))

  const today = `(now() at time zone 'UTC')::date`
  await db.exec(`
    insert into public.tasks(id, user_id, title, due_date) values
      ('${id(10)}', '${alice}', 'Write the report', ${today}),
      ('${id(11)}', '${alice}', 'Call the bank', ${today} + 2),
      ('${id(12)}', '${alice}', 'No date', null),
      ('${id(13)}', '${alice}', 'Third', ${today} + 1),
      ('${id(14)}', '${alice}', 'Fourth', ${today} + 1),
      ('${id(15)}', '${alice}', 'Fifth', ${today} + 1),
      ('${id(20)}', '${bob}', 'Bob task', ${today});
    update public.tasks set is_completed = true where id = '${id(15)}';
  `)

  // Placing.
  await as('authenticated', alice)
  await fails(`select * from public.place_task_bet('${id(10)}', 10)`, /bet:coins/)
  await db.exec('reset role')
  await db.exec(`insert into public.city_states(user_id, coins) values ('${alice}', 50)`)
  await as('authenticated', alice)
  await fails(`select * from public.place_task_bet('${id(10)}', 21)`, /bet:stake/)
  await fails(`select * from public.place_task_bet('${id(10)}', 0)`, /bet:stake/)
  await fails(`select * from public.place_task_bet('${id(12)}', 5)`, /bet:due_date/)
  await fails(`select * from public.place_task_bet('${id(15)}', 5)`, /bet:completed/)
  await fails(`select * from public.place_task_bet('${id(20)}', 5)`, /bet:not_found/)
  const placed = await one(`select * from public.place_task_bet('${id(10)}', 20)`)
  check(placed.coins === 30, 'the stake leaves the balance')
  await fails(`select * from public.place_task_bet('${id(10)}', 5)`, /bet:already_bet/)
  check((await rows('select * from public.task_bets')).length === 1, 'alice sees her bet')
  await fails(`insert into public.task_bets(task_id, task_title, stake, due_date, created_day) values ('${id(11)}', 'x', 5, ${today}, ${today})`, '42501')
  await fails(`update public.task_bets set status = 'won'`, '42501')
  await fails(`select public.task_bet_local_day('${alice}')`, '42501')

  // The due date holds while the bet is open.
  await fails(`update public.tasks set due_date = ${today} + 1 where id = '${id(10)}'`, /bet:due_date_locked/)
  await db.query(`update public.tasks set title = 'Write the report today' where id = '${id(10)}'`)
  check(true, 'other edits still go through')

  // Done in time: twice the stake back, reported once.
  await db.query(`update public.tasks set is_completed = true where id = '${id(10)}'`)
  await db.exec('reset role')
  const won = await one(`select status, payout from public.task_bets where task_id = '${id(10)}'`)
  check(won.status === 'won' && won.payout === 40, 'completing in time wins twice the stake')
  check((await one(`select coins from public.city_states where user_id = '${alice}'`)).coins === 70, 'the payout reaches the balance')
  await as('authenticated', alice)
  const report = await rows('select * from public.settle_task_bets()')
  check(report.length === 1 && report[0].status === 'won' && report[0].coins === 70, 'the win is reported with the balance')
  check((await rows('select * from public.settle_task_bets()')).length === 0, 'and only once')
  await db.query(`update public.tasks set is_completed = false where id = '${id(10)}'`)
  await fails(`select * from public.place_task_bet('${id(10)}', 5)`, /bet:already_bet/)

  // The day passing loses the bet.
  await db.query(`select * from public.place_task_bet('${id(11)}', 5)`)
  await db.exec('reset role')
  await db.exec(`update public.task_bets set due_date = ${today} - 1 where task_id = '${id(11)}'`)
  await as('authenticated', alice)
  const lost = await rows('select * from public.settle_task_bets()')
  check(lost.length === 1 && lost[0].status === 'lost' && lost[0].payout === 0, 'a bet whose day has passed is lost')
  check(lost[0].coins === 65, 'a lost stake stays gone')
  await db.query(`update public.tasks set due_date = ${today} + 3 where id = '${id(11)}'`)
  check(true, 'the due date is free again once the bet is settled')

  // Three new bets a day at most (two placed today already).
  await db.query(`select * from public.place_task_bet('${id(13)}', 1)`)
  await fails(`select * from public.place_task_bet('${id(14)}', 1)`, /bet:daily_limit/)

  // Completing after the due day loses; deleting the task loses.
  await db.exec('reset role')
  await db.exec(`update public.task_bets set due_date = ${today} - 1 where task_id = '${id(13)}'`)
  await as('authenticated', alice)
  await db.query(`update public.tasks set is_completed = true where id = '${id(13)}'`)
  await db.exec('reset role')
  check((await one(`select status from public.task_bets where task_id = '${id(13)}'`)).status === 'lost', 'completing after the due day loses')
  await db.exec(`delete from public.task_bets where task_id = '${id(13)}'`)
  await db.exec(`update public.task_bets set created_day = ${today} - 1`)
  await as('authenticated', alice)
  await db.query(`select * from public.place_task_bet('${id(14)}', 3)`)
  await db.query(`delete from public.tasks where id = '${id(14)}'`)
  await db.exec('reset role')
  const deleted = await one(`select status, task_id, task_title from public.task_bets where task_title = 'Fourth'`)
  check(deleted.status === 'lost' && deleted.task_id === null && deleted.task_title === 'Fourth', 'deleting the task loses the bet and keeps its record')

  // Bob sees none of it.
  await as('authenticated', bob)
  check((await rows('select * from public.task_bets')).length === 0, 'bets are private')
  check((await rows('select * from public.settle_task_bets()')).length === 0, "bob has nothing to settle")

  console.log(`verify-task-bets: ${checks} checks passed`)
} finally {
  await db.close()
}

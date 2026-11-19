// Isolated PostgreSQL checks for supabase/migrations/20261119150000_diary.sql.
// Never reads .env or connects to Supabase. Run with a separately installed PGlite:
//   LIFEQUEST_PGLITE_MODULE=file:///…/@electric-sql/pglite/dist/index.js node scripts/verify-diary.mjs
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { PGlite } = await import(process.env.LIFEQUEST_PGLITE_MODULE ?? '@electric-sql/pglite')

const db = new PGlite()
const DIARY = 'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a11'
const FREE = '770eb374-582f-42a8-b58c-fd2950c41d5c'
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let checks = 0
const check = (value, message) => {
  assert.ok(value, message)
  checks++
}
const rows = async (sql) => (await db.query(sql)).rows

try {
  await db.exec(`
    create table public.journal_templates(
      id uuid primary key, user_id uuid, name text not null, description text, entry_type text,
      icon text, is_default boolean, is_system boolean, xp_reward integer, sort_order integer, is_active boolean
    );
    create table public.template_fields(
      id uuid primary key, template_id uuid references public.journal_templates(id), field_type text, label text,
      description text, placeholder text, is_required boolean, sort_order integer, config jsonb
    );
    create table public.journal_entries(
      id uuid primary key default gen_random_uuid(), user_id uuid not null, template_id uuid not null,
      entry_date date not null default current_date, is_complete boolean default true, xp_earned integer default 0
    );
    insert into public.journal_templates(id, name, entry_type, is_system, is_active) values ('${FREE}', 'Free Write', 'free_write', true, true);
  `)
  const migration = await readFile(new URL('../supabase/migrations/20261119150000_diary.sql', import.meta.url), 'utf8')
  await db.exec(migration)
  await db.exec(migration)
  check(true, 'the migration can run twice')

  const template = (await rows(`select name, entry_type, is_system from public.journal_templates where id = '${DIARY}'`))[0]
  check(template?.name === 'Diary' && template.entry_type === 'diary' && template.is_system, 'the Diary template exists')
  const fields = await rows(`select field_type, label, is_required from public.template_fields where template_id = '${DIARY}' order by sort_order`)
  check(fields.length === 2 && fields[0].label === 'Title' && !fields[0].is_required, 'an optional title comes first')
  check(fields[1].field_type === 'markdown' && fields[1].is_required, 'then a required Markdown body')

  await db.exec(`insert into public.journal_entries(user_id, template_id, entry_date) values ('${alice}', '${DIARY}', '2026-11-19')`)
  check((await rows(`select is_diary from public.journal_entries where template_id = '${DIARY}'`))[0].is_diary === true, 'a Diary entry is marked')
  await db.exec(`insert into public.journal_entries(user_id, template_id, entry_date) values ('${alice}', '${FREE}', '2026-11-19')`)
  check((await rows(`select is_diary from public.journal_entries where template_id = '${FREE}'`))[0].is_diary === false, 'other entries are not')

  await assert.rejects(
    () => db.query(`insert into public.journal_entries(user_id, template_id, entry_date) values ('${alice}', '${DIARY}', '2026-11-19')`),
    (error) => error.code === '23505'
  )
  checks++
  await db.exec(`insert into public.journal_entries(user_id, template_id, entry_date) values ('${alice}', '${DIARY}', '2026-11-20')`)
  await db.exec(`insert into public.journal_entries(user_id, template_id, entry_date) values ('${bob}', '${DIARY}', '2026-11-19')`)
  check((await rows('select * from public.journal_entries where is_diary')).length === 3, 'one diary entry per user and day, any number of days and users')

  await assert.rejects(
    () => db.query(`update public.journal_entries set template_id = '${DIARY}' where template_id = '${FREE}'`),
    (error) => error.code === '23505'
  )
  checks++

  console.log(`verify-diary: ${checks} checks passed`)
} finally {
  await db.close()
}

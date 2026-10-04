/* eslint-disable @typescript-eslint/no-require-imports -- disposable Postgres integration harness */
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const fs = require("node:fs");
const assert = require("node:assert/strict");
async function main() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
 create table public.tasks(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),title text not null,description text,is_completed boolean not null default false,due_date date,priority text not null default 'medium',created_at timestamptz not null default now(),completed_at timestamptz);
 alter table public.tasks enable row level security; create policy own_tasks on public.tasks for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id); grant select,insert,update,delete on public.tasks to authenticated;
 create table public.admin_notes(id uuid,user_id uuid,title text,body text,module text,status text,tags text[],is_pinned boolean,created_at timestamptz,updated_at timestamptz);`);
  for (const file of [
    "20260720160333_create_knowledge_projects.sql",
    "20261003084218_projects_usability.sql",
    "20261003084708_projects_workspace_indexes.sql",
    ...fs
      .readdirSync("supabase/migrations")
      .filter((f) => f.endsWith("_contacts_management.sql")),
  ])
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
  const owner = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002";
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  async function asUser(id, role = "admin") {
    await db.exec("reset role");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [id, JSON.stringify({ app_metadata: { role } })],
    );
    await db.exec("set role authenticated");
  }
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const save = async (kind, values, id = null, stamp = null) =>
    (
      await query("select public.save_contact_record($1,$2,$3,$4) id", [
        kind,
        id,
        values,
        stamp,
      ])
    )[0].id;
  const detail = async (id) =>
    (
      await query("select public.get_contact_detail($1,'2026-10-04') data", [
        id,
      ])
    )[0].data;
  const fail = async (fn, regex) =>
    assert.rejects(async () => {
      await db.exec("begin");
      try {
        await fn();
        await db.exec("commit");
      } catch (e) {
        await db.exec("rollback");
        throw e;
      }
    }, regex);
  await asUser(owner);
  await query("select public.ensure_contact_defaults()");
  const groups = await query("select * from public.contact_groups"),
    types = await query("select * from public.contact_relationship_types");
  assert.equal(groups.length, 2);
  await query("select public.ensure_contact_defaults()");
  assert.equal((await query("select * from public.contact_groups")).length, 2);
  const anna = await save("contact", {
      display_name: "Anna",
      organization: "Example",
      group_ids: [groups[0].id],
      is_favorite: true,
    }),
    ben = await save("contact", { display_name: "Ben" });
  assert.equal((await detail(anna)).group_ids.length, 1);
  const partner = types.find((t) => t.forward_label === "Partnerschaft");
  const rel = await save("relationship", {
    source_id: anna,
    target_id: ben,
    type_id: partner.id,
  });
  await fail(
    () =>
      save("relationship", {
        source_id: ben,
        target_id: anna,
        type_id: partner.id,
      }),
    /duplicate/,
  );
  await fail(
    () =>
      save("relationship", {
        source_id: anna,
        target_id: anna,
        type_id: partner.id,
      }),
    /check constraint/,
  );
  assert.equal((await detail(ben)).relationships.length, 1);
  const event = await save("event", {
    title: "Gemeinsames Jubiläum",
    kind: "anniversary",
    month: 10,
    day: 5,
    origin_year: 2020,
    contact_ids: [anna, ben],
  });
  const leap = await save("event", {
    title: "Geburtstag ohne Jahr",
    month: 2,
    day: 29,
    origin_year: null,
    contact_ids: [anna],
  });
  const occurrences = async (start, end) =>
    (
      await query("select public.contact_event_occurrences($1,$2) data", [
        start,
        end,
      ])
    )[0].data;
  assert.equal((await occurrences("2026-10-01", "2026-10-31")).length, 1);
  assert.equal(
    (await occurrences("2026-10-01", "2026-10-31"))[0].members.length,
    2,
  );
  assert.equal((await occurrences("2026-03-01", "2026-03-01"))[0].id, leap);
  assert.equal((await occurrences("2028-02-29", "2028-02-29"))[0].id, leap);
  assert.equal(
    (
      await query(
        "select public.contact_occurrence_date(2,29,2026,'feb28')::text as value",
      )
    )[0].value,
    "2026-02-28",
  );
  assert.equal(
    (
      await query(
        "select public.contact_occurrence_date(2,29,2026,'leap_only') as value",
      )
    )[0].value,
    null,
  );
  assert.equal((await occurrences("2019-10-05", "2019-10-05")).length, 0);
  await fail(
    () =>
      save("event", {
        title: "Impossible",
        month: 2,
        day: 30,
        contact_ids: [anna],
      }),
    /date field value out of range/,
  );
  const once = await save("event", {
    title: "Einmalig",
    month: 12,
    day: 31,
    origin_year: 2026,
    recurrence: "once",
    contact_ids: [anna],
  });
  assert.equal((await occurrences("2027-12-31", "2027-12-31")).length, 0);
  await query("select public.set_contact_occurrence($1,'2026-10-05',true)", [
    event,
  ]);
  assert.equal(
    (await occurrences("2026-10-05", "2026-10-05"))[0].is_done,
    true,
  );
  assert.equal(
    (await occurrences("2027-10-05", "2027-10-05"))[0].is_done,
    false,
  );
  const reminders = async (day) =>
    (
      await query("select public.contact_reminders($1,$2) data", [
        day,
        "Europe/Berlin",
      ])
    )[0].data;
  assert.equal((await reminders("2026-10-04")).events.length, 0);
  await query(
    "select public.set_contact_occurrence($1,'2026-10-05',false,'2026-10-06')",
    [event],
  );
  assert.equal((await reminders("2026-10-04")).events.length, 0);
  assert.equal((await reminders("2026-10-06")).events.length, 1);
  const makeTask = async () =>
    (
      await query(
        "select public.create_contact_occurrence_task($1,'2026-10-05',$2) id",
        [event, { title: "Geschenk besorgen", due_date: "2026-10-04" }],
      )
    )[0].id;
  const task = await makeTask();
  assert.equal(await makeTask(), task);
  const data = await detail(anna);
  assert.equal(data.tasks.length, 1);
  const eventRow = data.events.find((e) => e.id === event);
  await save("event", { title: "Neuer Titel" }, event, eventRow.updated_at);
  assert.equal(await makeTask(), task);
  const interaction = await save("interaction", {
    contact_date: "2026-10-02",
    summary: "Treffen",
    contact_ids: [anna, ben],
  });
  await save("interaction", {
    contact_date: "2026-12-01",
    summary: "Zukunft",
    contact_ids: [anna],
  });
  assert.equal((await detail(anna)).last_contact, "2026-10-02");
  await save(
    "contact",
    { contact_interval_days: 1 },
    anna,
    (await detail(anna)).contact.updated_at,
  );
  assert.equal((await reminders("2026-10-04")).catchups.length, 1);
  assert.equal((await reminders("2026-10-04")).tasks.length, 1);
  const note = await save("note", {
    title: "Gespräch",
    contact_ids: [anna, ben],
  });
  await query("select public.link_contact_resource($1,$2,$3,true)", [
    anna,
    "note",
    note,
  ]);
  assert.equal((await detail(ben)).notes.length, 1);
  await save(
    "contact",
    { is_archived: true },
    anna,
    (await detail(anna)).contact.updated_at,
  );
  const shared = (await occurrences("2026-10-05", "2026-10-05"))[0];
  assert.equal(shared.members.length, 1);
  const benStamp = (await detail(ben)).contact.updated_at;
  await save("contact", { memo: "Updated" }, ben, benStamp);
  await fail(
    () => save("contact", { memo: "Stale" }, ben, benStamp),
    /CONTACT_CONFLICT/,
  );
  await asUser(other);
  assert.equal(
    (await query("select public.list_contacts('2026-10-04') data"))[0].data
      .count,
    0,
  );
  await fail(() => detail(anna), /Contact not found/);
  const foreign = await save("contact", { display_name: "Foreign" });
  await fail(
    () =>
      save("relationship", {
        source_id: foreign,
        target_id: ben,
        type_id: partner.id,
      }),
    /foreign key/,
  );
  await asUser(owner, "user");
  assert.equal((await query("select * from public.contacts")).length, 0);
  await fail(() => detail(ben), /Admin role required/);
  await db.exec("reset role; set role anon");
  await fail(() => query("select * from public.contacts"), /permission denied/);
  await asUser(owner);
  await query("select public.delete_contact_record($1,$2,$3)", [
    "contact",
    ben,
    (await detail(ben)).contact.updated_at,
  ]);
  assert.equal(
    (await query("select id from public.tasks where id=$1", [task])).length,
    1,
  );
  assert.equal(
    (await query("select id from public.knowledge_notes where id=$1", [note]))
      .length,
    1,
  );
  assert.equal(
    (
      await query("select id from public.contact_relationships where id=$1", [
        rel,
      ])
    ).length,
    0,
  );
  assert.equal(
    (
      await query("select id from public.contact_interactions where id=$1", [
        interaction,
      ])
    ).length,
    1,
  );
  assert.equal(
    (await query("select id from public.contact_events where id=$1", [once]))
      .length,
    1,
  );
  await db.query(
    "insert into public.contacts(user_id,display_name) select $1,'Bulk '||n from generate_series(1,1205) n",
    [owner],
  );
  const list = (
    await query("select public.list_contacts('2026-10-04') data")
  )[0].data;
  assert.equal(list.count, 1205);
  assert.equal(list.contacts.length, 50);
  console.log(
    "Contacts PostgreSQL integration passed: ownership, relationships, recurrence, archive, resources, conflict and pagination.",
  );
  await db.close();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

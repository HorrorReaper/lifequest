/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node database harness */
/* Run with PGLITE_MODULE pointing at a temporary @electric-sql/pglite install. */
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const fs = require("node:fs");
const assert = require("node:assert/strict");

async function main() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,public to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
    create table public.tasks(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),title text not null,description text,is_completed boolean not null default false,due_date date,priority text not null default 'medium' check(priority in ('low','medium','high')),created_at timestamptz not null default now(),completed_at timestamptz);
    alter table public.tasks enable row level security;
    create policy own_tasks on public.tasks for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
    grant select,insert,update,delete on public.tasks to authenticated;
    create table public.admin_notes(id uuid,user_id uuid,title text,body text,module text,status text,tags text[],is_pinned boolean,created_at timestamptz,updated_at timestamptz);
  `);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20260720160333_create_knowledge_projects.sql",
      "utf8",
    ),
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261003084218_projects_usability.sql",
      "utf8",
    ),
  );
  await db.exec(fs.readFileSync('supabase/migrations/20261003084708_projects_workspace_indexes.sql','utf8'));
  const admin = "00000000-0000-4000-8000-000000000001";
  const foreign = "00000000-0000-4000-8000-000000000002";
  const normal = "00000000-0000-4000-8000-000000000003";
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    admin,
    foreign,
    normal,
  ]);
  async function asUser(id, role = "admin") {
    await db.exec("reset role");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [id, JSON.stringify({ sub: id, app_metadata: { role } })],
    );
    await db.exec("set role authenticated");
  }
  async function rows(sql, args = []) {
    return (await db.query(sql, args)).rows;
  }
  async function rejects(sql, args, pattern) {
    await assert.rejects(
      (async () => {
        await db.exec("begin");
        try {
          await db.query(sql, args);
          await db.exec("set constraints all immediate");
          await db.exec("commit");
        } catch (error) {
          await db.exec("rollback");
          throw error;
        }
      })(),
      pattern,
    );
  }
  await asUser(admin);
  await db.query("select public.ensure_project_areas()");
  const areas = await rows("select * from public.project_areas");
  assert.equal(areas.length, 2);
  await db.query("select public.ensure_project_areas()");
  assert.equal((await rows("select * from public.project_areas")).length, 2);
  await db.query(
    "update public.project_areas set name='Private life' where name='Privat'",
  );
  await db.query("select public.ensure_project_areas()");
  assert.equal((await rows("select * from public.project_areas")).length, 2);
  const created = (
    await rows(
      "select * from public.create_project_with_home_note('Home','Outcome','active','high','Description','at_risk','2026-10-03','2026-12-01','#112233',$1)",
      [areas[0].id],
    )
  )[0];
  const project = created.created_project_id;
  const saved = (
    await rows("select * from public.projects where id=$1", [project])
  )[0];
  assert.equal(saved.description, "Description");
  assert.equal(saved.health, "at_risk");
  assert.equal(saved.color, "#112233");
  assert.equal(saved.area_id, areas[0].id);
  assert.equal(
    (
      await rows(
        "select * from public.knowledge_note_projects where project_id=$1",
        [project],
      )
    ).length,
    1,
  );
  const project2 = (
    await rows(
      "select * from public.create_project_with_home_note('Work','Outcome')",
    )
  )[0].created_project_id;
  const draft = {
    title: "Main task",
    description: "Keep me",
    priority: "high",
    status: "todo",
    project_id: project,
    due_date: "2026-12-01",
    estimate_minutes: 30,
    blocked_reason: null,
  };
  const task = (
    await rows("select public.save_project_task(null,$1,$2) id", [
      JSON.stringify(draft),
      JSON.stringify([
        { id: null, title: "Step one", is_completed: false, sort_order: 0 },
      ]),
    ])
  )[0].id;
  const child = (
    await rows("select * from public.tasks where parent_task_id=$1", [task])
  )[0];
  assert.equal(
    (
      await rows("select task_total from public.project_overview where id=$1", [
        project,
      ])
    )[0].task_total,
    1,
  );
  let board = (
    await rows("select public.get_project_board($1) board", [project])
  )[0].board;
  assert.equal(board.tasks.length, 2);
  const moved = (
    await rows("select public.reorder_project_tasks($1,$2,$3) board", [
      project,
      board.version,
      JSON.stringify([{ id: task, status: "done", sort_order: 0 }]),
    ])
  )[0].board;
  assert.equal(moved.tasks.find((t) => t.id === task).is_completed, true);
  await rejects(
    "select public.reorder_project_tasks($1,$2,$3)",
    [
      project,
      board.version,
      JSON.stringify([{ id: task, status: "todo", sort_order: 0 }]),
    ],
    /BOARD_CONFLICT/,
  );
  await rejects(
    "select public.reorder_project_tasks($1,$2,$3)",
    [
      project,
      moved.version,
      JSON.stringify([{ id: foreign, status: "todo", sort_order: 0 }]),
    ],
    /Invalid board order/,
  );
  const mainTask = (
    await rows("select * from public.tasks where id=$1", [task])
  )[0];
  await db.query("select public.assign_project_task($1,$2,$3)", [
    task,
    project2,
    mainTask.updated_at,
  ]);
  const family = await rows(
    "select * from public.tasks where id=$1 or parent_task_id=$1",
    [task],
  );
  assert(family.every((t) => t.project_id === project2));
  assert.equal(
    new Date(family.find((t) => t.id === task).due_date)
      .toISOString()
      .slice(0, 10),
    "2026-12-01",
  );
  await rejects(
    "update public.tasks set parent_task_id=$1 where id=$2",
    [child.id, task],
    /Invalid subtask|Move the complete/,
  );
  await rejects(
    "update public.tasks set project_id=$1 where id=$2",
    [project, child.id],
    /Invalid subtask/,
  );
  let current = (
    await rows("select * from public.tasks where id=$1", [task])
  )[0];
  await db.query("update public.tasks set is_completed=true where id=$1", [
    child.id,
  ]);
  await rejects(
    "select public.save_project_task($1,$2,$3,$4)",
    [
      task,
      JSON.stringify({ ...draft, project_id: project2 }),
      JSON.stringify([]),
      current.updated_at,
    ],
    /TASK_CONFLICT/,
  );
  await db.query("update public.projects set status='archived' where id=$1", [
    project,
  ]);
  assert.equal(
    (
      await rows(
        "select status_before_archive from public.projects where id=$1",
        [project],
      )
    )[0].status_before_archive,
    "active",
  );
  await db.query(
    "update public.projects set status=status_before_archive where id=$1",
    [project],
  );
  const note = (
    await rows("select public.create_project_note($1,'Shared note') id", [
      project,
    ])
  )[0].id;
  await db.query(
    "insert into public.knowledge_note_projects(user_id,note_id,project_id) values(auth.uid(),$1,$2)",
    [note, project2],
  );
  await db.query(
    "delete from public.knowledge_note_projects where note_id=$1 and project_id=$2",
    [note, project],
  );
  assert.equal(
    (await rows("select * from public.knowledge_notes where id=$1", [note]))
      .length,
    1,
  );
  assert.equal(
    (
      await rows(
        "select * from public.knowledge_note_projects where note_id=$1",
        [note],
      )
    ).length,
    1,
  );
  const link = (
    await rows(
      "insert into public.project_links(user_id,project_id,title,url) values(auth.uid(),$1,'Docs','https://example.com') returning id",
      [project],
    )
  )[0].id;
  await rejects(
    "insert into public.project_links(user_id,project_id,title,url) values(auth.uid(),$1,'Bad','javascript:alert(1)')",
    [project],
    /check constraint/,
  );
  await db.query("select public.reorder_project_links($1,$2)", [
    project,
    [link],
  ]);
  await asUser(foreign);
  assert.equal((await rows("select * from public.projects")).length, 0);
  assert.equal((await rows("select * from public.project_overview")).length, 0);
  await rejects(
    "select public.assign_project_task($1,$2,$3)",
    [task, null, current.updated_at],
    /Main task not found/,
  );
  await rejects(
    "select public.create_project_note($1,'Foreign')",
    [project],
    /Project not found/,
  );
  await rejects(
    "insert into public.project_links(user_id,project_id,title,url) values(auth.uid(),$1,'Foreign','https://example.com')",
    [project],
    /foreign key/,
  );
  await asUser(normal, "user");
  assert.equal((await rows("select * from public.projects")).length, 0);
  assert.equal((await rows("select * from public.project_areas")).length, 0);
  await rejects(
    "select public.ensure_project_areas()",
    [],
    /Admin role required/,
  );
  await rejects(
    "insert into public.project_areas(user_id,name) values(auth.uid(),'Denied')",
    [],
    /row-level security/,
  );
  await rejects(
    "select public.get_project_board($1)",
    [project],
    /Project not found/,
  );
  await db.exec("reset role;set role anon");
  await rejects("select * from public.project_links", [], /permission denied/);
  await db.exec("reset role");
  await asUser(admin);
  current = (await rows("select * from public.tasks where id=$1", [task]))[0];
  await db.query("select public.delete_project_task($1,$2)", [
    task,
    current.updated_at,
  ]);
  assert.equal(
    (
      await rows(
        "select * from public.tasks where id=$1 or parent_task_id=$1",
        [task],
      )
    ).length,
    0,
  );
  const other = (
    await rows("select public.save_project_task(null,$1,$2) id", [
      JSON.stringify(draft),
      JSON.stringify([
        { id: null, title: "Step", is_completed: false, sort_order: 0 },
      ]),
    ])
  )[0].id;
  await db.query("delete from public.tasks where id=$1", [other]);
  assert.equal(
    (await rows("select * from public.tasks where parent_task_id=$1", [other]))
      .length,
    0,
  );
  await db.query(
    "insert into public.tasks(user_id,project_id,title,status,sort_order) select auth.uid(),$1,'Task '||n,'todo',n from generate_series(1,1205) n",
    [project],
  );
  assert.equal(
    (await rows("select public.get_project_board($1) board", [project]))[0]
      .board.tasks.length,
    1205,
  );
  assert.equal(
    (
      await rows("select task_total from public.project_overview where id=$1", [
        project,
      ])
    )[0].task_total,
    1205,
  );
  await db.close();
  console.log(
    "Projects database integration: creation, hierarchy, moves, conflicts, notes, links, archive and RLS passed.",
  );
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});

create table public.knowledge_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 80),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id)
    references public.knowledge_folders(id, user_id)
    on delete set null (parent_id)
);

create table public.knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 160),
  slug text not null check (char_length(slug) between 1 and 220),
  content text not null default '' check (char_length(content) <= 250000),
  note_type text not null default 'note'
    check (note_type in ('note', 'experiment', 'meeting', 'reference', 'project')),
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object'),
  tags text[] not null default '{}',
  aliases text[] not null default '{}',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'B')
  ) stored,
  unique (id, user_id),
  unique (user_id, slug),
  foreign key (folder_id, user_id)
    references public.knowledge_folders(id, user_id)
    on delete set null (folder_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  home_note_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 120),
  outcome text not null default '' check (char_length(outcome) <= 500),
  description text not null default '' check (char_length(description) <= 10000),
  status text not null default 'planned'
    check (status in ('idea', 'planned', 'active', 'paused', 'completed', 'archived')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  health text not null default 'unset'
    check (health in ('unset', 'on_track', 'at_risk', 'off_track')),
  start_date date,
  target_date date,
  color text not null default '#7c3aed'
    check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'folder-kanban'
    check (char_length(icon) between 1 and 40),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (home_note_id, user_id)
    references public.knowledge_notes(id, user_id)
    on delete set null (home_note_id),
  check (target_date is null or start_date is null or target_date >= start_date)
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  status text not null default 'open'
    check (status in ('open', 'completed', 'cancelled')),
  target_date date,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create table public.knowledge_note_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid not null,
  target_note_id uuid,
  target_title text not null check (char_length(trim(target_title)) between 1 and 160),
  target_heading text,
  display_text text,
  created_at timestamptz not null default now(),
  foreign key (source_note_id, user_id)
    references public.knowledge_notes(id, user_id)
    on delete cascade,
  foreign key (target_note_id, user_id)
    references public.knowledge_notes(id, user_id)
    on delete set null (target_note_id)
);

create table public.knowledge_note_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  version integer not null check (version > 0),
  title text not null,
  content text not null,
  properties jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (note_id, version),
  foreign key (note_id, user_id)
    references public.knowledge_notes(id, user_id)
    on delete cascade
);

create table public.knowledge_note_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  content text not null default '' check (char_length(content) <= 250000),
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object'),
  tags text[] not null default '{}',
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_note_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (note_id, project_id),
  foreign key (note_id, user_id)
    references public.knowledge_notes(id, user_id)
    on delete cascade,
  foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

alter table public.tasks
  add column if not exists project_id uuid,
  add column if not exists status text not null default 'todo',
  add column if not exists sort_order integer not null default 0,
  add column if not exists start_date date,
  add column if not exists estimate_minutes integer,
  add column if not exists parent_task_id uuid,
  add column if not exists blocked_reason text,
  add column if not exists updated_at timestamptz not null default now();

update public.tasks
set status = case when is_completed then 'done' else 'todo' end
where status = 'todo';

alter table public.tasks
  drop constraint if exists tasks_status_check,
  drop constraint if exists tasks_sort_order_check,
  drop constraint if exists tasks_estimate_minutes_check,
  drop constraint if exists tasks_blocked_reason_check;

alter table public.tasks
  add constraint tasks_status_check
    check (status in ('backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  add constraint tasks_sort_order_check
    check (sort_order between 0 and 100000),
  add constraint tasks_estimate_minutes_check
    check (estimate_minutes is null or estimate_minutes between 1 and 100000),
  add constraint tasks_blocked_reason_check
    check (blocked_reason is null or char_length(blocked_reason) <= 1000);

create unique index if not exists tasks_id_user_id_key
  on public.tasks (id, user_id);

alter table public.tasks
  drop constraint if exists tasks_project_owner_fk,
  drop constraint if exists tasks_parent_owner_fk;

alter table public.tasks
  add constraint tasks_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete set null (project_id),
  add constraint tasks_parent_owner_fk
    foreign key (parent_task_id, user_id)
    references public.tasks(id, user_id)
    on delete set null (parent_task_id);

create table public.knowledge_note_tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  task_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (note_id, task_id),
  foreign key (note_id, user_id)
    references public.knowledge_notes(id, user_id)
    on delete cascade,
  foreign key (task_id, user_id)
    references public.tasks(id, user_id)
    on delete cascade
);

create index knowledge_folders_user_parent_idx
  on public.knowledge_folders (user_id, parent_id, sort_order, name);
create index knowledge_notes_user_updated_idx
  on public.knowledge_notes (user_id, is_archived, is_pinned desc, updated_at desc);
create index knowledge_notes_folder_idx
  on public.knowledge_notes (folder_id, updated_at desc);
create index knowledge_notes_search_idx
  on public.knowledge_notes using gin (search_vector);
create index knowledge_notes_tags_idx
  on public.knowledge_notes using gin (tags);
create index projects_user_status_idx
  on public.projects (user_id, status, sort_order, updated_at desc);
create index project_milestones_project_idx
  on public.project_milestones (project_id, status, sort_order);
create index project_milestones_user_idx
  on public.project_milestones (user_id, target_date);
create index knowledge_note_links_source_idx
  on public.knowledge_note_links (source_note_id);
create index knowledge_note_links_target_idx
  on public.knowledge_note_links (target_note_id)
  where target_note_id is not null;
create index knowledge_note_links_unresolved_idx
  on public.knowledge_note_links (user_id, lower(target_title))
  where target_note_id is null;
create index knowledge_note_versions_note_idx
  on public.knowledge_note_versions (note_id, version desc);
create index knowledge_note_templates_user_idx
  on public.knowledge_note_templates (user_id, updated_at desc);
create index knowledge_note_projects_project_idx
  on public.knowledge_note_projects (project_id, note_id);
create index knowledge_note_tasks_task_idx
  on public.knowledge_note_tasks (task_id, note_id);
create index tasks_project_status_idx
  on public.tasks (project_id, status, sort_order, created_at)
  where project_id is not null;
create index tasks_parent_idx
  on public.tasks (parent_task_id)
  where parent_task_id is not null;

alter table public.knowledge_folders enable row level security;
alter table public.knowledge_notes enable row level security;
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.knowledge_note_links enable row level security;
alter table public.knowledge_note_versions enable row level security;
alter table public.knowledge_note_templates enable row level security;
alter table public.knowledge_note_projects enable row level security;
alter table public.knowledge_note_tasks enable row level security;

create policy "Admins manage own knowledge folders"
on public.knowledge_folders for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own knowledge notes"
on public.knowledge_notes for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own projects"
on public.projects for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own project milestones"
on public.project_milestones for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own note links"
on public.knowledge_note_links for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own note versions"
on public.knowledge_note_versions for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own note templates"
on public.knowledge_note_templates for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own note project links"
on public.knowledge_note_projects for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

create policy "Admins manage own note task links"
on public.knowledge_note_tasks for all to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and (select auth.uid()) = user_id
);

grant select, insert, update, delete on public.knowledge_folders to authenticated;
grant select, insert, update, delete on public.knowledge_notes to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_milestones to authenticated;
grant select, insert, update, delete on public.knowledge_note_links to authenticated;
grant select, insert, update, delete on public.knowledge_note_versions to authenticated;
grant select, insert, update, delete on public.knowledge_note_templates to authenticated;
grant select, insert, update, delete on public.knowledge_note_projects to authenticated;
grant select, insert, update, delete on public.knowledge_note_tasks to authenticated;

create or replace function public.sync_task_project_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.project_id is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin role required for project tasks';
  end if;

  if tg_op = 'INSERT' then
    if new.is_completed or new.status = 'done' then
      new.status := 'done';
      new.is_completed := true;
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.is_completed := false;
      new.completed_at := null;
    end if;
  elsif new.status is distinct from old.status then
    new.is_completed := new.status = 'done';
    new.completed_at := case
      when new.status = 'done' then coalesce(new.completed_at, now())
      else null
    end;
  elsif new.is_completed is distinct from old.is_completed then
    new.status := case
      when new.is_completed then 'done'
      when old.status = 'done' then 'todo'
      else old.status
    end;
    new.completed_at := case
      when new.is_completed then coalesce(new.completed_at, now())
      else null
    end;
  end if;

  if new.status <> 'blocked' then
    new.blocked_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_sync_project_status on public.tasks;
create trigger tasks_sync_project_status
before insert or update on public.tasks
for each row execute function public.sync_task_project_status();

revoke all on function public.sync_task_project_status() from public;
revoke all on function public.sync_task_project_status() from anon;
revoke all on function public.sync_task_project_status() from authenticated;

create or replace function public.save_knowledge_note(
  p_note_id uuid,
  p_expected_version integer,
  p_title text,
  p_content text,
  p_folder_id uuid,
  p_note_type text,
  p_properties jsonb,
  p_tags text[],
  p_aliases text[],
  p_is_pinned boolean,
  p_links jsonb,
  p_checkpoint boolean default false
)
returns table(saved_note_id uuid, saved_version integer, saved_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_note public.knowledge_notes%rowtype;
  v_link jsonb;
  v_target_id uuid;
  v_title text := trim(p_title);
  v_note_id uuid := p_note_id;
  v_slug text;
begin
  if v_user_id is null
    or (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin role required';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 160 then
    raise exception 'Note title must contain between 1 and 160 characters';
  end if;
  if char_length(coalesce(p_content, '')) > 250000 then
    raise exception 'Note content is too long';
  end if;
  if p_note_type not in ('note', 'experiment', 'meeting', 'reference', 'project') then
    raise exception 'Invalid note type';
  end if;
  if jsonb_typeof(coalesce(p_properties, '{}'::jsonb)) <> 'object' then
    raise exception 'Note properties must be an object';
  end if;
  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'Note links must be an array';
  end if;

  if v_note_id is null then
    v_note_id := gen_random_uuid();
    v_slug := trim(both '-' from regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then v_slug := 'note'; end if;
    v_slug := left(v_slug, 180) || '-' || left(v_note_id::text, 8);

    insert into public.knowledge_notes (
      id, user_id, folder_id, title, slug, content, note_type,
      properties, tags, aliases, is_pinned
    ) values (
      v_note_id, v_user_id, p_folder_id, v_title, v_slug,
      coalesce(p_content, ''), p_note_type, coalesce(p_properties, '{}'::jsonb),
      coalesce(p_tags, '{}'), coalesce(p_aliases, '{}'), p_is_pinned
    )
    returning * into v_note;
  else
    select * into v_note
    from public.knowledge_notes
    where id = v_note_id and user_id = v_user_id
    for update;

    if not found then raise exception 'Note not found'; end if;
    if v_note.version <> p_expected_version then
      raise exception 'NOTE_CONFLICT';
    end if;

    if p_checkpoint then
      insert into public.knowledge_note_versions (
        user_id, note_id, version, title, content, properties, tags, aliases
      ) values (
        v_user_id, v_note.id, v_note.version, v_note.title, v_note.content,
        v_note.properties, v_note.tags, v_note.aliases
      )
      on conflict (note_id, version) do nothing;
    end if;

    update public.knowledge_notes
    set folder_id = p_folder_id,
        title = v_title,
        content = coalesce(p_content, ''),
        note_type = p_note_type,
        properties = coalesce(p_properties, '{}'::jsonb),
        tags = coalesce(p_tags, '{}'),
        aliases = coalesce(p_aliases, '{}'),
        is_pinned = p_is_pinned,
        version = version + 1,
        updated_at = now()
    where id = v_note_id and user_id = v_user_id
    returning * into v_note;
  end if;

  delete from public.knowledge_note_links
  where source_note_id = v_note_id and user_id = v_user_id;

  for v_link in select value from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    if nullif(trim(v_link ->> 'target_title'), '') is null then continue; end if;
    v_target_id := null;

    select candidate.id into v_target_id
    from public.knowledge_notes candidate
    where candidate.user_id = v_user_id
      and not candidate.is_archived
      and (
        lower(candidate.title) = lower(trim(v_link ->> 'target_title'))
        or exists (
          select 1
          from unnest(candidate.aliases) as note_alias
          where lower(note_alias) = lower(trim(v_link ->> 'target_title'))
        )
      )
    order by
      (lower(candidate.title) = lower(trim(v_link ->> 'target_title'))) desc,
      candidate.updated_at desc
    limit 1;

    insert into public.knowledge_note_links (
      user_id, source_note_id, target_note_id, target_title, target_heading, display_text
    ) values (
      v_user_id,
      v_note_id,
      v_target_id,
      left(trim(v_link ->> 'target_title'), 160),
      nullif(left(trim(v_link ->> 'target_heading'), 160), ''),
      nullif(left(trim(v_link ->> 'display_text'), 160), '')
    );
  end loop;

  update public.knowledge_note_links link
  set target_note_id = v_note_id
  where link.user_id = v_user_id
    and link.target_note_id is null
    and (
      lower(link.target_title) = lower(v_note.title)
      or exists (
        select 1
        from unnest(v_note.aliases) as note_alias
        where lower(note_alias) = lower(link.target_title)
      )
    );

  saved_note_id := v_note.id;
  saved_version := v_note.version;
  saved_updated_at := v_note.updated_at;
  return next;
end;
$$;

revoke all on function public.save_knowledge_note(
  uuid, integer, text, text, uuid, text, jsonb, text[], text[], boolean, jsonb, boolean
) from public;
revoke all on function public.save_knowledge_note(
  uuid, integer, text, text, uuid, text, jsonb, text[], text[], boolean, jsonb, boolean
) from anon;
grant execute on function public.save_knowledge_note(
  uuid, integer, text, text, uuid, text, jsonb, text[], text[], boolean, jsonb, boolean
) to authenticated;

create or replace function public.create_project_with_home_note(
  p_name text,
  p_outcome text,
  p_status text default 'planned',
  p_priority text default 'medium'
)
returns table(created_project_id uuid, created_note_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid := gen_random_uuid();
  v_note_id uuid := gen_random_uuid();
  v_name text := trim(p_name);
  v_slug text;
begin
  if v_user_id is null
    or (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin role required';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Project name must contain between 1 and 120 characters';
  end if;
  if p_status not in ('idea', 'planned', 'active', 'paused', 'completed', 'archived') then
    raise exception 'Invalid project status';
  end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Invalid project priority';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'project'; end if;
  v_slug := left(v_slug, 180) || '-' || left(v_note_id::text, 8);

  insert into public.knowledge_notes (
    id, user_id, title, slug, content, note_type, properties
  ) values (
    v_note_id,
    v_user_id,
    v_name,
    v_slug,
    '# ' || v_name || E'\n\n## Outcome\n\n' || coalesce(nullif(trim(p_outcome), ''), 'Define the outcome.') ||
      E'\n\n## Context\n\n\n## Decisions\n\n\n## Next actions\n\n',
    'project',
    jsonb_build_object('project_id', v_project_id)
  );

  insert into public.projects (
    id, user_id, home_note_id, name, outcome, status, priority
  ) values (
    v_project_id, v_user_id, v_note_id, v_name,
    coalesce(nullif(trim(p_outcome), ''), ''), p_status, p_priority
  );

  insert into public.knowledge_note_projects (user_id, note_id, project_id)
  values (v_user_id, v_note_id, v_project_id);

  created_project_id := v_project_id;
  created_note_id := v_note_id;
  return next;
end;
$$;

revoke all on function public.create_project_with_home_note(text, text, text, text) from public;
revoke all on function public.create_project_with_home_note(text, text, text, text) from anon;
grant execute on function public.create_project_with_home_note(text, text, text, text) to authenticated;

insert into public.knowledge_notes (
  id, user_id, title, slug, content, note_type, properties, tags, is_pinned,
  created_at, updated_at
)
select
  legacy.id,
  legacy.user_id,
  legacy.title,
  left(
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower(legacy.title), '[^a-z0-9]+', '-', 'g')), ''),
      'note'
    ),
    180
  ) || '-' || left(legacy.id::text, 8),
  legacy.body,
  'experiment',
  jsonb_build_object(
    'legacy_module', legacy.module,
    'experiment_status', legacy.status,
    'migrated_from', 'admin_notes'
  ),
  legacy.tags,
  legacy.is_pinned,
  legacy.created_at,
  legacy.updated_at
from public.admin_notes legacy
on conflict (id) do nothing;

insert into public.knowledge_note_versions (
  user_id, note_id, version, title, content, properties, tags, aliases, created_at
)
select
  note.user_id, note.id, note.version, note.title, note.content,
  note.properties, note.tags, note.aliases, note.updated_at
from public.knowledge_notes note
where note.properties ->> 'migrated_from' = 'admin_notes'
on conflict (note_id, version) do nothing;

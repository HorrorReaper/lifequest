-- Personal projects: additive schema; existing Tasks and Knowledge remain canonical.
create table public.project_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique(id, user_id), unique(user_id, name)
);
alter table public.projects
  add column area_id uuid,
  add column status_before_archive text check (status_before_archive in ('idea','planned','active','paused','completed')),
  add column board_version bigint not null default 0,
  add constraint projects_area_owner_fk foreign key (area_id,user_id) references public.project_areas(id,user_id) on delete set null (area_id);
create index projects_area_owner_idx on public.projects(user_id, area_id);
create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 240),
  url text not null check (char_length(url) <= 4000 and url ~* '^https?://[^/[:space:]@]+([/?#][^[:space:]]*)?$'),
  description text not null default '' check (char_length(description) <= 4000),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (project_id,user_id) references public.projects(id,user_id) on delete cascade
);
create index project_links_project_idx on public.project_links(project_id, sort_order, id);
alter table public.project_areas enable row level security;
alter table public.project_links enable row level security;
revoke all on public.project_areas, public.project_links from anon, authenticated;
grant select, insert, update, delete on public.project_areas, public.project_links to authenticated;
create policy "Admins manage own project areas" on public.project_areas for all to authenticated
  using ((select auth.uid())=user_id and (select auth.jwt()->'app_metadata'->>'role')='admin')
  with check ((select auth.uid())=user_id and (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "Admins manage own project links" on public.project_links for all to authenticated
  using ((select auth.uid())=user_id and (select auth.jwt()->'app_metadata'->>'role')='admin')
  with check ((select auth.uid())=user_id and (select auth.jwt()->'app_metadata'->>'role')='admin');

create function public.ensure_project_areas() returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or (select auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then raise exception 'Admin role required'; end if;
  if not exists(select 1 from public.project_areas where user_id=auth.uid()) then
    insert into public.project_areas(user_id,name) values (auth.uid(),'Privat'),(auth.uid(),'Beruflich') on conflict(user_id,name) do nothing;
  end if;
end $$;

create view public.project_overview with (security_invoker=true) as
select p.*, coalesce(t.total,0)::integer task_total, coalesce(t.completed,0)::integer task_completed
from public.projects p left join (
  select project_id, count(*) total, count(*) filter(where status='done') completed
  from public.tasks where parent_task_id is null and status<>'cancelled' group by project_id
) t on t.project_id=p.id;
revoke all on public.project_overview from anon, authenticated;
grant select on public.project_overview to authenticated;

create function public.track_project_state() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status='archived' and old.status<>'archived' then new.status_before_archive:=old.status; end if;
  if new.status='completed' then new.completed_at:=coalesce(new.completed_at,now());
  elsif new.status<>'archived' then new.completed_at:=null; end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
create trigger projects_track_state before update on public.projects for each row execute function public.track_project_state();

-- Every write path (including Tasks and Knowledge) invalidates stale board snapshots.
create function public.invalidate_project_board() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_old uuid; v_new uuid;
begin
  if tg_op<>'INSERT' then v_old:=old.project_id; end if;
  if tg_op<>'DELETE' then v_new:=new.project_id; end if;
  update public.projects set board_version=board_version+1 where id in (v_old,v_new) and user_id=auth.uid();
  -- Editing a checklist must also invalidate an open parent editor.
  if tg_op='DELETE' and pg_trigger_depth()=1 then
    if old.parent_task_id is not null then update public.tasks set updated_at=clock_timestamp() where id=old.parent_task_id and user_id=auth.uid(); end if;
  elsif tg_op<>'DELETE' and new.parent_task_id is not null then
    update public.tasks set updated_at=clock_timestamp() where id=new.parent_task_id and user_id=auth.uid();
  end if;
  return null;
end $$;
create trigger tasks_invalidate_project_board after insert or update or delete on public.tasks for each row execute function public.invalidate_project_board();

-- Deferred validation permits an atomic move of a parent and its children.
create function public.prevent_nested_subtasks() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.parent_task_id is not null and (
    new.parent_task_id=new.id or not exists(select 1 from public.tasks where id=new.parent_task_id and user_id=new.user_id and parent_task_id is null)
    or exists(select 1 from public.tasks where parent_task_id=new.id)
  ) then raise exception 'Invalid subtask: one level required'; end if;
  return new;
end $$;
create trigger tasks_prevent_nested_subtasks before insert or update on public.tasks for each row execute function public.prevent_nested_subtasks();
create function public.validate_project_subtask() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_task public.tasks; v_parent public.tasks;
begin
  select * into v_task from public.tasks where id=new.id;
  if not found then return null; end if;
  if v_task.parent_task_id is not null then
    select * into v_parent from public.tasks where id=v_task.parent_task_id and user_id=v_task.user_id;
    if not found or v_parent.id=v_task.id or v_parent.parent_task_id is not null
       or v_parent.project_id is distinct from v_task.project_id then raise exception 'Invalid subtask: one level and same project required'; end if;
  end if;
  if exists(select 1 from public.tasks c where c.parent_task_id=v_task.id and
    (v_task.parent_task_id is not null or c.user_id<>v_task.user_id or c.project_id is distinct from v_task.project_id)) then
    raise exception 'Move the complete task family together';
  end if;
  return null;
end $$;
create constraint trigger tasks_validate_subtask after insert or update on public.tasks deferrable initially deferred for each row execute function public.validate_project_subtask();

-- Deleting from the ordinary Tasks manager must not promote checklist items to main tasks.
create function public.delete_task_children() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  delete from public.tasks where parent_task_id=old.id and user_id=old.user_id;
  return old;
end $$;
create trigger tasks_delete_children before delete on public.tasks for each row execute function public.delete_task_children();

-- Widen the existing RPC without leaving ambiguous PostgREST overloads.
drop function public.create_project_with_home_note(text,text,text,text);
create function public.create_project_with_home_note(
  p_name text, p_outcome text, p_status text default 'planned', p_priority text default 'medium',
  p_description text default '', p_health text default 'unset', p_start_date date default null,
  p_target_date date default null, p_color text default '#7c3aed', p_area_id uuid default null
) returns table(created_project_id uuid, created_note_id uuid) language plpgsql security invoker set search_path='' as $$
declare v_project uuid:=gen_random_uuid(); v_note uuid:=gen_random_uuid(); v_name text:=trim(p_name);
begin
  if auth.uid() is null or (select auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then raise exception 'Admin role required'; end if;
  if v_name is null or char_length(v_name) not between 1 and 120 then raise exception 'Project name must contain between 1 and 120 characters'; end if;
  insert into public.knowledge_notes(id,user_id,title,slug,content,note_type,properties)
  values(v_note,auth.uid(),v_name,'project-'||v_note::text,'# '||v_name||E'\n\n## Outcome\n\n'||coalesce(p_outcome,'')||E'\n\n## Context\n\n'||coalesce(p_description,''),'project',jsonb_build_object('project_id',v_project));
  insert into public.projects(id,user_id,home_note_id,name,outcome,description,status,priority,health,start_date,target_date,color,area_id,completed_at)
  values(v_project,auth.uid(),v_note,v_name,trim(p_outcome),trim(p_description),p_status,p_priority,p_health,p_start_date,p_target_date,p_color,p_area_id,case when p_status='completed' then now() else null end);
  insert into public.knowledge_note_projects(user_id,note_id,project_id) values(auth.uid(),v_note,v_project);
  return query select v_project,v_note;
end $$;

create function public.get_project_board(p_project_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_version bigint; v_tasks jsonb;
begin
  select board_version into v_version from public.projects where id=p_project_id and user_id=auth.uid();
  if not found then raise exception 'Project not found'; end if;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order,t.id),'[]') into v_tasks from public.tasks t where project_id=p_project_id and user_id=auth.uid();
  return jsonb_build_object('version',v_version,'tasks',v_tasks);
end $$;

create function public.reorder_project_tasks(p_project_id uuid,p_expected_version bigint,p_order jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_version bigint; v_count integer;
begin
  select board_version into v_version from public.projects where id=p_project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project not found'; end if;
  if p_expected_version is null or v_version<>p_expected_version then raise exception 'BOARD_CONFLICT'; end if;
  if p_order is null or jsonb_typeof(p_order)<>'array' then raise exception 'Invalid board order'; end if;
  select count(*) into v_count from public.tasks where project_id=p_project_id and user_id=auth.uid() and parent_task_id is null and status<>'cancelled';
  if jsonb_array_length(p_order)<>v_count or exists(
    select 1 from jsonb_to_recordset(p_order) x(id uuid,status text,sort_order integer)
    left join public.tasks t on t.id=x.id and t.user_id=auth.uid() and t.project_id=p_project_id and t.parent_task_id is null and t.status<>'cancelled'
    where t.id is null or x.status is null or x.status not in ('backlog','todo','in_progress','blocked','done') or x.sort_order is null or x.sort_order not between 0 and 100000
  ) or (select count(distinct x.id) from jsonb_to_recordset(p_order) x(id uuid))<>v_count
    or exists(select 1 from jsonb_to_recordset(p_order) x(status text,sort_order integer) group by status having count(distinct sort_order)<>count(*) or min(sort_order)<>0 or max(sort_order)<>count(*)-1)
  then raise exception 'Invalid board order'; end if;
  update public.tasks t set status=x.status,sort_order=x.sort_order
  from jsonb_to_recordset(p_order) x(id uuid,status text,sort_order integer)
  where t.id=x.id and t.user_id=auth.uid() and (t.status<>x.status or t.sort_order<>x.sort_order);
  return public.get_project_board(p_project_id);
end $$;

create function public.assign_project_task(p_task_id uuid,p_project_id uuid,p_expected_updated_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare v_task public.tasks;
begin
  if auth.uid() is null or (select auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then raise exception 'Admin role required'; end if;
  select * into v_task from public.tasks where id=p_task_id and user_id=auth.uid() for update;
  if not found or v_task.parent_task_id is not null then raise exception 'Main task not found'; end if;
  if v_task.updated_at is distinct from p_expected_updated_at then raise exception 'TASK_CONFLICT'; end if;
  if p_project_id is not null and not exists(select 1 from public.projects where id=p_project_id and user_id=auth.uid()) then raise exception 'Project not found'; end if;
  update public.tasks set project_id=p_project_id,sort_order=case when parent_task_id is null then
    coalesce((select max(sort_order)+1 from public.tasks where project_id=p_project_id and status=v_task.status and parent_task_id is null),0) else sort_order end
  where user_id=auth.uid() and (id=p_task_id or parent_task_id=p_task_id);
end $$;

create function public.save_project_task(p_task_id uuid,p_draft jsonb,p_subtasks jsonb,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid:=coalesce(p_task_id,gen_random_uuid()); v_task public.tasks; v_child jsonb; v_child_id uuid; v_project uuid:=(p_draft->>'project_id')::uuid;
begin
  if auth.uid() is null or (select auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then raise exception 'Admin role required'; end if;
  if p_draft->>'title' is null or char_length(trim(p_draft->>'title')) not between 1 and 240 then raise exception 'Task title required (maximum 240 characters)'; end if;
  if v_project is not null and not exists(select 1 from public.projects where id=v_project and user_id=auth.uid()) then raise exception 'Project not found'; end if;
  if p_task_id is not null then
    select * into v_task from public.tasks where id=p_task_id and user_id=auth.uid() for update;
    if not found or v_task.parent_task_id is not null then raise exception 'Main task not found'; end if;
    if v_task.updated_at is distinct from p_expected_updated_at then raise exception 'TASK_CONFLICT'; end if;
    update public.tasks set title=trim(p_draft->>'title'),description=nullif(trim(p_draft->>'description'),''),due_date=(p_draft->>'due_date')::date,
      priority=p_draft->>'priority',status=p_draft->>'status',estimate_minutes=(p_draft->>'estimate_minutes')::integer,
      blocked_reason=nullif(trim(p_draft->>'blocked_reason'),''),project_id=v_project,
      sort_order=case when project_id is distinct from v_project or status is distinct from p_draft->>'status' then
        coalesce((select max(t.sort_order)+1 from public.tasks t where t.project_id=v_project and t.status=p_draft->>'status' and t.parent_task_id is null),0) else sort_order end
    where id=v_id and user_id=auth.uid();
  else
    insert into public.tasks(id,user_id,title,description,due_date,priority,status,estimate_minutes,blocked_reason,project_id,sort_order)
    values(v_id,auth.uid(),trim(p_draft->>'title'),nullif(trim(p_draft->>'description'),''),(p_draft->>'due_date')::date,p_draft->>'priority',p_draft->>'status',
      (p_draft->>'estimate_minutes')::integer,nullif(trim(p_draft->>'blocked_reason'),''),v_project,
      coalesce((select max(sort_order)+1 from public.tasks where project_id=v_project and status=p_draft->>'status' and parent_task_id is null),0));
  end if;
  if p_subtasks is null or jsonb_typeof(p_subtasks)<>'array' or jsonb_array_length(p_subtasks)>200 then raise exception 'Invalid subtasks'; end if;
  if (select count(*) from jsonb_array_elements(p_subtasks) s where s->>'id' is not null) <>
    (select count(distinct s->>'id') from jsonb_array_elements(p_subtasks) s where s->>'id' is not null) then raise exception 'Duplicate subtask'; end if;
  -- Reject foreign or unrelated children before any delete can take effect.
  if exists(select 1 from jsonb_array_elements(p_subtasks) s where s->>'id' is not null and not exists(
    select 1 from public.tasks where id=(s->>'id')::uuid and user_id=auth.uid() and parent_task_id=v_id)) then raise exception 'Subtask not found'; end if;
  delete from public.tasks where parent_task_id=v_id and user_id=auth.uid() and id not in(
    select (s->>'id')::uuid from jsonb_array_elements(p_subtasks) s where s->>'id' is not null);
  for v_child in select * from jsonb_array_elements(p_subtasks) loop
    if v_child->>'title' is null or char_length(trim(v_child->>'title')) not between 1 and 240 then raise exception 'Subtask title required'; end if;
    v_child_id:=coalesce((v_child->>'id')::uuid,gen_random_uuid());
    insert into public.tasks(id,user_id,title,project_id,parent_task_id,status,is_completed,sort_order)
    values(v_child_id,auth.uid(),trim(v_child->>'title'),v_project,v_id,case when (v_child->>'is_completed')::boolean then 'done' else 'todo' end,coalesce((v_child->>'is_completed')::boolean,false),coalesce((v_child->>'sort_order')::integer,0))
    on conflict(id) do update set title=excluded.title,project_id=excluded.project_id,is_completed=excluded.is_completed,sort_order=excluded.sort_order;
  end loop;
  return v_id;
end $$;

create function public.delete_project_task(p_task_id uuid,p_expected_updated_at timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare v_task public.tasks;
begin
  if (select auth.jwt()->'app_metadata'->>'role') is distinct from 'admin' then raise exception 'Admin role required'; end if;
  select * into v_task from public.tasks where id=p_task_id and user_id=auth.uid() for update;
  if not found or v_task.parent_task_id is not null then raise exception 'Main task not found'; end if;
  if v_task.updated_at is distinct from p_expected_updated_at then raise exception 'TASK_CONFLICT'; end if;
  delete from public.tasks where parent_task_id=p_task_id and user_id=auth.uid();
  delete from public.tasks where id=p_task_id and user_id=auth.uid();
end $$;

create function public.create_project_note(p_project_id uuid,p_title text) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid:=gen_random_uuid();
begin
  if not exists(select 1 from public.projects where id=p_project_id and user_id=auth.uid()) then raise exception 'Project not found'; end if;
  insert into public.knowledge_notes(id,user_id,title,slug,content) values(v_id,auth.uid(),trim(p_title),'note-'||v_id::text,'');
  insert into public.knowledge_note_projects(user_id,note_id,project_id) values(auth.uid(),v_id,p_project_id);
  return v_id;
end $$;

create function public.reorder_project_links(p_project_id uuid,p_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.projects where id=p_project_id and user_id=auth.uid() for update;
  if not found then raise exception 'Project not found'; end if;
  if p_ids is null or cardinality(p_ids)<>(select count(*) from public.project_links where project_id=p_project_id and user_id=auth.uid())
    or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id)
    or exists(select 1 from unnest(p_ids) id where not exists(select 1 from public.project_links l where l.id=id and l.project_id=p_project_id and l.user_id=auth.uid())) then raise exception 'Link order changed; reload'; end if;
  update public.project_links l set sort_order=x.position-1,updated_at=clock_timestamp() from unnest(p_ids) with ordinality x(id,position) where l.id=x.id and l.user_id=auth.uid();
end $$;

revoke all on function public.track_project_state(), public.invalidate_project_board(), public.validate_project_subtask(),public.prevent_nested_subtasks(),public.delete_task_children() from public,anon,authenticated;
revoke all on function public.ensure_project_areas(),public.create_project_with_home_note(text,text,text,text,text,text,date,date,text,uuid),public.get_project_board(uuid),public.reorder_project_tasks(uuid,bigint,jsonb),public.assign_project_task(uuid,uuid,timestamptz),public.save_project_task(uuid,jsonb,jsonb,timestamptz),public.delete_project_task(uuid,timestamptz),public.create_project_note(uuid,text),public.reorder_project_links(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.ensure_project_areas(),public.create_project_with_home_note(text,text,text,text,text,text,date,date,text,uuid),public.get_project_board(uuid),public.reorder_project_tasks(uuid,bigint,jsonb),public.assign_project_task(uuid,uuid,timestamptz),public.save_project_task(uuid,jsonb,jsonb,timestamptz),public.delete_project_task(uuid,timestamptz),public.create_project_note(uuid,text),public.reorder_project_links(uuid,uuid[]) to authenticated;

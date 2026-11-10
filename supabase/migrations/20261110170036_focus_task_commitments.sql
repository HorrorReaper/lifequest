alter table public.focus_sessions
  add column committed_task_ids uuid[] not null default '{}'
  check (cardinality(committed_task_ids) <= 3);

create schema focus_internal;
revoke all on schema focus_internal from public, anon;
grant usage on schema focus_internal to authenticated;

-- Keep the privileged implementation outside the exposed API schema.
create function focus_internal.start_committed_focus_session(
  p_planned_minutes integer,
  p_task_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session public.focus_sessions%rowtype;
  v_task_count integer;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_planned_minutes is null or p_planned_minutes not between 1 and 240 then
    raise exception 'Focus duration must be between 1 and 240 minutes' using errcode = '22023';
  end if;
  if p_task_ids is null or cardinality(p_task_ids) not between 1 and 3
    or array_ndims(p_task_ids) <> 1 or array_lower(p_task_ids, 1) <> 1
    or (select count(distinct id) from unnest(p_task_ids) as selected(id)) <> cardinality(p_task_ids) then
    raise exception 'Choose one to three different tasks' using errcode = '22023';
  end if;

  -- Share the original timer's lock so overlapping starts preserve the first block.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  select * into v_session from public.focus_sessions
    where user_id = v_user and status = 'active' for update;
  if found then
    return to_jsonb(v_session);
  end if;

  select count(*) into v_task_count from (
    select id from public.tasks
    where id = any(p_task_ids) and user_id = v_user
      and not is_completed and status <> 'cancelled'
    for share
  ) as open_tasks;
  if v_task_count <> cardinality(p_task_ids) then
    raise exception 'Choose tasks that are still open and belong to you' using errcode = '42501';
  end if;

  insert into public.focus_sessions(user_id, task_id, planned_minutes, committed_task_ids)
    values (v_user, p_task_ids[1], p_planned_minutes, p_task_ids)
    returning * into v_session;
  return to_jsonb(v_session);
end;
$$;

revoke all on function focus_internal.start_committed_focus_session(integer, uuid[]) from public, anon;
grant execute on function focus_internal.start_committed_focus_session(integer, uuid[]) to authenticated;

create function public.start_committed_focus_session(p_planned_minutes integer, p_task_ids uuid[])
returns jsonb language sql security invoker set search_path = '' as $$
  select focus_internal.start_committed_focus_session(p_planned_minutes, p_task_ids);
$$;

revoke all on function public.start_committed_focus_session(integer, uuid[]) from public, anon;
grant execute on function public.start_committed_focus_session(integer, uuid[]) to authenticated;

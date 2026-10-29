-- Normal users may read their own timer. Writes go through server-timed RPCs;
-- the existing admin policy remains for compatibility with older clients.
create policy "Users read own focus sessions" on public.focus_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.start_focus_session(p_planned_minutes integer, p_task_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session public.focus_sessions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_planned_minutes is null or p_planned_minutes not between 1 and 240 then
    raise exception 'Focus duration must be between 1 and 240 minutes' using errcode = '22023';
  end if;
  if p_task_id is not null and not exists (select 1 from public.tasks where id = p_task_id and user_id = v_user) then
    raise exception 'Task not found' using errcode = '42501';
  end if;
  -- Serialize concurrent starts across tabs and resume instead of duplicating.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  select * into v_session from public.focus_sessions where user_id = v_user and status = 'active' for update;
  if not found then
    insert into public.focus_sessions(user_id, task_id, planned_minutes)
    values (v_user, p_task_id, p_planned_minutes) returning * into v_session;
  end if;
  return to_jsonb(v_session);
end;
$$;

create function public.finish_focus_session(p_session_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session public.focus_sessions%rowtype;
  v_ended timestamptz;
  v_seconds integer;
  v_award integer := 0;
  v_previous integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('completed', 'cancelled') then
    raise exception 'Invalid focus status' using errcode = '22023';
  end if;
  select * into v_session from public.focus_sessions where id = p_session_id and user_id = v_user for update;
  if not found then raise exception 'Focus session not found' using errcode = '42501'; end if;
  -- Lock the profile as well, so simultaneous XP increments cannot overwrite it.
  select coalesce(total_xp, 0) into v_previous from public.profiles where id = v_user for update;
  if not found then raise exception 'Profile not found' using errcode = '42501'; end if;
  if v_session.status <> 'active' then
    return jsonb_build_object('awarded', false, 'xpAwarded', 0, 'previousTotal', v_previous, 'newTotal', v_previous);
  end if;
  v_ended := clock_timestamp();
  v_seconds := least(2147483647, greatest(0, floor(extract(epoch from (v_ended - v_session.started_at)))))::integer;
  update public.focus_sessions set status = p_status, ended_at = v_ended, actual_seconds = v_seconds, updated_at = v_ended where id = v_session.id;
  if p_status = 'completed' and not exists (
    select 1 from public.xp_events where user_id = v_user and source_type = 'focus_session' and source_id = v_session.id
  ) then
    v_award := v_seconds / 60;
    if v_award > 0 then
      insert into public.xp_events(user_id, source_type, source_id, xp_amount, description)
      values (v_user, 'focus_session', v_session.id, v_award, format('Focused for %s minutes', v_award));
      update public.profiles set total_xp = v_previous + v_award where id = v_user;
    end if;
  end if;
  return jsonb_build_object('awarded', v_award > 0, 'xpAwarded', v_award, 'previousTotal', v_previous, 'newTotal', v_previous + v_award);
end;
$$;

revoke all on function public.start_focus_session(integer, uuid) from public, anon;
revoke all on function public.finish_focus_session(uuid, text) from public, anon;
grant execute on function public.start_focus_session(integer, uuid) to authenticated;
grant execute on function public.finish_focus_session(uuid, text) to authenticated;

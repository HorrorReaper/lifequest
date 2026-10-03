-- Tool days count edits, not only new entries.
--
-- challenge_rule_count's tool_entries rule looked at created_at, so a day
-- like "work on your goal breakdown" was only met by starting a new one. A
-- user who reworked the breakdown they already had did the step and was not
-- credited. Vision is unaffected (every save inserts a revision); Goal
-- Breakdown, Limiting Beliefs and Time Audit update rows in place and bump
-- updated_at (src/lib/tools/storage.ts updateToolEntry).
--
-- Only that branch changes; the rest is the function as it was.

create or replace function public.challenge_rule_count(
  p_user_id uuid,
  p_type text,
  p_param text,
  p_since date,
  p_timezone text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := coalesce(nullif(p_timezone, ''), 'Europe/Berlin');
  v_count integer := 0;
begin
  case p_type
    when 'habits_active' then
      select count(*)::integer into v_count
      from public.habits h
      where h.user_id = p_user_id and not h.is_archived;

    when 'habit_checkins' then
      select count(*)::integer into v_count
      from public.habit_logs hl
      where hl.user_id = p_user_id and hl.completed and hl.log_date >= p_since;

    when 'journal_entries' then
      select count(*)::integer into v_count
      from public.journal_entries je
      where je.user_id = p_user_id
        and je.is_complete
        and je.entry_date >= p_since
        and (p_param is null or je.template_id::text = p_param);

    when 'day_plans' then
      select count(*)::integer into v_count
      from public.day_plans dp
      where dp.user_id = p_user_id and dp.plan_date >= p_since;

    when 'tasks_created' then
      select count(*)::integer into v_count
      from public.tasks t
      where t.user_id = p_user_id
        and (t.created_at at time zone v_tz)::date >= p_since;

    when 'tasks_completed' then
      select count(*)::integer into v_count
      from public.tasks t
      where t.user_id = p_user_id
        and t.is_completed
        and t.completed_at is not null
        and (t.completed_at at time zone v_tz)::date >= p_since;

    when 'goals_active' then
      select count(*)::integer into v_count
      from public.goals g
      where g.user_id = p_user_id and g.status in ('active', 'completed');

    when 'learnings_captured' then
      select count(*)::integer into v_count
      from public.journal_learnings jl
      where jl.user_id = p_user_id
        and (jl.created_at at time zone v_tz)::date >= p_since;

    when 'tool_entries' then
      select count(*)::integer into v_count
      from public.tool_entries te
      where te.user_id = p_user_id
        and te.tool_id = p_param
        -- Saving a new entry or reworking an existing one both count.
        and (greatest(te.created_at, te.updated_at) at time zone v_tz)::date >= p_since;

    else
      v_count := 0;
  end case;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.challenge_rule_count(uuid, text, text, date, text) from public;
revoke all on function public.challenge_rule_count(uuid, text, text, date, text) from anon;
revoke all on function public.challenge_rule_count(uuid, text, text, date, text) from authenticated;

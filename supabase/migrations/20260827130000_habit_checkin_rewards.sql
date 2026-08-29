-- Habit check-ins write composite "habit_id:date" keys into source_id, so widen it to text.
alter table public.xp_events
  alter column source_id type text using source_id::text;

create unique index if not exists xp_events_habit_dedup_idx
  on public.xp_events (user_id, source_id)
  where source_type = 'habit';

create or replace function public.check_in_habit_reward(
  p_habit_id uuid,
  p_date date,
  p_xp integer,
  p_skill_category public.skill_category default null
)
returns table(total_xp integer, coins integer, awarded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_id text;
  v_inserted uuid;
  v_current_total_xp integer;
  v_current_coins integer;
  v_reward_coins integer := 3;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_source_id := p_habit_id::text || ':' || p_date::text;

  insert into public.xp_events (user_id, source_type, source_id, xp_amount, description, skill_category)
  values (v_user_id, 'habit', v_source_id, p_xp, 'Habit check-in', p_skill_category)
  on conflict (user_id, source_id) where source_type = 'habit' do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select coalesce(p.total_xp, 0) into v_current_total_xp
    from public.profiles p where p.id = v_user_id;
    select coalesce(cs.coins, 0) into v_current_coins
    from public.city_states cs where cs.user_id = v_user_id;
    total_xp := coalesce(v_current_total_xp, 0);
    coins := coalesce(v_current_coins, 0);
    awarded := false;
    return next;
    return;
  end if;

  update public.profiles p
  set total_xp = coalesce(p.total_xp, 0) + p_xp,
      updated_at = now()
  where p.id = v_user_id
  returning p.total_xp into v_current_total_xp;

  insert into public.city_states (user_id, coins)
  values (v_user_id, v_reward_coins)
  on conflict (user_id) do update
  set coins = public.city_states.coins + excluded.coins,
      updated_at = now()
  returning public.city_states.coins into v_current_coins;

  total_xp := v_current_total_xp;
  coins := v_current_coins;
  awarded := true;
  return next;
end;
$$;

create or replace function public.undo_habit_check_in_reward(
  p_habit_id uuid,
  p_date date
)
returns table(total_xp integer, coins integer, reversed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_id text;
  v_xp_amount integer;
  v_reward_coins integer := 3;
  v_current_total_xp integer;
  v_current_coins integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_source_id := p_habit_id::text || ':' || p_date::text;

  delete from public.xp_events
  where user_id = v_user_id
    and source_type = 'habit'
    and source_id = v_source_id
  returning xp_amount into v_xp_amount;

  if v_xp_amount is null then
    select coalesce(p.total_xp, 0) into v_current_total_xp
    from public.profiles p where p.id = v_user_id;
    select coalesce(cs.coins, 0) into v_current_coins
    from public.city_states cs where cs.user_id = v_user_id;
    total_xp := coalesce(v_current_total_xp, 0);
    coins := coalesce(v_current_coins, 0);
    reversed := false;
    return next;
    return;
  end if;

  update public.profiles p
  set total_xp = greatest(0, coalesce(p.total_xp, 0) - v_xp_amount),
      updated_at = now()
  where p.id = v_user_id
  returning p.total_xp into v_current_total_xp;

  update public.city_states cs
  set coins = greatest(0, coalesce(cs.coins, 0) - v_reward_coins),
      updated_at = now()
  where cs.user_id = v_user_id
  returning cs.coins into v_current_coins;

  total_xp := v_current_total_xp;
  coins := coalesce(v_current_coins, 0);
  reversed := true;
  return next;
end;
$$;

grant execute on function public.check_in_habit_reward(uuid, date, integer, public.skill_category) to authenticated;
grant execute on function public.undo_habit_check_in_reward(uuid, date) to authenticated;

create or replace function public.claim_system_quest_reward(p_quest_key text)
returns table(total_xp integer, coins integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_xp integer;
  v_reward_coins integer;
  v_title text;
  v_total_entries integer;
  v_best_streak integer;
  v_total_buildings integer;
  v_level integer;
  v_inserted integer;
  v_current_total_xp integer;
  v_current_coins integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::integer
    into v_total_entries
  from public.journal_entries je
  where je.user_id = v_user_id
    and je.is_complete = true;

  select coalesce(p.best_streak, 0), coalesce(p.total_xp, 0)
    into v_best_streak, v_current_total_xp
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  select count(*)::integer
    into v_total_buildings
  from public.city_buildings_placing cb
  where cb.user_id = v_user_id;

  v_level := 1;
  while v_current_total_xp >= (25 * v_level * v_level + 25 * v_level) loop
    v_level := v_level + 1;
  end loop;

  case p_quest_key
    when 'first_entry' then
      v_title := 'First Steps'; v_xp := 50; v_reward_coins := 20;
      if v_total_entries < 1 then raise exception 'Quest criteria not met'; end if;
    when 'streak_3' then
      v_title := 'On a Roll'; v_xp := 75; v_reward_coins := 30;
      if v_best_streak < 3 then raise exception 'Quest criteria not met'; end if;
    when 'first_building' then
      v_title := 'City Founder'; v_xp := 100; v_reward_coins := 50;
      if v_total_buildings < 1 then raise exception 'Quest criteria not met'; end if;
    when 'entries_10' then
      v_title := 'Dedicated Writer'; v_xp := 200; v_reward_coins := 100;
      if v_total_entries < 10 then raise exception 'Quest criteria not met'; end if;
    when 'streak_7' then
      v_title := 'Week Warrior'; v_xp := 150; v_reward_coins := 75;
      if v_best_streak < 7 then raise exception 'Quest criteria not met'; end if;
    when 'buildings_5' then
      v_title := 'Urban Planner'; v_xp := 200; v_reward_coins := 100;
      if v_total_buildings < 5 then raise exception 'Quest criteria not met'; end if;
    when 'level_5' then
      v_title := 'Rising Star'; v_xp := 300; v_reward_coins := 150;
      if v_level < 5 then raise exception 'Quest criteria not met'; end if;
    when 'entries_50' then
      v_title := 'Prolific Writer'; v_xp := 500; v_reward_coins := 250;
      if v_total_entries < 50 then raise exception 'Quest criteria not met'; end if;
    when 'streak_30' then
      v_title := 'Iron Will'; v_xp := 500; v_reward_coins := 250;
      if v_best_streak < 30 then raise exception 'Quest criteria not met'; end if;
    else
      raise exception 'Unknown quest key';
  end case;

  insert into public.quest_completions (user_id, quest_key, xp_awarded, coins_awarded)
  values (v_user_id, p_quest_key, v_xp, v_reward_coins)
  on conflict (user_id, quest_key) do nothing
  returning 1 into v_inserted;

  if v_inserted is null then
    select coalesce(p.total_xp, 0)
      into v_current_total_xp
    from public.profiles p
    where p.id = v_user_id;

    select coalesce(cs.coins, 0)
      into v_current_coins
    from public.city_states cs
    where cs.user_id = v_user_id;

    total_xp := coalesce(v_current_total_xp, 0);
    coins := coalesce(v_current_coins, 0);
    return next;
  end if;

  update public.profiles p
  set total_xp = coalesce(p.total_xp, 0) + v_xp,
      updated_at = now()
  where p.id = v_user_id
  returning p.total_xp into v_current_total_xp;

  insert into public.city_states (user_id, coins)
  values (v_user_id, v_reward_coins)
  on conflict (user_id) do update
  set coins = public.city_states.coins + excluded.coins,
      updated_at = now()
  returning public.city_states.coins into v_current_coins;

  insert into public.xp_events (user_id, source_type, source_id, xp_amount, description)
  values (v_user_id, 'quest', null, v_xp, 'Quest completed: ' || v_title);

  total_xp := v_current_total_xp;
  coins := v_current_coins;
  return next;
end;
$$;

create or replace function public.complete_custom_quest_reward(p_quest_id uuid)
returns table(total_xp integer, coins integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text;
  v_xp integer;
  v_reward_coins integer;
  v_current_total_xp integer;
  v_current_coins integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.quests q
  set is_completed = true,
      completed_at = now(),
      updated_at = now()
  where q.id = p_quest_id
    and q.user_id = v_user_id
    and q.is_completed = false
  returning q.title, q.xp_reward, q.coin_reward
  into v_title, v_xp, v_reward_coins;

  if not found then
    raise exception 'Quest not found or already completed';
  end if;

  update public.profiles p
  set total_xp = coalesce(p.total_xp, 0) + v_xp,
      updated_at = now()
  where p.id = v_user_id
  returning p.total_xp into v_current_total_xp;

  insert into public.city_states (user_id, coins)
  values (v_user_id, v_reward_coins)
  on conflict (user_id) do update
  set coins = public.city_states.coins + excluded.coins,
      updated_at = now()
  returning public.city_states.coins into v_current_coins;

  insert into public.xp_events (user_id, source_type, source_id, xp_amount, description)
  values (v_user_id, 'quest', p_quest_id, v_xp, 'Quest completed: ' || v_title);

  total_xp := v_current_total_xp;
  coins := v_current_coins;
  return next;
end;
$$;

create or replace function public.complete_lesson_reward(p_lesson_id text)
returns table(total_xp integer, coins integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text;
  v_xp integer;
  v_reward_coins integer;
  v_current_total_xp integer;
  v_current_coins integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  case p_lesson_id
    when 'daily-journaling' then
      v_title := 'The Power of Daily Journaling'; v_xp := 75; v_reward_coins := 30;
    when 'building-streaks' then
      v_title := 'Building Unbreakable Habits'; v_xp := 75; v_reward_coins := 30;
    when 'morning-vs-evening' then
      v_title := 'Morning vs. Evening Journaling'; v_xp := 100; v_reward_coins := 40;
    when 'mindful-goal-setting' then
      v_title := 'Mindful Goal Setting'; v_xp := 100; v_reward_coins := 40;
    when 'writers-block' then
      v_title := 'Overcoming Writer''s Block'; v_xp := 125; v_reward_coins := 50;
    else
      raise exception 'Unknown lesson id';
  end case;

  insert into public.lesson_completions (user_id, lesson_id, xp_awarded, coins_awarded)
  values (v_user_id, p_lesson_id, v_xp, v_reward_coins);

  update public.profiles p
  set total_xp = coalesce(p.total_xp, 0) + v_xp,
      updated_at = now()
  where p.id = v_user_id
  returning p.total_xp into v_current_total_xp;

  insert into public.city_states (user_id, coins)
  values (v_user_id, v_reward_coins)
  on conflict (user_id) do update
  set coins = public.city_states.coins + excluded.coins,
      updated_at = now()
  returning public.city_states.coins into v_current_coins;

  insert into public.xp_events (user_id, source_type, source_id, xp_amount, description)
  values (v_user_id, 'lesson', null, v_xp, 'Lesson completed: ' || v_title);

  total_xp := v_current_total_xp;
  coins := v_current_coins;
  return next;
end;
$$;

grant execute on function public.claim_system_quest_reward(text) to authenticated;
grant execute on function public.complete_custom_quest_reward(uuid) to authenticated;
grant execute on function public.complete_lesson_reward(text) to authenticated;

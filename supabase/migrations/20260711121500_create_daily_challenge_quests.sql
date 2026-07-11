alter table public.quests
  add column if not exists quest_type text not null default 'single',
  add column if not exists challenge_days integer,
  add column if not exists challenge_task text,
  add column if not exists challenge_start_date date;

alter table public.quests
  add constraint quests_quest_type_check
  check (quest_type in ('single', 'daily_challenge'));

alter table public.quests
  add constraint quests_daily_challenge_shape_check
  check (
    (
      quest_type = 'single'
      and challenge_days is null
      and challenge_task is null
      and challenge_start_date is null
    )
    or (
      quest_type = 'daily_challenge'
      and challenge_days between 1 and 365
      and nullif(trim(challenge_task), '') is not null
      and challenge_start_date is not null
    )
  );

create table if not exists public.quest_daily_logs (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (quest_id, log_date)
);

create index if not exists quest_daily_logs_user_date_idx
  on public.quest_daily_logs (user_id, log_date desc);

create index if not exists quest_daily_logs_quest_date_idx
  on public.quest_daily_logs (quest_id, log_date);

alter table public.quest_daily_logs enable row level security;

create policy "Users read own quest daily logs" on public.quest_daily_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert own quest daily logs through valid challenges" on public.quest_daily_logs
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.quests q
    where q.id = quest_daily_logs.quest_id
      and q.user_id = (select auth.uid())
      and q.quest_type = 'daily_challenge'
      and q.is_completed = false
  )
);

grant select on public.quest_daily_logs to authenticated;

create or replace function public.check_in_daily_challenge_quest(p_quest_id uuid, p_note text default null)
returns table(log_date date, completed_days integer, required_days integer, ready_to_complete boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_start date;
  v_required_days integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p.timezone, 'Europe/Berlin')
  into v_timezone
  from public.profiles p
  where p.id = v_user_id;

  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;

  select q.challenge_start_date, q.challenge_days
  into v_start, v_required_days
  from public.quests q
  where q.id = p_quest_id
    and q.user_id = v_user_id
    and q.quest_type = 'daily_challenge'
    and q.is_completed = false;

  if not found then
    raise exception 'Challenge not found or already completed';
  end if;

  if v_today < v_start or v_today > (v_start + (v_required_days - 1)) then
    raise exception 'Today is outside the challenge window';
  end if;

  insert into public.quest_daily_logs (quest_id, user_id, log_date, note)
  values (p_quest_id, v_user_id, v_today, nullif(trim(p_note), ''))
  on conflict (quest_id, log_date) do update
  set note = coalesce(excluded.note, public.quest_daily_logs.note)
  returning public.quest_daily_logs.log_date into log_date;

  select count(*)::integer
  into completed_days
  from public.quest_daily_logs qdl
  where qdl.quest_id = p_quest_id
    and qdl.user_id = v_user_id
    and qdl.log_date between v_start and (v_start + (v_required_days - 1));

  required_days := v_required_days;
  ready_to_complete := completed_days >= required_days;
  return next;
end;
$$;

revoke all on function public.check_in_daily_challenge_quest(uuid, text) from public;
revoke all on function public.check_in_daily_challenge_quest(uuid, text) from anon;
grant execute on function public.check_in_daily_challenge_quest(uuid, text) to authenticated;

create or replace function public.complete_custom_quest_reward(p_quest_id uuid)
returns table(total_xp integer, coins integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text;
  v_xp integer;
  v_reward_coins integer;
  v_current_total_xp integer;
  v_current_coins integer;
  v_quest_type text;
  v_challenge_days integer;
  v_challenge_start date;
  v_completed_days integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select q.title, q.xp_reward, q.coin_reward, q.quest_type, q.challenge_days, q.challenge_start_date
  into v_title, v_xp, v_reward_coins, v_quest_type, v_challenge_days, v_challenge_start
  from public.quests q
  where q.id = p_quest_id
    and q.user_id = v_user_id
    and q.is_completed = false
  for update;

  if not found then
    raise exception 'Quest not found or already completed';
  end if;

  if v_quest_type = 'daily_challenge' then
    select count(*)::integer
    into v_completed_days
    from public.quest_daily_logs qdl
    where qdl.quest_id = p_quest_id
      and qdl.user_id = v_user_id
      and qdl.log_date between v_challenge_start and (v_challenge_start + (v_challenge_days - 1));

    if v_completed_days < v_challenge_days then
      raise exception 'Daily challenge is not complete yet';
    end if;
  end if;

  update public.quests q
  set is_completed = true,
      completed_at = now(),
      updated_at = now()
  where q.id = p_quest_id
    and q.user_id = v_user_id;

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

revoke all on function public.complete_custom_quest_reward(uuid) from public;
revoke all on function public.complete_custom_quest_reward(uuid) from anon;
grant execute on function public.complete_custom_quest_reward(uuid) to authenticated;

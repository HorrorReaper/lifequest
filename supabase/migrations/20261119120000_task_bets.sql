-- Bets on tasks. See docs/features/planning-tasks-habits.md#task-bets.
--
-- A user stakes 1-20 coins that an open task with a due date gets done by
-- the end of that day, in their profile timezone. The stake leaves the coin
-- balance (city_states.coins) when the bet is placed. Done in time pays back
-- twice the stake; the day passing first, or the task being deleted, loses
-- it.
--
-- Everything that moves coins runs here, as security definer functions, so
-- the browser can only ask, never set a balance:
-- * place_task_bet: checks and places a bet, taking the stake.
-- * a trigger on tasks settles the bet the moment the task is completed.
-- * settle_task_bets: loses bets whose day has passed, and hands back each
--   settled bet once (seen_at) so the app can say how it went.
--
-- Against farming coins: one bet per task, ever (a reopened task cannot be
-- bet on again), and at most three new bets per local day. While a bet is
-- open the task's due date cannot change.

create table if not exists public.task_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Null once the task is deleted; the bet stays as a record, lost.
  task_id uuid references public.tasks (id) on delete set null,
  -- The title when the bet was placed, so a result can still name the task.
  task_title text not null check (char_length(task_title) <= 500),
  stake integer not null check (stake between 1 and 20),
  -- The task's due date when the bet was placed; the bet runs to its end.
  due_date date not null,
  -- The user's local day the bet was placed on, for the daily limit.
  created_day date not null,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  -- Coins paid back: twice the stake when won, 0 otherwise.
  payout integer not null default 0 check (payout >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  -- When the app reported the result; null while unreported.
  seen_at timestamptz
);

create unique index if not exists task_bets_one_per_task
  on public.task_bets (task_id) where task_id is not null;
create index if not exists task_bets_user_status_idx
  on public.task_bets (user_id, status);

alter table public.task_bets enable row level security;

drop policy if exists "Users read their own task bets" on public.task_bets;
create policy "Users read their own task bets"
  on public.task_bets for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.task_bets from anon;
revoke all on public.task_bets from authenticated;
grant select on public.task_bets to authenticated;

-- The user's calendar day in their profile timezone; UTC for an unknown one.
create or replace function public.task_bet_local_day(p_user uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select tz.name
       from public.profiles p
       join pg_catalog.pg_timezone_names tz on tz.name = p.timezone
      where p.id = p_user),
    'UTC'
  ))::date;
$$;

revoke all on function public.task_bet_local_day(uuid) from public;
revoke all on function public.task_bet_local_day(uuid) from anon;
revoke all on function public.task_bet_local_day(uuid) from authenticated;

-- Places a bet. Errors carry a code in the message ('bet:<reason>') the app
-- turns into words: stake, not_found, completed, due_date, already_bet,
-- daily_limit, coins.
create or replace function public.place_task_bet(p_task_id uuid, p_stake integer)
returns table(bet_id uuid, coins integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_task record;
  v_today date;
  v_count integer;
  v_coins integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_stake is null or p_stake < 1 or p_stake > 20 then
    raise exception 'bet:stake';
  end if;

  select t.id, t.title, t.due_date, t.is_completed
    into v_task
    from public.tasks t
   where t.id = p_task_id and t.user_id = v_user
   for update;
  if not found then
    raise exception 'bet:not_found';
  end if;
  if v_task.is_completed then
    raise exception 'bet:completed';
  end if;

  v_today := public.task_bet_local_day(v_user);
  if v_task.due_date is null or v_task.due_date < v_today then
    raise exception 'bet:due_date';
  end if;
  if exists (select 1 from public.task_bets b where b.task_id = p_task_id) then
    raise exception 'bet:already_bet';
  end if;

  select count(*) into v_count
    from public.task_bets b
   where b.user_id = v_user and b.created_day = v_today;
  if v_count >= 3 then
    raise exception 'bet:daily_limit';
  end if;

  select cs.coins into v_coins
    from public.city_states cs
   where cs.user_id = v_user
   for update;
  if coalesce(v_coins, 0) < p_stake then
    raise exception 'bet:coins';
  end if;

  update public.city_states cs
     set coins = cs.coins - p_stake, updated_at = now()
   where cs.user_id = v_user
  returning cs.coins into v_coins;

  insert into public.task_bets (user_id, task_id, task_title, stake, due_date, created_day)
  values (v_user, v_task.id, v_task.title, p_stake, v_task.due_date, v_today)
  returning id into v_id;

  return query select v_id, v_coins;
end;
$$;

revoke all on function public.place_task_bet(uuid, integer) from public;
revoke all on function public.place_task_bet(uuid, integer) from anon;
grant execute on function public.place_task_bet(uuid, integer) to authenticated;

-- Loses the user's bets whose day has passed, then returns every settled bet
-- not reported yet and marks it reported, with the balance after.
create or replace function public.settle_task_bets()
returns table(id uuid, task_id uuid, task_title text, stake integer, status text, payout integer, coins integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
  v_today date;
  v_coins integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  v_today := public.task_bet_local_day(v_user);

  update public.task_bets b
     set status = 'lost', settled_at = now()
   where b.user_id = v_user and b.status = 'open' and b.due_date < v_today;

  select coalesce(cs.coins, 0) into v_coins
    from public.city_states cs where cs.user_id = v_user;

  return query
  with reported as (
    update public.task_bets b
       set seen_at = now()
     where b.user_id = v_user and b.status <> 'open' and b.seen_at is null
    returning b.id, b.task_id, b.task_title, b.stake, b.status, b.payout, b.settled_at
  )
  select r.id, r.task_id, r.task_title, r.stake, r.status, r.payout, coalesce(v_coins, 0)
    from reported r
   order by r.settled_at;
end;
$$;

revoke all on function public.settle_task_bets() from public;
revoke all on function public.settle_task_bets() from anon;
grant execute on function public.settle_task_bets() to authenticated;

-- Completing a task settles its open bet at once: won on or before the due
-- day (twice the stake back), lost after it.
create or replace function public.settle_task_bet_on_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet record;
begin
  select b.id, b.stake, b.due_date
    into v_bet
    from public.task_bets b
   where b.task_id = new.id and b.status = 'open'
   for update;
  if not found then
    return null;
  end if;

  if public.task_bet_local_day(new.user_id) <= v_bet.due_date then
    update public.task_bets b
       set status = 'won', payout = v_bet.stake * 2, settled_at = now()
     where b.id = v_bet.id;
    insert into public.city_states (user_id, coins)
    values (new.user_id, v_bet.stake * 2)
    on conflict (user_id) do update
      set coins = public.city_states.coins + excluded.coins,
          updated_at = now();
  else
    update public.task_bets b
       set status = 'lost', settled_at = now()
     where b.id = v_bet.id;
  end if;
  return null;
end;
$$;

revoke all on function public.settle_task_bet_on_completion() from public;
revoke all on function public.settle_task_bet_on_completion() from anon;
revoke all on function public.settle_task_bet_on_completion() from authenticated;

drop trigger if exists tasks_settle_bet_on_completion on public.tasks;
create trigger tasks_settle_bet_on_completion
  after update on public.tasks
  for each row
  when (new.is_completed and not old.is_completed)
  execute function public.settle_task_bet_on_completion();

-- The due date is what the bet is on, so it holds while the bet is open.
create or replace function public.lock_task_bet_due_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.task_bets b where b.task_id = old.id and b.status = 'open') then
    raise exception 'bet:due_date_locked';
  end if;
  return new;
end;
$$;

revoke all on function public.lock_task_bet_due_date() from public;
revoke all on function public.lock_task_bet_due_date() from anon;
revoke all on function public.lock_task_bet_due_date() from authenticated;

drop trigger if exists tasks_lock_bet_due_date on public.tasks;
create trigger tasks_lock_bet_due_date
  before update on public.tasks
  for each row
  when (old.due_date is distinct from new.due_date)
  execute function public.lock_task_bet_due_date();

-- Deleting a task with an open bet loses it.
create or replace function public.lose_task_bet_on_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.task_bets b
     set status = 'lost', settled_at = now()
   where b.task_id = old.id and b.status = 'open';
  return old;
end;
$$;

revoke all on function public.lose_task_bet_on_delete() from public;
revoke all on function public.lose_task_bet_on_delete() from anon;
revoke all on function public.lose_task_bet_on_delete() from authenticated;

drop trigger if exists tasks_lose_bet_on_delete on public.tasks;
create trigger tasks_lose_bet_on_delete
  before delete on public.tasks
  for each row
  execute function public.lose_task_bet_on_delete();

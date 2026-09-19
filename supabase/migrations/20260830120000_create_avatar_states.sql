-- Avatar customization: a small, coin-funded feature independent of City.
-- See docs/superpowers/specs/2026-08-30-avatar-nature-redesign-design.md.
--
-- One row per user. `unlocked_item_ids` is the owned inventory (item ids
-- from the catalog in src/lib/avatar.ts); `equipped_items` maps each slot to
-- the item currently worn in it. The catalog itself -- cost, XP requirement,
-- which slot an item belongs to -- is not stored here: it is hard-coded into
-- unlock_avatar_item below, the same way claim_system_quest_reward hard-codes
-- its quest catalog, so pricing and eligibility can never be spoofed by a
-- client-supplied cost.
--
-- Equipping an already-unlocked item is a plain client-side update to
-- equipped_items and needs no RPC -- it moves no coins and only touches this
-- user's own row. It is not validated server-side against unlocked_item_ids;
-- the only consequence of writing an unowned id there is a client rendering
-- an item it didn't pay for to the user themselves, which is not worth a
-- trigger for a first version.
create table if not exists public.avatar_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  unlocked_item_ids text[] not null default '{}',
  equipped_items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.avatar_states enable row level security;

drop policy if exists "Users can read their own avatar state" on public.avatar_states;
create policy "Users can read their own avatar state"
on public.avatar_states
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own avatar state" on public.avatar_states;
create policy "Users can create their own avatar state"
on public.avatar_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own avatar state" on public.avatar_states;
create policy "Users can update their own avatar state"
on public.avatar_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.avatar_states to authenticated;

-- Atomically validates the XP threshold, checks and deducts coins from the
-- shared city_states balance (the same wallet City itself spends from), and
-- records the unlock. Returns the current state either way so a repeat call
-- for an already-owned item is a harmless no-op rather than an error.
create or replace function public.unlock_avatar_item(p_item_id text)
returns table(unlocked_item_ids text[], coins integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost integer;
  v_xp_required integer;
  v_current_xp integer;
  v_current_coins integer;
  v_already_unlocked boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  case p_item_id
    when 'trail-cap' then v_cost := 10; v_xp_required := 0;
    when 'sun-hat' then v_cost := 25; v_xp_required := 150;
    when 'winter-hood' then v_cost := 40; v_xp_required := 500;
    when 'rain-jacket' then v_cost := 15; v_xp_required := 0;
    when 'trail-vest' then v_cost := 30; v_xp_required := 150;
    when 'down-jacket' then v_cost := 50; v_xp_required := 500;
    when 'day-pack' then v_cost := 15; v_xp_required := 0;
    when 'hiking-pack' then v_cost := 35; v_xp_required := 300;
    when 'expedition-pack' then v_cost := 60; v_xp_required := 750;
    when 'trail-shoes' then v_cost := 10; v_xp_required := 0;
    when 'hiking-boots' then v_cost := 30; v_xp_required := 300;
    when 'expedition-boots' then v_cost := 55; v_xp_required := 750;
    else
      raise exception 'Unknown avatar item';
  end case;

  select coalesce(p.total_xp, 0) into v_current_xp
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_current_xp < v_xp_required then
    raise exception 'This item is not unlocked yet';
  end if;

  select exists(
    select 1 from public.avatar_states a
    where a.user_id = v_user_id and p_item_id = any(a.unlocked_item_ids)
  ) into v_already_unlocked;

  if v_already_unlocked then
    select a.unlocked_item_ids into unlocked_item_ids
    from public.avatar_states a
    where a.user_id = v_user_id;

    select coalesce(cs.coins, 0) into coins
    from public.city_states cs
    where cs.user_id = v_user_id;

    return next;
    return;
  end if;

  select coalesce(cs.coins, 0) into v_current_coins
  from public.city_states cs
  where cs.user_id = v_user_id;

  if coalesce(v_current_coins, 0) < v_cost then
    raise exception 'Not enough coins';
  end if;

  update public.city_states cs
  set coins = cs.coins - v_cost,
      updated_at = now()
  where cs.user_id = v_user_id
  returning cs.coins into coins;

  insert into public.avatar_states (user_id, unlocked_item_ids)
  values (v_user_id, array[p_item_id])
  on conflict (user_id) do update
  set unlocked_item_ids = array_append(public.avatar_states.unlocked_item_ids, p_item_id),
      updated_at = now()
  returning public.avatar_states.unlocked_item_ids into unlocked_item_ids;

  return next;
end;
$$;

grant execute on function public.unlock_avatar_item(text) to authenticated;

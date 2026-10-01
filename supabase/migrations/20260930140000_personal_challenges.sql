-- Personal challenges replace the "daily challenge" quest type.
--
-- There were two mechanisms for "several days, one check-in per calendar
-- day, reward at the end": daily-challenge quests (quests.quest_type =
-- 'daily_challenge' + quest_daily_logs) and challenge programs. This folds
-- the first into the second:
--
-- 1. A challenge template can be personal: created by a user for
--    themselves, never published, invisible to everyone else (admins
--    included, because a personal challenge can be as private as a journal
--    entry). Users create them with create_personal_challenge and remove
--    them with delete_personal_challenge.
-- 2. Every existing daily-challenge quest becomes a personal challenge with
--    its check-ins as completed days. A quest whose days were all logged but
--    whose reward was never claimed is completed and rewarded here, since
--    the button that would have claimed it goes away.
-- 3. quest_daily_logs, check_in_daily_challenge_quest and the quest_type /
--    challenge_* columns on quests are dropped. Quests are single goals now.
--
-- Rewards for personal challenges are set here, not by the user: 10 XP and
-- 5 coins per day.

-- ---------------------------------------------------------------------------
-- Personal templates
-- ---------------------------------------------------------------------------

alter table public.challenge_templates
  add column if not exists is_personal boolean not null default false;

alter table public.challenge_templates
  drop constraint if exists challenge_templates_personal_check;
alter table public.challenge_templates
  add constraint challenge_templates_personal_check
    check (not is_personal or (not is_published and slug is null));

create index if not exists challenge_templates_personal_owner_idx
  on public.challenge_templates (created_by)
  where is_personal;

-- Admins keep managing the shared catalogue, but no longer see or touch
-- anyone's personal challenges. Owners see theirs through the enrollment
-- clause, which every personal template has from the moment it is created.
drop policy if exists "Published challenges are readable" on public.challenge_templates;
create policy "Published challenges are readable" on public.challenge_templates
for select to authenticated
using (
  is_published
  or ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and not is_personal)
  or exists (
    select 1 from public.challenge_enrollments enrollment
    where enrollment.template_id = challenge_templates.id
      and enrollment.user_id = (select auth.uid())
  )
);

drop policy if exists "Admins create challenge templates" on public.challenge_templates;
create policy "Admins create challenge templates" on public.challenge_templates
for insert to authenticated
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and created_by = (select auth.uid())
  and not is_personal
);

drop policy if exists "Admins update challenge templates" on public.challenge_templates;
create policy "Admins update challenge templates" on public.challenge_templates
for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and not is_personal)
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and not is_personal);

drop policy if exists "Admins delete challenge templates" on public.challenge_templates;
create policy "Admins delete challenge templates" on public.challenge_templates
for delete to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and not is_personal);

drop policy if exists "Readable challenge days" on public.challenge_days;
create policy "Readable challenge days" on public.challenge_days
for select to authenticated
using (exists (
  select 1 from public.challenge_templates template
  where template.id = challenge_days.template_id
    and (
      template.is_published
      or ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and not template.is_personal)
      or exists (
        select 1 from public.challenge_enrollments enrollment
        where enrollment.template_id = template.id
          and enrollment.user_id = (select auth.uid())
      )
    )
));

drop policy if exists "Admins create challenge days" on public.challenge_days;
create policy "Admins create challenge days" on public.challenge_days
for insert to authenticated
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (select 1 from public.challenge_templates t where t.id = challenge_days.template_id and not t.is_personal)
);

drop policy if exists "Admins update challenge days" on public.challenge_days;
create policy "Admins update challenge days" on public.challenge_days
for update to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (select 1 from public.challenge_templates t where t.id = challenge_days.template_id and not t.is_personal)
)
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (select 1 from public.challenge_templates t where t.id = challenge_days.template_id and not t.is_personal)
);

drop policy if exists "Admins delete challenge days" on public.challenge_days;
create policy "Admins delete challenge days" on public.challenge_days
for delete to authenticated
using (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  and exists (select 1 from public.challenge_templates t where t.id = challenge_days.template_id and not t.is_personal)
);

-- ---------------------------------------------------------------------------
-- Creating and deleting a personal challenge
-- ---------------------------------------------------------------------------

create or replace function public.create_personal_challenge(
  p_title text,
  p_task text,
  p_days integer,
  p_description text default null,
  p_schedule_mode text default 'sequential'
)
returns table(template_id uuid, enrollment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
  v_title text := trim(coalesce(p_title, ''));
  v_task text := trim(coalesce(p_task, ''));
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_running integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if char_length(v_title) not between 1 and 120 then raise exception 'Give your challenge a title (up to 120 characters).'; end if;
  if char_length(v_task) not between 1 and 120 then raise exception 'Describe the daily action in up to 120 characters.'; end if;
  if v_description is not null and char_length(v_description) > 2000 then raise exception 'The description can be at most 2000 characters.'; end if;
  if p_days is null or p_days not between 1 and 365 then raise exception 'A challenge runs between 1 and 365 days.'; end if;
  if p_schedule_mode not in ('sequential', 'strict') then raise exception 'Invalid schedule mode'; end if;

  select count(*)::integer into v_running
  from public.challenge_templates t
  join public.challenge_enrollments e on e.template_id = t.id and e.status = 'active'
  where t.is_personal and t.created_by = v_user_id;
  if v_running >= 10 then
    raise exception 'You already have 10 personal challenges running. Finish or delete one first.';
  end if;

  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;

  insert into public.challenge_templates (
    created_by, title, description, duration_days, schedule_mode, xp_reward, coin_reward, is_published, is_personal
  ) values (
    v_user_id, v_title, v_description, p_days, p_schedule_mode, 10 * p_days, 5 * p_days, false, true
  ) returning id into template_id;

  insert into public.challenge_days (template_id, day_number, title, instructions)
  select template_id, day_number, v_task, v_task
  from generate_series(1, p_days) as day_number;

  insert into public.challenge_enrollments (template_id, user_id, start_date)
  values (template_id, v_user_id, v_today)
  returning id into enrollment_id;

  return next;
end;
$$;

revoke all on function public.create_personal_challenge(text, text, integer, text, text) from public;
revoke all on function public.create_personal_challenge(text, text, integer, text, text) from anon;
grant execute on function public.create_personal_challenge(text, text, integer, text, text) to authenticated;

-- Removes the challenge with its attempts and progress. XP already earned
-- stays, like it does for a deleted quest.
create or replace function public.delete_personal_challenge(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.challenge_templates
    where id = p_template_id and is_personal and created_by = v_user_id
  ) then
    raise exception 'Personal challenge not found';
  end if;

  delete from public.challenge_day_progress
  where enrollment_id in (select id from public.challenge_enrollments where template_id = p_template_id);
  delete from public.challenge_enrollments where template_id = p_template_id;
  delete from public.challenge_templates where id = p_template_id;
end;
$$;

revoke all on function public.delete_personal_challenge(uuid) from public;
revoke all on function public.delete_personal_challenge(uuid) from anon;
grant execute on function public.delete_personal_challenge(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Starting and restarting: published, or the owner's personal challenge
-- ---------------------------------------------------------------------------

create or replace function public.start_challenge_program(p_template_id uuid)
returns table(enrollment_id uuid, start_date date, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.challenge_templates t
    where t.id = p_template_id
      and (t.is_published or (t.is_personal and t.created_by = v_user_id))
  ) then
    raise exception 'Challenge is not available';
  end if;
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;

  select e.id, e.start_date, e.status
  into enrollment_id, start_date, status
  from public.challenge_enrollments e
  where e.template_id = p_template_id and e.user_id = v_user_id and e.status = 'active'
  limit 1;

  if enrollment_id is null then
    insert into public.challenge_enrollments (template_id, user_id, start_date)
    values (p_template_id, v_user_id, v_today)
    returning id, challenge_enrollments.start_date, challenge_enrollments.status
    into enrollment_id, start_date, status;
  end if;
  return next;
end;
$$;

revoke all on function public.start_challenge_program(uuid) from public;
revoke all on function public.start_challenge_program(uuid) from anon;
grant execute on function public.start_challenge_program(uuid) to authenticated;

create or replace function public.restart_challenge_program(p_template_id uuid)
returns table(enrollment_id uuid, start_date date, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_today date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.challenge_templates t
    where t.id = p_template_id
      and (t.is_published or (t.is_personal and t.created_by = v_user_id))
  ) then
    raise exception 'Challenge is not available';
  end if;
  select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = v_user_id;
  v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;

  update public.challenge_enrollments
  set status = 'abandoned', updated_at = now()
  where template_id = p_template_id and user_id = v_user_id and challenge_enrollments.status = 'active';

  insert into public.challenge_enrollments (template_id, user_id, start_date)
  values (p_template_id, v_user_id, v_today)
  returning id, challenge_enrollments.start_date, challenge_enrollments.status
  into enrollment_id, start_date, status;
  return next;
end;
$$;

revoke all on function public.restart_challenge_program(uuid) from public;
revoke all on function public.restart_challenge_program(uuid) from anon;
grant execute on function public.restart_challenge_program(uuid) to authenticated;

-- admin_save_challenge_template runs as a definer, so RLS does not stop it
-- from updating any template id it is handed. This trigger does: an admin
-- can never change someone else's personal challenge.
create or replace function public.admin_guard_personal_template()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_personal
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and old.created_by is distinct from (select auth.uid())
  then
    raise exception 'Personal challenges cannot be edited by admins';
  end if;
  return new;
end;
$$;

drop trigger if exists challenge_templates_guard_personal on public.challenge_templates;
create trigger challenge_templates_guard_personal
before update on public.challenge_templates
for each row execute function public.admin_guard_personal_template();

-- ---------------------------------------------------------------------------
-- Moving daily-challenge quests over
-- ---------------------------------------------------------------------------

do $$
declare
  q record;
  v_template_id uuid;
  v_enrollment_id uuid;
  v_timezone text;
  v_today date;
  v_end date;
  v_logged integer;
  v_status text;
  v_completed_at timestamptz;
  v_xp integer;
  v_coins integer;
  v_task text;
begin
  for q in
    select * from public.quests
    where quest_type = 'daily_challenge'
      and challenge_days between 1 and 365
      and challenge_start_date is not null
    order by created_at
  loop
    select coalesce(timezone, 'Europe/Berlin') into v_timezone from public.profiles where id = q.user_id;
    v_today := (now() at time zone coalesce(v_timezone, 'Europe/Berlin'))::date;
    v_end := q.challenge_start_date + (q.challenge_days - 1);
    v_task := left(coalesce(nullif(trim(q.challenge_task), ''), trim(q.title)), 120);
    v_xp := greatest(0, least(99999, coalesce(q.xp_reward, 0)));
    v_coins := greatest(0, least(99999, coalesce(q.coin_reward, 0)));

    select count(*)::integer into v_logged
    from public.quest_daily_logs l
    where l.quest_id = q.id and l.log_date between q.challenge_start_date and v_end;

    v_completed_at := null;
    if q.is_completed then
      v_status := 'completed';
      v_completed_at := coalesce(q.completed_at, now());
    elsif v_logged >= q.challenge_days then
      -- Every day was logged but the reward never claimed; claim it now.
      v_status := 'completed';
      v_completed_at := now();
      update public.profiles set total_xp = coalesce(total_xp, 0) + v_xp, updated_at = now() where id = q.user_id;
      insert into public.city_states (user_id, coins) values (q.user_id, v_coins)
      on conflict (user_id) do update set coins = public.city_states.coins + excluded.coins, updated_at = now();
      insert into public.xp_events (user_id, source_type, source_id, xp_amount, description)
      values (q.user_id, 'quest', q.id, v_xp, 'Quest completed: ' || q.title);
    elsif v_today > v_end then
      v_status := 'failed';
    else
      v_status := 'active';
    end if;

    insert into public.challenge_templates (
      created_by, title, description, duration_days, schedule_mode, xp_reward, coin_reward,
      is_published, is_personal, created_at, updated_at
    ) values (
      q.user_id, left(trim(q.title), 120), nullif(left(trim(coalesce(q.description, '')), 2000), ''),
      q.challenge_days, 'strict', v_xp, v_coins, false, true, q.created_at, now()
    ) returning id into v_template_id;

    insert into public.challenge_days (template_id, day_number, title, instructions)
    select v_template_id, day_number, v_task, v_task
    from generate_series(1, q.challenge_days) as day_number;

    insert into public.challenge_enrollments (template_id, user_id, start_date, status, completed_at, created_at, updated_at)
    values (v_template_id, q.user_id, q.challenge_start_date, v_status, v_completed_at, q.created_at, now())
    returning id into v_enrollment_id;

    insert into public.challenge_day_progress (enrollment_id, challenge_day_id, user_id, day_number, completed_on, note, created_at)
    select v_enrollment_id, d.id, q.user_id, logs.day_number, logs.log_date, left(nullif(trim(logs.note), ''), 2000), logs.created_at
    from (
      select l.log_date, l.note, l.created_at, row_number() over (order by l.log_date)::integer as day_number
      from public.quest_daily_logs l
      where l.quest_id = q.id and l.log_date between q.challenge_start_date and v_end
    ) logs
    join public.challenge_days d on d.template_id = v_template_id and d.day_number = logs.day_number;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retiring the quest variant
-- ---------------------------------------------------------------------------

delete from public.quests where quest_type = 'daily_challenge';

drop function if exists public.check_in_daily_challenge_quest(uuid, text);
drop table if exists public.quest_daily_logs;

-- Back to the plain version: no daily-challenge branch, no quest_daily_logs.
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select q.title, q.xp_reward, q.coin_reward
  into v_title, v_xp, v_reward_coins
  from public.quests q
  where q.id = p_quest_id
    and q.user_id = v_user_id
    and q.is_completed = false
  for update;

  if not found then
    raise exception 'Quest not found or already completed';
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

-- Dropping the columns drops the two check constraints built on them.
alter table public.quests
  drop column if exists challenge_start_date,
  drop column if exists challenge_task,
  drop column if exists challenge_days,
  drop column if exists quest_type;

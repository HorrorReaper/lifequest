-- Cover images for challenges and their days, shown like the article
-- covers on /learn: an image URL, rendered with next/image.
--
-- Only images.unsplash.com is allowed, the one host next.config.ts lets
-- next/image load. Any other host would make next/image throw while the page
-- renders, so the database refuses it rather than leave the editor to catch
-- it. Keep the pattern in step with src/lib/challenge-images.ts. A challenge
-- or day without an image shows a drawn placeholder instead.

alter table public.challenge_templates
  add column if not exists cover_image_url text;
alter table public.challenge_days
  add column if not exists image_url text;

alter table public.challenge_templates drop constraint if exists challenge_templates_cover_image_url_check;
alter table public.challenge_templates
  add constraint challenge_templates_cover_image_url_check
    check (
      cover_image_url is null
      or (char_length(cover_image_url) <= 500 and cover_image_url ~ '^https://images\.unsplash\.com/[^[:space:]]+$')
    );

alter table public.challenge_days drop constraint if exists challenge_days_image_url_check;
alter table public.challenge_days
  add constraint challenge_days_image_url_check
    check (
      image_url is null
      or (char_length(image_url) <= 500 and image_url ~ '^https://images\.unsplash\.com/[^[:space:]]+$')
    );

-- ---------------------------------------------------------------------------
-- Admin editor: one more parameter for the cover; day images travel in p_days
-- ---------------------------------------------------------------------------

-- Dropped rather than overloaded: two signatures that differ only in a
-- trailing defaulted parameter make named calls ambiguous.
drop function if exists public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb, text, text);

create or replace function public.admin_save_challenge_template(
  p_template_id uuid,
  p_title text,
  p_description text,
  p_schedule_mode text,
  p_xp_reward integer,
  p_coin_reward integer,
  p_is_published boolean,
  p_days jsonb,
  p_slug text default null,
  p_tagline text default null,
  p_cover_image_url text default null
)
returns uuid
language plpgsql
-- Definer so the participant check below sees every user's enrollments; as
-- invoker, RLS limited it to the admin's own and it never fired. The admin
-- test right below is therefore the whole gate.
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid := p_template_id;
  v_day_count integer;
  v_existing_count integer;
  v_has_enrollments boolean := false;
  v_item record;
  v_type text;
  v_param text;
begin
  if v_user_id is null or (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin role required';
  end if;
  if jsonb_typeof(p_days) <> 'array' then raise exception 'Challenge days must be an array'; end if;
  v_day_count := jsonb_array_length(p_days);
  if v_day_count < 1 or v_day_count > 365 then raise exception 'A challenge needs between 1 and 365 days'; end if;
  if p_schedule_mode not in ('sequential', 'strict') then raise exception 'Invalid schedule mode'; end if;

  for v_item in select value from jsonb_array_elements(p_days) as item(value) loop
    v_type := coalesce(nullif(trim(v_item.value ->> 'completion_type'), ''), 'manual');
    v_param := nullif(trim(v_item.value ->> 'completion_param'), '');
    if v_type = 'journal_entries' and v_param is not null
      and v_param !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Journal rule needs a valid template id';
    end if;
    if v_type = 'tool_entries' and v_param is null then
      raise exception 'Tool rule needs a tool';
    end if;
  end loop;

  if v_template_id is null then
    insert into public.challenge_templates (
      created_by, title, description, duration_days, schedule_mode, xp_reward, coin_reward, is_published, slug, tagline,
      cover_image_url
    ) values (
      v_user_id, trim(p_title), nullif(trim(p_description), ''), v_day_count, p_schedule_mode,
      p_xp_reward, p_coin_reward, p_is_published, nullif(lower(trim(p_slug)), ''), nullif(trim(p_tagline), ''),
      nullif(trim(p_cover_image_url), '')
    ) returning id into v_template_id;
  else
    select duration_days into v_existing_count from public.challenge_templates where id = v_template_id;
    if not found then raise exception 'Challenge template not found'; end if;
    v_has_enrollments := exists (select 1 from public.challenge_enrollments where template_id = v_template_id);
    if v_has_enrollments and v_day_count <> v_existing_count then
      raise exception 'This challenge already has participants. You can edit its days, but not add or remove them. Duplicate it to change its length.';
    end if;

    update public.challenge_templates
    set title = trim(p_title),
        description = nullif(trim(p_description), ''),
        duration_days = v_day_count,
        schedule_mode = p_schedule_mode,
        xp_reward = p_xp_reward,
        coin_reward = p_coin_reward,
        is_published = p_is_published,
        slug = nullif(lower(trim(p_slug)), ''),
        tagline = nullif(trim(p_tagline), ''),
        cover_image_url = nullif(trim(p_cover_image_url), ''),
        updated_at = now()
    where id = v_template_id;

    delete from public.challenge_days
    where template_id = v_template_id and challenge_days.day_number > v_day_count;
  end if;

  -- Upsert by position so progress rows (which point at day ids) survive an
  -- edit of a challenge people are already doing.
  insert into public.challenge_days (
    template_id, day_number, title, instructions, reflection_prompt,
    completion_type, completion_target, completion_param, action_href, action_label, image_url
  )
  select
    v_template_id,
    item.ordinality::integer,
    trim(item.value ->> 'title'),
    trim(item.value ->> 'instructions'),
    nullif(trim(item.value ->> 'reflection_prompt'), ''),
    coalesce(nullif(trim(item.value ->> 'completion_type'), ''), 'manual'),
    greatest(1, least(100, coalesce(nullif(item.value ->> 'completion_target', '')::integer, 1))),
    case
      when coalesce(nullif(trim(item.value ->> 'completion_type'), ''), 'manual') in ('journal_entries', 'tool_entries')
        then nullif(trim(item.value ->> 'completion_param'), '')
      else null
    end,
    nullif(trim(item.value ->> 'action_href'), ''),
    nullif(trim(item.value ->> 'action_label'), ''),
    nullif(trim(item.value ->> 'image_url'), '')
  from jsonb_array_elements(p_days) with ordinality as item(value, ordinality)
  on conflict (template_id, day_number) do update
  set title = excluded.title,
      instructions = excluded.instructions,
      reflection_prompt = excluded.reflection_prompt,
      completion_type = excluded.completion_type,
      completion_target = excluded.completion_target,
      completion_param = excluded.completion_param,
      action_href = excluded.action_href,
      action_label = excluded.action_label,
      image_url = excluded.image_url;

  return v_template_id;
end;
$$;

revoke all on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb, text, text, text) from public;
revoke all on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb, text, text, text) from anon;
grant execute on function public.admin_save_challenge_template(uuid, text, text, text, integer, integer, boolean, jsonb, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Public landing page: the cover and the day images are public too
-- ---------------------------------------------------------------------------

create or replace function public.get_public_challenge(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'slug', t.slug,
    'title', t.title,
    'tagline', t.tagline,
    'description', t.description,
    'duration_days', t.duration_days,
    'schedule_mode', t.schedule_mode,
    'xp_reward', t.xp_reward,
    'coin_reward', t.coin_reward,
    'cover_image_url', t.cover_image_url,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day_number', d.day_number, 'title', d.title, 'automatic', d.completion_type <> 'manual', 'image_url', d.image_url) order by d.day_number)
      from public.challenge_days d
      where d.template_id = t.id
    ), '[]'::jsonb)
  )
  from public.challenge_templates t
  where t.slug = lower(trim(p_slug)) and t.is_published
  limit 1;
$$;

revoke all on function public.get_public_challenge(text) from public;
grant execute on function public.get_public_challenge(text) to anon;
grant execute on function public.get_public_challenge(text) to authenticated;

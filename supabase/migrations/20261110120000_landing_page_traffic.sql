-- Traffic on the public landing page (/), for the admin Tools page.
-- See docs/features/landing-traffic.md.
--
-- Privacy shape, so the page needs no cookie banner:
--   * Nothing is stored on the visitor's device: no cookie, no local or
--     session storage.
--   * No IP address and no user agent is stored. The route
--     (src/app/api/landing-events/route.ts) hashes "IP|user agent" and sends
--     only that hash here; record_landing_event hashes it once more with a
--     salt that exists for one UTC day and is then deleted. What lands in
--     landing_events.visitor_hash therefore links one visitor's events within
--     a day and cannot be recomputed, or linked to another day, afterwards.
--   * The referrer is kept as a host name only (no path, no query), the UTM
--     tags as short labels, the device as one of four words.
--
-- Access: RLS is on and there are no policies, so nobody reads or writes
-- either table through the API. Events go in through record_landing_event
-- (security definer, executable by anon and service_role -- the two roles
-- the route can use); admins read only aggregates, through the two admin_
-- functions below, behind the same JWT app_metadata.role = admin test as
-- admin_signup_series.

create table if not exists public.landing_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null check (event in ('pageview', 'cta_click', 'waitlist_signup')),
  path text not null default '/' check (char_length(path) between 1 and 200),
  -- sha256 hex of (daily salt, route-side hash). See above.
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  referrer_host text check (referrer_host is null or char_length(referrer_host) between 1 and 120),
  utm_source text check (utm_source is null or char_length(utm_source) between 1 and 100),
  utm_medium text check (utm_medium is null or char_length(utm_medium) between 1 and 100),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) between 1 and 100),
  device text not null check (device in ('mobile', 'tablet', 'desktop', 'other')),
  -- Which call to action was used (hero, nav, sticky, pricing, ...).
  cta text check (cta is null or cta ~ '^[a-z0-9_-]{1,40}$')
);

alter table public.landing_events enable row level security;
revoke all on public.landing_events from anon, authenticated;

create index if not exists landing_events_created_at_idx
  on public.landing_events (created_at);

-- One random salt per UTC day. Only today's row is ever kept: the first
-- event of a new day creates the new salt and deletes the older ones.
create table if not exists public.landing_visitor_salts (
  day date primary key,
  salt text not null default (gen_random_uuid()::text || gen_random_uuid()::text)
);

alter table public.landing_visitor_salts enable row level security;
revoke all on public.landing_visitor_salts from anon, authenticated;

create or replace function public.record_landing_event(
  p_event text,
  p_fingerprint text,
  p_device text,
  p_path text default '/',
  p_referrer_host text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_cta text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_salt text;
  v_created integer;
begin
  -- The route already sends a sha256 hex string; anything else is not from it.
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid fingerprint' using errcode = '22023';
  end if;

  insert into public.landing_visitor_salts (day) values (v_day)
  on conflict (day) do nothing;
  get diagnostics v_created = row_count;
  if v_created > 0 then
    delete from public.landing_visitor_salts where day < v_day;
  end if;

  select s.salt into v_salt from public.landing_visitor_salts s where s.day = v_day;

  -- The check constraints hold the rest (event, device, cta, lengths).
  insert into public.landing_events (
    event, path, visitor_hash, referrer_host, utm_source, utm_medium, utm_campaign, device, cta
  ) values (
    p_event,
    coalesce(nullif(p_path, ''), '/'),
    encode(sha256(convert_to(v_salt || ':' || p_fingerprint, 'UTF8')), 'hex'),
    nullif(p_referrer_host, ''),
    nullif(p_utm_source, ''),
    nullif(p_utm_medium, ''),
    nullif(p_utm_campaign, ''),
    p_device,
    nullif(p_cta, '')
  );
end;
$$;

revoke all on function public.record_landing_event(text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.record_landing_event(text, text, text, text, text, text, text, text, text) from authenticated;
grant execute on function public.record_landing_event(text, text, text, text, text, text, text, text, text) to anon, service_role;

-- Per UTC day from p_since through today: page views, unique visitors,
-- CTA clicks and the visitors who clicked one, and waitlist signups.
-- Only days with at least one event are returned; the app fills the gaps
-- (src/lib/landing-analytics.ts).
create or replace function public.admin_landing_daily(p_since date)
returns table(
  day date,
  pageviews bigint,
  visitors bigint,
  cta_clicks bigint,
  cta_visitors bigint,
  signups bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    (e.created_at at time zone 'utc')::date as day,
    count(*) filter (where e.event = 'pageview')::bigint,
    count(distinct e.visitor_hash) filter (where e.event = 'pageview')::bigint,
    count(*) filter (where e.event = 'cta_click')::bigint,
    count(distinct e.visitor_hash) filter (where e.event = 'cta_click')::bigint,
    count(*) filter (where e.event = 'waitlist_signup')::bigint
  from public.landing_events e
  where e.created_at >= p_since::timestamp at time zone 'utc'
    and (select auth.uid()) is not null
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  group by 1
  order by 1;
$$;

revoke all on function public.admin_landing_daily(date) from public;
revoke all on function public.admin_landing_daily(date) from anon;
grant execute on function public.admin_landing_daily(date) to authenticated;

-- Where page views came from and on what, plus which CTA was clicked, over
-- the same range. At most 25 labels per dimension, largest first; a null
-- label means none (direct visit, no UTM tag). Because visitor_hash changes
-- every day, a distinct count over the range is the sum of daily visitors.
create or replace function public.admin_landing_breakdown(p_since date)
returns table(dimension text, label text, visitors bigint, events bigint)
language sql
security definer
set search_path = ''
as $$
  with scoped as (
    select e.*
    from public.landing_events e
    where e.created_at >= p_since::timestamp at time zone 'utc'
      and (select auth.uid()) is not null
      and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  ),
  grouped as (
    select 'referrer'::text as dimension, referrer_host as label,
      count(distinct visitor_hash) as visitors, count(*) as events
    from scoped where event = 'pageview' group by referrer_host
    union all
    select 'utm_source', utm_source, count(distinct visitor_hash), count(*)
    from scoped where event = 'pageview' group by utm_source
    union all
    select 'utm_campaign', utm_campaign, count(distinct visitor_hash), count(*)
    from scoped where event = 'pageview' group by utm_campaign
    union all
    select 'device', device, count(distinct visitor_hash), count(*)
    from scoped where event = 'pageview' group by device
    union all
    select 'cta', cta, count(distinct visitor_hash), count(*)
    from scoped where event = 'cta_click' group by cta
  ),
  ranked as (
    select g.*, row_number() over (partition by g.dimension order by g.visitors desc, g.events desc, g.label) as rank
    from grouped g
  )
  select r.dimension, r.label, r.visitors::bigint, r.events::bigint
  from ranked r
  where r.rank <= 25
  order by r.dimension, r.rank;
$$;

revoke all on function public.admin_landing_breakdown(date) from public;
revoke all on function public.admin_landing_breakdown(date) from anon;
grant execute on function public.admin_landing_breakdown(date) to authenticated;

-- Web push for the evening review reminder. See docs/features/push-notifications.md.
--
-- One row per browser/device that a user has opted in from Settings. The
-- row holds only what the Web Push protocol needs to reach that browser:
-- the push service endpoint and the two public keys the browser generated.
-- No user agent, no IP, no device name.
--
-- Users read and delete their own rows through RLS. Saving goes through
-- save_push_subscription, because an endpoint belongs to one browser, and
-- the same browser can be signed in to a different account later: the
-- function moves the endpoint to whoever is signed in now instead of
-- failing on the unique index against a row RLS hides from them.
--
-- Sending (src/app/api/push/test/route.ts, and the scheduled reminder
-- that follows) happens on the server with the private VAPID key; it reads
-- rows as the signed-in user for the test, and with the service role for
-- the scheduled reminder.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique
    check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now(),
  -- Set when a push was accepted by the push service, for spotting dead rows.
  last_sent_at timestamptz
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read their own push subscriptions" on public.push_subscriptions;
create policy "Users read their own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own push subscriptions" on public.push_subscriptions;
create policy "Users delete their own push subscriptions"
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users mark their own push subscriptions sent" on public.push_subscriptions;
create policy "Users mark their own push subscriptions sent"
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant update (last_sent_at) on public.push_subscriptions to authenticated;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        created_at = now(),
        last_sent_at = null;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text) from public;
revoke all on function public.save_push_subscription(text, text, text) from anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

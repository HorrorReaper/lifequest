# Push notifications

Web push for two reminders: the morning reminder to plan the day (the Daily Plan ritual, `/plan`) and the evening review reminder. A user turns each on per device in Settings; the reminders themselves are sent by the server.

Opting in, the service worker, a test notification and both scheduled reminders exist. Reminders only go out once a scheduler calls the reminder route (see [Scheduler](#scheduler)).

## Opting in

`src/components/settings/PushReminderCard.tsx` is the Notifications card on `/settings`, shown to every user:

- Two switches, "Morning planning reminder" and "Evening review reminder", each for the browser it is flipped in only. Each phone or computer opts in on its own, and to each reminder on its own.
- Turning one on (`enablePush(reminder)` in `src/lib/push-client.ts`) asks for notification permission (from the tap, as browsers require), registers `/sw.js`, subscribes with the VAPID public key if the browser has no subscription yet, and stores it with `save_push_subscription(…, p_reminder)`, which adds that reminder to the device's row. A subscription this call created and could not store is undone, so a switch never shows on for a device the server does not know; one the other reminder already uses stays.
- Turning one off while the other is on (`disableReminder`) only clears its column. Turning off the last one deletes the row and unsubscribes the browser (`disablePush`).
- The switches read the device's row (`readReminders`): both show off while the browser has no subscription, no permission, or no row (another account took the endpoint over since).
- Onboarding offers the same two reminders on its "Should we remind you?" screen and subscribes the ones left on through `enablePush` when Continue is tapped (see [Onboarding](./core-app.md#onboarding)); the screen is skipped where push is unavailable.
- Devices opted in before the morning reminder existed have the evening review on and the morning reminder off.
- While either is on, "Send test notification" calls `POST /api/push/test`, which pushes "Notifications work. …" to every device the user has opted in. Tapping it opens `/dashboard`.
- The switch reads as on only when the browser has a subscription and permission is `granted`.

States the card explains instead of showing the switch:

| Situation | Card shows |
| --- | --- |
| iPhone or iPad Safari outside an installed home-screen app | How to use "Add to Home Screen"; web push only exists there for installed apps (iOS 16.4+) |
| No service worker, `PushManager` or `Notification` API | "This browser does not support notifications." |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` not set | The switch is disabled with "Push notifications are not configured on the server yet." |
| Permission denied | How to allow notifications in the browser or system settings |

## Service worker

`public/sw.js` handles push only: no caching and no offline shell. On `push` it shows the payload's `title` and `body` with `/icons/icon-192.png`, and replaces an earlier notification with the same `tag`. On `notificationclick` it focuses an open LifeQuest window and navigates it, or opens a new one. Only a path on the site is opened; anything else falls back to `/dashboard` (`safeNotificationPath` in `src/lib/push-subscription.ts`, mirrored in the worker). `next.config.ts` serves `/sw.js` with `Cache-Control: no-cache, no-store, must-revalidate` and a `default-src 'self'` CSP, so a changed worker reaches browsers that have the old one.

The manifest's `/icons/icon-192.png` and `/icons/icon-512.png` now exist, generated from `public/logo.svg` on the manifest's dark background. Installing to an iPhone home screen needs them.

## The scheduled reminders

`/api/push/reminders` (`src/app/api/push/reminders/route.ts`) is called every 15 minutes. It calls `claim_daily_plan_reminders` and `claim_evening_review_reminders` with the service role, sends each returned device its payload, deletes devices the push service reports gone and sets `last_sent_at` on the rest. Whatever one claim returned is sent even when the other claim fails, because a claimed reminder is not claimed again that day; the route then answers `500`. `/api/push/evening-review` re-exports the same handlers, so a scheduler set up before this route existed keeps working.

| Reminder | Payload | Opens | Tag |
| --- | --- | --- | --- |
| Daily Plan | "Plan your day" (`dailyPlanPayload`) | `/plan` | `daily-plan` |
| Evening review | "Time for your evening review" (`eveningReviewPayload`) | `/journal/new/<template>` | `evening-review` |

### Morning: the Daily Plan

A user is due when all of these hold:

- They have at least one device with the morning reminder on.
- The `daily_plan` ritual in `ritual_settings` is enabled and has a reminder time (`reminder_minutes`, "Push reminder at" on `/admin/rituals`, 08:00 by default). The prompt's own "From" time is midnight, so the push needs a time of its own; an empty reminder time sends no morning push.
- In their profile timezone, the reminder time was within the last 120 minutes. An unknown timezone counts as UTC.
- Today's plan is not committed: no `day_plans` row for their local today whose planner metadata has `ritual_completed_at` set, the same test as the dashboard prompt. A plan note that cannot be read counts as not committed.
- They were not reminded for that local day yet.

The dashboard holds the Daily Plan prompt back on Mondays while the Weekly Plan is open; the push does not, and reminds about the daily plan regardless.

### Evening: the evening review

A user is due when all of these hold:

- They have at least one device with the evening review reminder on.
- The `evening_review` ritual in `ritual_settings` is enabled and has a template (`/admin/rituals`).
- In their profile timezone, the window opened (`from_minutes`, 20:00 by default) within the last 120 minutes, on the ritual's weekday if one is set. An unknown timezone counts as UTC, as in the app.
- They have no complete journal entry with that template for their local today, which is the same test as the dashboard prompt.
- They were not reminded for that local day yet.

Each claim records each due user in `push_reminder_log` (per ritual) in the same statement that selects them, so overlapping runs cannot remind anyone twice a day. With a 15-minute schedule the evening reminder arrives between 20:00 and 20:15 local time, the morning one between 08:00 and 08:15. Someone who opts in later in the evening still gets a reminder within two hours of the window opening, but not after.

Deliberate simplifications:

- A send that fails is not retried that day; a late or doubled reminder is worse than a missed one.
- On a Sunday the dashboard shows the Weekly Review before the Evening Review (the hold-back rule in `docs/notes/rituale-und-prompts.md`). The push does not follow that rule and reminds about the evening review regardless.
- The texts are fixed English copy, not the rituals' editable titles.

### Scheduler

Vercel's Hobby plan runs crons only once a day, so the schedule lives in Supabase (`pg_cron` and `pg_net`). Run this once in the Supabase SQL editor, with the app's production URL and the same value as `CRON_SECRET` in Vercel. It is not a migration because it contains a secret and a deployment URL:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<CRON_SECRET>', 'push_cron_secret');

select cron.schedule(
  'evening-review-push',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<production-domain>/api/push/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    )
  );
  $$
);
```

A job created with `/api/push/evening-review` keeps working; to move it to the new address, `select cron.alter_job((select jobid from cron.job where jobname = 'evening-review-push'), command := …)` with the command above.

`select * from cron.job_run_details order by start_time desc limit 10;` shows recent runs; `net._http_response` holds the route's answers. `select cron.unschedule('evening-review-push');` stops it. On Vercel Pro, a `vercel.json` cron with the same schedule works too: Vercel sends a GET with `Authorization: Bearer <CRON_SECRET>`, which the route accepts.

The route answers `401` without the right secret, `503` while `CRON_SECRET`, the VAPID variables or the Supabase secret key are missing, `500` if a claim fails, and otherwise `200` with `{ users, sent, removed, failed }`.

## Sending

`src/lib/push-server.ts` sends with the `web-push` package and the VAPID key pair. Each push has a one-hour TTL (a reminder that arrives the next morning is worse than none) and uses the payload `tag` as the push topic. A push service answering 404 or 410 has dropped the subscription; the caller deletes that row. Other failures are logged.

Payload (JSON), as `public/sw.js` reads it:

```json
{ "title": "LifeQuest", "body": "…", "url": "/journal/new/<template>", "tag": "evening-review" }
```

## Data

Migration `supabase/migrations/20261115120000_push_subscriptions.sql` adds `push_subscriptions` (one row per opted-in browser: push service endpoint, the browser's `p256dh` and `auth` keys, `created_at`, `last_sent_at`) and `save_push_subscription`. `20261115130000_evening_review_reminders.sql` adds `push_reminder_log` (user, ritual, local day) and `claim_evening_review_reminders`. `20261118120000_daily_plan_reminders.sql` adds the per-reminder columns `evening_review` and `daily_plan` to `push_subscriptions` (a row needs at least one on), the four-argument `save_push_subscription`, `ritual_settings.reminder_minutes` and `claim_daily_plan_reminders`, and limits the evening claim to devices with the evening review on. See [Data model](../backend/data-model.md) and [Authentication, authorization, and privacy](../backend/auth-security.md#push-notifications).

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser and server | Subscribing and signing |
| `VAPID_PRIVATE_KEY` | Server only | Signing pushes |
| `VAPID_SUBJECT` | Server only | Contact for push services, `mailto:` or `https:` |
| `CRON_SECRET` | Server only | Shared secret the scheduler sends as a bearer token |
| `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) | Server only | Lets the reminder route read every user's devices |

Generate a key pair with `npx web-push generate-vapid-keys`. Changing the pair invalidates every stored subscription; users then have to turn reminders off and on again.

## Testing locally

Push needs a secure context. `localhost` counts as one in Chrome and Firefox; Safari needs HTTPS (`next dev --experimental-https`). The migration must be applied to the Supabase project the dev server uses.

## Tests

- `src/lib/push-subscription.test.ts`: subscription parsing, key decoding, safe notification paths, gone statuses.
- `src/lib/push-server.test.ts`: VAPID configuration, payload and options, gone/failed classification.
- `src/app/api/push/test/route.test.ts`: auth, origin check, missing configuration, no devices, cleanup of dropped subscriptions.
- `src/app/api/push/reminders/route.test.ts`: cron secret, missing configuration, both claims and their payloads, GET from Vercel Cron, one claim failing while the other's reminders still go out, the old address.
- `scripts/verify-push-reminders.mjs`: the three migrations against an in-memory PostgreSQL (PGlite): RLS on devices, moving a shared endpoint, per-reminder switches (adding one, a row needing one on, a moved browser starting over), who is due in the evening (window, timezone fallback, finished review, evening switch off) and in the morning (reminder time, committed plan, unreadable plan note, no reminder time), no second reminder the same day, disabled ritual, and that only the service role may claim. Run with `LIFEQUEST_PGLITE_MODULE` pointing at a separately installed `@electric-sql/pglite`.
- `src/components/settings/PushReminderCard.test.tsx`: each switch on its own, off with the other still on and off for the last one, denied, state read from the server, iOS install hint, unsupported browser, missing key.
- `src/components/admin/RitualsHub.test.tsx` and `src/lib/rituals.test.ts`: the Daily Plan's reminder time in the admin form and in `normalizeRitualSettings`.

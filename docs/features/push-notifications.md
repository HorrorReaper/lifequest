# Push notifications

Web push for the evening review reminder. A user turns it on per device in Settings; the reminder itself is sent by the server.

Status: the opt-in, the service worker, device storage and a test notification exist. The scheduled reminder when the evening review window opens is **not built yet**; until it is, a device that opts in only receives test notifications.

## Opting in

`src/components/settings/PushReminderCard.tsx` is the Notifications card on `/settings`, shown to every user:

- The switch "Evening review reminder" applies to the browser it is flipped in only. Each phone or computer opts in on its own.
- Turning it on (`enablePush` in `src/lib/push-client.ts`) asks for notification permission (from the tap, as browsers require), registers `/sw.js`, subscribes with the VAPID public key and stores the subscription with `save_push_subscription`. A subscription that cannot be stored is undone, so the switch never shows on for a device the server does not know.
- Turning it off (`disablePush`) deletes the row and unsubscribes the browser.
- When on, "Send test notification" calls `POST /api/push/test`, which pushes "Notifications work. …" to every device the user has opted in. Tapping it opens `/dashboard`.
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

## Sending

`src/lib/push-server.ts` sends with the `web-push` package and the VAPID key pair. Each push has a one-hour TTL (a reminder that arrives the next morning is worse than none) and uses the payload `tag` as the push topic. A push service answering 404 or 410 has dropped the subscription; the caller deletes that row. Other failures are logged.

Payload (JSON), as `public/sw.js` reads it:

```json
{ "title": "LifeQuest", "body": "…", "url": "/journal/new/<template>", "tag": "evening-review" }
```

## Data

Migration `supabase/migrations/20261115120000_push_subscriptions.sql` adds `push_subscriptions` (one row per opted-in browser: push service endpoint, the browser's `p256dh` and `auth` keys, `created_at`, `last_sent_at`) and `save_push_subscription`. See [Data model](../backend/data-model.md) and [Authentication, authorization, and privacy](../backend/auth-security.md#push-notifications).

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser and server | Subscribing and signing |
| `VAPID_PRIVATE_KEY` | Server only | Signing pushes |
| `VAPID_SUBJECT` | Server only | Contact for push services, `mailto:` or `https:` |

Generate a key pair with `npx web-push generate-vapid-keys`. Changing the pair invalidates every stored subscription; users then have to turn reminders off and on again.

## Testing locally

Push needs a secure context. `localhost` counts as one in Chrome and Firefox; Safari needs HTTPS (`next dev --experimental-https`). The migration must be applied to the Supabase project the dev server uses.

## Tests

- `src/lib/push-subscription.test.ts`: subscription parsing, key decoding, safe notification paths, gone statuses.
- `src/lib/push-server.test.ts`: VAPID configuration, payload and options, gone/failed classification.
- `src/app/api/push/test/route.test.ts`: auth, origin check, missing configuration, no devices, cleanup of dropped subscriptions.
- `src/components/settings/PushReminderCard.test.tsx`: on, off, denied, already subscribed, iOS install hint, unsupported browser, missing key.

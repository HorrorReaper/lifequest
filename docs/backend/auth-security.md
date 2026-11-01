# Authentication, authorization, and privacy

## Authentication

LifeQuest uses Supabase Auth with cookie-backed SSR sessions.

Supported entry flows include:

- Email/password sign-in and sign-up.
- Google OAuth.
- Password reset (`resetPasswordForEmail` from `/login`, completed at `/reset-password`).
- Email/OAuth/recovery callback at `/auth/callback`.

The callback exchanges the code, ensures a profile exists, and routes the user to onboarding, the dashboard, or an explicit `next` target (used by the password-reset link to land on `/reset-password`).

`next` is attacker-controllable input, since it comes straight from the URL. `src/lib/auth-redirect.ts` (`safeNextPath`) only accepts a same-origin absolute path and rejects protocol-relative values such as `//evil.com` or the `/\evil.com` variant browsers normalize into one, so the callback cannot be turned into an open redirect.

`/reset-password` itself requires a live Supabase session (the one the recovery link establishes). Without one it redirects to `/login?error=reset_link_invalid`; it does not accept or validate a token directly.

## Session middleware

`src/proxy.ts` applies Supabase session handling to every authenticated route group:

- `/dashboard`, `/dashboard2`
- `/admin`
- `/journal`
- `/plan`
- `/city`
- `/settings`
- `/routines`
- `/onboarding`
- `/tasks`
- `/habits`
- `/quests`
- `/learn`, `/learnings`
- `/analytics`
- `/api`

A route left out of this matcher does not get its Supabase session refreshed (an expired access token sends the user to `/login` even though the refresh token is still valid) and the onboarding gate does not apply to it. Any new top-level authenticated route must be added here.

The middleware:

1. Refreshes Supabase cookies when needed.
2. Redirects an unauthenticated protected request to `/login`.
3. Loads the profile for authenticated users.
4. Redirects incomplete profiles to `/onboarding`.

Public short-circuits are `/`, `/login`, `/auth/callback`, `/api/waitlist`, and `/api/landing-events`. The two API routes are listed because `/api/:path*` is in the proxy matcher; without the entry an anonymous visitor's request would be redirected to `/login`.

Server pages and route handlers still call `auth.getUser()` themselves. Middleware is routing/session support, not the only authorization control.

## Admin concepts

LifeQuest has two separate admin checks.

### Route admin

`isAdminUser` returns true for:

- `app_metadata.role === "admin"`, or
- Email in the server-only `ADMIN_EMAILS`, or
- User ID in the server-only `ADMIN_USER_IDS`.

This permits access to the admin shell during development or recovery.

### Trusted admin

A trusted admin has:

```text
user.app_metadata.role = admin
```

This JWT claim is used by Supabase RLS, protected RPCs, `admin_app_stats`, workout/nutrition storage, and all nutrition food APIs.

The distinction is intentional:

```text
Route allowlist
  └── can render /admin

Trusted app_metadata role
  ├── can render /admin
  ├── passes protected RLS
  ├── can call protected RPCs
  └── can use nutrition provider APIs
```

Never use `user_metadata` for authorization because users can modify it.

## Setting the trusted claim

Use a privileged Supabase administration channel:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where email = 'patrick@example.com';
```

The user must sign out and back in so a new JWT includes the claim.

## Row Level Security

Expected policy patterns:

- Personal rows: authenticated user can access only rows whose `user_id = auth.uid()`.
- Profile: user can access only the profile whose `id = auth.uid()`.
- System journal templates: authenticated users can read; browser mutation is denied.
- System exercises: trusted admins can read them alongside their own custom exercises; browser mutation is denied.
- Admin domains: both ownership and trusted admin claim are required.
- Foreign user IDs supplied by the browser are rejected by policy.
- Write-only inbox: `beta_feedback` lets a user insert rows with their own `user_id` and has no select policy, so feedback cannot be read back through the API, even by its author. The trusted-admin function `admin_beta_feedback` is the only reader, and `admin_activation_funnel` returns counts only. The funnel is derived from existing tables on purpose: an event log would have meant a second copy of activity, and task titles, journal text or free answers must not end up in analytics.


Security Invoker functions execute under the caller's role and should perform explicit ownership/claim checks before mutation.

## Supabase keys

### Publishable key

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is intentionally available to the browser. It is safe only when every exposed table/function has correct RLS and grants.

### Secret/service-role key

`SUPABASE_SECRET_KEY` or the legacy service-role fallback is used in `DELETE /api/account`. `SUPABASE_SERVICE_ROLE_KEY` is also preferred, when set, by `createPublicRouteClient` (`src/lib/supabase/public-route-client.ts`) for `/api/waitlist` and `/api/landing-events`, which otherwise fall back to the publishable key.

Rules:

- Never prefix it with `NEXT_PUBLIC_`.
- Never import it into a Client Component.
- Never include it in logs, screenshots, fixtures, or documentation examples.
- Never use it to bypass RLS for normal feature code.

## Server-only providers

The browser never receives:

- OpenRouter API key.
- USDA API key.
- Supabase secret/service-role key.

Open Food Facts does not require a secret, but requests still go through the server to apply normalization, identification, timeout, and user-agent behavior consistently.

## AI privacy

The contextual chatbot is:

- Admin-only.
- Disabled until the user explicitly enables it.
- Blocked unless `ai_consent_at` is recorded.

The server can send bounded recent task, habit, and journal context to OpenRouter. This should be clearly disclosed in the Settings consent copy.

The model returns a structured decision. The server validates available action types and ownership before applying an action.

## Account deletion

Deletion requires:

- Current authenticated session.
- Same-origin request when an Origin header is present.
- Exact email confirmation.
- A server-only Supabase Admin credential.

The route globally signs out the user, then deletes the Auth user. Database cleanup depends on foreign-key cascade policies in the deployed schema.

## Data stored in the browser

| Storage | Data |
| --- | --- |
| `sessionStorage` | Mobile journal drafts; Today Plan drafts |
| `localStorage` | Knowledge note drafts; theme-related browser preference where applicable |
| React memory | Unsaved active-workout set values |
| Auth cookies | Supabase session tokens managed by SSR helpers |

These drafts can contain sensitive personal text. Do not move them into shared analytics, logs, or error reports.

The landing-page traffic tracker stores nothing in the browser (see below).

## Landing-page traffic

The landing page counts visits without cookies, browser storage or a third party, so it needs no consent banner ([Landing-page traffic](../features/landing-traffic.md)). The boundaries:

- **No IP or user agent at rest.** `/api/landing-events` and `/api/waitlist` hash `IP|user agent` with SHA-256 in the route and send only the hash. `record_landing_event` hashes it again with a salt that exists for one UTC day and is deleted when the next day's salt is created. Once the salt is gone, the stored `visitor_hash` cannot be recomputed from an address, and hashes from different days cannot be linked.
- **Minimal fields.** Referrer host only, short UTM labels, a four-value device bucket, a CTA name. No full URL, screen data, language or location.
- **Opt-out respected.** Global Privacy Control and `Do Not Track: 1` stop the tracker in the browser.
- **No direct table access.** `landing_events` and `landing_visitor_salts` have RLS on and no policies, and `anon`/`authenticated` have no table privileges. Writes go through `record_landing_event` (security definer, executable by `anon` and `service_role` only), reads through `admin_landing_daily` and `admin_landing_breakdown`, which return counts to a trusted admin and nothing to anyone else.
- **Why `anon` may execute the insert function.** The route uses the publishable key until `SUPABASE_SERVICE_ROLE_KEY` is set. Someone could therefore call `record_landing_event` directly and skip the route's bot filter and rate limit; the function still enforces the event list, field lengths and hash format, and can only add rows, never read them. Once the service-role key is set in every environment, revoking `anon` execute closes that path.

## Security review checklist

Before shipping a new feature:

1. Identify public, authenticated, route-admin, and trusted-admin surfaces.
2. Add ownership filters in queries and RLS.
3. Protect global system records from mutation.
4. Keep provider credentials server-side.
5. Validate every route parameter/body.
6. Use an RPC for multi-table reward or integrity-critical writes.
7. Test unauthenticated, non-admin, foreign-user, and duplicate-submit cases.
8. Run Supabase Security and Performance Advisors after migrations.
9. Confirm no secret appears in the browser bundle.

## Projects ownership

Areas, links and the project overview preserve the current trusted-admin boundary. Table policies require both `auth.uid() = user_id` and `app_metadata.role = admin`; new tables revoke anonymous access and explicitly grant authenticated CRUD. Composite owner foreign keys prevent linking to another owner's project or area. The summary view uses `security_invoker=true`, and mutation RPCs run as the caller. Checklists reject foreign parents, cycles, nesting and mismatched project families. No normal-user access is enabled by this release. Knowledge return links accept only local project routes; external/protocol-relative redirect targets are rejected.

Contact profiles and all association tables require owner plus trusted app_metadata.role=admin, with explicit authenticated grants and no anonymous RPC execution. Contacts are independent of Auth accounts and are not added to AI context. Policies, composite ownership FKs and invoker mutations apply even when a route allowlist admits someone to the admin shell.

## Admin Academy

With `20261029191235_learning_academy.sql` applied, the three course learner RPCs require a signed-in trusted `app_metadata.role = admin`. Their renamed implementations are not executable by public/anon/authenticated roles. A user-editable metadata claim cannot grant access. UI routes additionally use `showAdminUi` so normal-user preview keeps the original article Library. Legacy article rewards and Toolbox access are unchanged. Without the migration, the previous authenticated course-RPC grants remain; the frontend filter alone is not a database boundary.

Unpublished local progress/reflections are keyed by authenticated user ID and never replace synchronized published progress. This isolates account display, not same-origin scripts. Studio preview snapshots contain curriculum only, use session storage and never write learner results. See `../features/learning-paths.md`.

## Metrics access

After `20261101120000_create_standalone_metrics.sql`, `metrics` and `metric_values` have four policies each (select, insert, update, delete) `to authenticated` with `(select auth.uid()) = user_id`, and authenticated CRUD grants; anonymous roles have none. The insert and update checks on `metric_values` also require that the metric belongs to the same user, so a value cannot be attached to someone else's metric even with the caller's own `user_id`. `metric_legacy_fields` has RLS enabled, no policies and all privileges revoked. `public.backfill_metric_values()` is `security definer` with `search_path = public` and executable only by the migration role (execute revoked from `public`, `anon` and `authenticated`). Checked by `scripts/verify-standalone-metrics.mjs`.

## Focus timer access

`start_committed_focus_session` is an authenticated invoker wrapper for the implementation in the non-exposed `focus_internal` schema. The implementation uses an empty search path, checks `auth.uid()`, and accepts only one to three distinct open tasks owned by the caller. Commitment IDs inherit the session's owner-only read policy.

After `20261029203006_library_focus_timer.sql`, signed-in users may SELECT only their own `focus_sessions`. Normal users have no direct INSERT/UPDATE/DELETE policy. `start_focus_session` and `finish_focus_session` intentionally use `SECURITY DEFINER` with an empty search path, fully qualified tables, `auth.uid()` ownership checks, validated inputs, and EXECUTE limited to authenticated callers (revoked from PUBLIC and anon). A task from another user cannot be linked; another user's timer cannot be closed. Client-supplied elapsed time, XP and owner IDs are never accepted. Locks make starts/resumes and completed rewards idempotent across tabs; XP failure rolls back closure so the user can retry. The existing trusted-admin own-row write policy remains for compatibility. Toolbox access does not grant access to admin routes.

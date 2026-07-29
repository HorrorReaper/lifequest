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

Public short-circuits are `/`, `/login`, `/auth/callback`, and `/api/waitlist`.

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

Security Invoker functions execute under the caller's role and should perform explicit ownership/claim checks before mutation.

## Supabase keys

### Publishable key

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is intentionally available to the browser. It is safe only when every exposed table/function has correct RLS and grants.

### Secret/service-role key

`SUPABASE_SECRET_KEY` or the legacy service-role fallback is used only in `DELETE /api/account`.

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

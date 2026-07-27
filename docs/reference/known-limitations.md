# Known constraints and technical debt

This is an honest description of the current application, not a promise that every item must be fixed immediately.

## Database reproducibility

- The visible migrations are additive feature migrations, not the complete original schema.
- Foundational tables such as `tasks` and `day_plans` are used but their creation migrations are not in the current repository history.
- `database.types.ts` mixes generated-style definitions with handwritten `MutableTable` mappings.
- `tasks` and `day_plans` are not represented as complete mappings in the main `Database` table map.

Impact: a new Supabase project cannot be recreated safely from this repository alone.

Recommended direction: export/reconstruct the production base schema, commit a verified baseline, then regenerate types.

## Sequential multi-table writes

The following flows are not fully atomic:

- Journal submission and all of its task/habit/day-plan/XP/streak side effects.
- Routine item replacement.
- City building placement plus coin deduction.
- Saved meal/recipe definition creation.
- Imported food upsert plus portion replacement.
- Ordinary task XP read/check/event/profile update.

Impact: a failure between writes can leave a partial result.

Recommended direction: move integrity-critical flows into ownership-checking database functions with idempotency keys where appropriate.

## Admin authorization split

The admin shell accepts server allowlists, while protected RLS/RPCs and nutrition APIs require `app_metadata.role=admin`.

Impact: an allowlisted user can enter `/admin` but receive database permission errors.

This is secure by default, but the setup is easy to misunderstand. Prefer the trusted claim for normal admin operation and keep allowlists as a recovery/development mechanism.

## Date and timezone consistency

- Habits and planning generally use the profile timezone.
- Task date-only helpers avoid UTC shifts.
- Journal home recommendations currently hard-code `Europe/Berlin`.
- Journal entry submission derives some date state from an ISO/UTC date.

Impact: users outside Berlin can see a recommendation or entry date that differs from their profile-local day near midnight.

Recommended direction: centralize all user date keys around the profile IANA timezone.

## Waitlist persistence

`POST /api/waitlist` validates and logs a signup but does not save it to `waitlist_signups` or an email provider.

Impact: waitlist submissions are not durable.

## Password recovery

The login UI does not currently provide a complete password-reset flow.

## PWA/offline behavior

- A web manifest exists.
- Referenced `/icons/icon-192.png` and `/icons/icon-512.png` files are missing.
- There is no service worker or offline application shell.
- Browser drafts and local food history provide limited resilience, but most features require Supabase connectivity.

Impact: install behavior may have incomplete icons, and the application is not generally usable offline.

## Testing gaps

- No end-to-end browser test framework is configured.
- RLS/security tests are not automated in the repository.
- Barcode and food-import route handlers lack dedicated route tests.
- The full journal multi-table submission pipeline is not integration-tested.
- Deployment smoke tests are manual.

## Observability

There is no dedicated error-monitoring, tracing, product analytics, or alerting integration in the repository.

Impact: failures are primarily found through browser, Vercel, Supabase, and provider logs.

## Analytics route

`/analytics` redirects to `/dashboard`. General analytics components remain in the repository but are not exposed as a finished page.

## Experimental duplicate surfaces

- `/landing2` and `/dashboard2` remain available beside canonical versions.
- `src/lib/city.ts` and `src/lib/city/city.ts` both contain city-related logic.

Impact: behavior can drift and future contributors may update the wrong implementation.

## Knowledge scaling

The knowledge hub loads a bounded note collection for rich client-side filtering/linking.

Impact: large vaults will eventually require server-side search, pagination, or indexing.

## Third-party provider limits

- USDA requires configuration and is disabled without a key.
- Open Food Facts data quality and coverage vary.
- Provider responses can change.
- The application has per-request timeouts but no dedicated application-level provider rate limiter or cache layer.

Local foods remain the resilience path.

## Browser capability differences

- Workout sound/vibration depends on permission, user interaction, and device support.
- Camera barcode scanning depends on secure context, camera permission, and browser compatibility.
- Manual barcode entry remains necessary.

## Product scope constraints

These are intentional current boundaries:

- Workouts and nutrition are admin-only.
- Habits are daily and binary.
- Journal and Today Plan drafts do not sync between devices.
- Admin work does not award XP/coins.
- Workout social features and licensed media are excluded.
- Nutrition excludes water, meal planning, full micronutrients, and health integrations.


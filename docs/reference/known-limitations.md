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

All date keys now come from `src/lib/dates.ts`. The journal landing page and journal entry submission were moved onto the profile timezone, and a date picker bug that stored the previous day for every user east of Greenwich was fixed.

Quests were brought in line as well. Both challenge surfaces used to compute "today" from the browser while the RPCs behind them resolve it from the profile timezone, so the UI could enable a check-in the server then rejected as outside the window, or report a strict streak as broken while the server still accepted the day. `/quests` now resolves the day server-side and passes it down, and the two computations live in `src/lib/challenges.ts` as pure, unit-tested functions.

Tasks followed. `TaskList`/`TaskManager` now receive the day as a required prop, `tomorrowDateKey` was deleted in favour of `addDays(today, 1)`, and `taskViewForDate`, `filterTasks`, and `countTaskViews` take the day as a **required** argument instead of defaulting to `localDateKey()`. The default was the actual hazard: it let any caller reintroduce the browser day without saying so.

Every user-facing surface now resolves the day from the profile timezone on the server and passes it down as a date key.

Note also that the migrations fall back to `Europe/Berlin` when a profile has no timezone while the application falls back to `UTC`. `profiles.timezone` is non-null in the generated types, so neither fallback should fire; if the base schema is ever reconstructed (see *Database reproducibility* above), make the two agree.

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

Impact: behavior can drift and future contributors may update the wrong implementation.

`src/lib/city.ts` and `src/lib/city/city.ts` used to duplicate the entire building catalog and XP/unlock logic — the dashboard's "next unlock" preview read one copy while `/city` read the other, so an edit to one would silently desync from the other. Resolved by moving the "next unlock" display itself onto `/city` (`NextUnlockCard`, next to the building picker it's describing) and deleting `src/lib/city.ts`; every consumer now reads `src/lib/city/city.ts`.

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


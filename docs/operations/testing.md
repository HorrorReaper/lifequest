# Testing and quality checks

## Test stack

- Vitest 4.
- jsdom.
- React Testing Library.
- `@testing-library/user-event`.
- TypeScript strict mode.
- Next.js Core Web Vitals ESLint configuration.

Vitest configuration lives in `vitest.config.ts` and maps `@` to `src`.

## Standard verification

Run from the repository root:

```bash
npm run test
npx tsc --noEmit
npm run lint
git diff --check
npm run build
```

Recommended order:

1. Targeted tests while developing.
2. Full unit/component suite.
3. TypeScript.
4. ESLint.
5. Whitespace/diff validation.
6. Production build.

The build is the final framework-level integration check, not a substitute for tests.

## Targeted Vitest usage

Run one file:

```bash
npx vitest run src/lib/today-plan.test.ts
```

Run matching files:

```bash
npx vitest run src/components/admin/workouts
```

Run one test name:

```bash
npx vitest run -t "flushes dirty sets"
```

## Current automated coverage

Focus Timer checks cover the required selection of one to three existing tasks, duplicate submission, full-screen setup, saved task titles on resume, the closing controls at zero, return to setup, and retry behavior. `scripts/verify-focus-timer.mjs` runs isolated PostgreSQL checks for ownership, commitment order, server time, closing expired blocks, the XP cap, duplicate rewards, cancellation, transactional rollback, and anonymous denial. Its XP event source ID uses the same text type as the hosted database. Run with a separately installed PGlite module URL in `LIFEQUEST_PGLITE_MODULE`. The script reads no environment files and never connects to Supabase.

The repository currently contains 32 test files.

### Auth

- Timezone option list always includes the active/stored zone, including one absent from the runtime-supported set (`src/lib/timezones.test.ts`).
- Auth callback redirect-target validation rejects protocol-relative and backslash-normalized open-redirect payloads (`src/lib/auth-redirect.test.ts`).

### Planning, tasks, and habits

- Day-plan normalization.
- Today Plan calculations and UI, including the plan editor (save state, save failure keeps edits, block problems in words) and which mode `/plan` opens in (`TodayPlanner.test.tsx`, `TodayPlanScreen.test.tsx`). The priorities step is covered there too: choosing, changing and removing through the picker dialog, a required main focus, one task per role, creating a task without a due date and linking it into the saved blocks, a failed create keeping the dialog open, focus back on the row, and restored drafts. The picker's inline list is in `TaskCombobox.test.tsx`, due labels in `today-plan.test.ts` (`describeTaskDue`). The timeline step is covered in `TodayPlanner.test.tsx`: five steps without the anchors step and the way back without losing or duplicating anything, a changed priority following its block, habits kept flexible versus given a time block (one anchor and one block however often confirmed, back to flexible, removed from today only), done habits hidden until "Show completed", a general block saved as a plain block linked to nothing, reflection templates told apart, the day hours dialog (errors at the field, Cancel, blocks left outside marked and kept), the reminder switched off, the capacity line (overlaps counted once, time outside the day apart), folded free time, the block editor (nothing before Apply, the later blocks it would move, keeping them in place), one save per double tap, a failed final save keeping the plan and draft, and drafts restored on their step, including old six-step drafts. Step resolution is in `planner-steps.test.ts`; segments, `firstFreeStart`, `describeRipple`, anchor helpers and priority-block sync in `today-plan.test.ts`.
- Dashboard plan status: a block that is over is never reported as done while its linked task is open (`src/lib/dashboard-plan.test.ts`, `TodayPlanSection.test.tsx`). The next-up card's states are covered in `src/lib/dashboard-plan.test.ts` (tasks due without a plan, planned-task progress, habits before reflections, an unwritten reflection, a finished journal, the evening review once no block is running or ahead, with or without a plan, `durationFigure`) and `src/components/dashboard/NextUpCard.test.tsx` (time-first layout for a running task and an upcoming reflection, the habit ring and chips, tasks due, a planned task left open, reflection open and done, the evening review with what is still open).
- Dashboard greeting: the time-of-day opening and its boundaries (05:00, 12:00, 18:00), the Trail heading style, the fallback without a name or time, the hero scene growing one stage per `STAGE_STEP_MS` during the walk-in and never past today's, the finished scene at once under reduced motion, the pause button stopping the walk and being remembered on the next visit, the avatar's legs and arms inside the stride, the stride and the brisk walk-in strides timed so a planted foot moves as fast as the path drifts past (within 2%), its spoken progress line (`src/components/dashboard/DashboardGreeting.test.tsx`), the avatar drawing one boot on each leg so boots move with the legs (`src/components/profile/AvatarFigure.test.tsx`), and the progress rule with its stage thresholds, the evening review counted only when switched on, and no more done than there is (`src/lib/day-progress.test.ts`).
- Task grouping, sorting, helpers, compact list, and editor: Today/Tomorrow/Choose date/No date, one submit per double tap, and the calendar layer sitting on the popover's positioned wrapper (`TaskEditorDialog.test.tsx`).
- Habit mutations, analytics, manager behavior, and editor (single named check-in control, details folded away on create).
- Onboarding: three steps, no age question, a real task and a linked block, and no duplicates on back, reload or double tap (`onboarding-flow.test.tsx`, `src/lib/onboarding.test.ts`).
- Feedback and activation helpers (`src/lib/activation.test.ts`).
- Landing-page traffic: event validation, referrer reduction, bot pattern and device buckets (`src/lib/landing-events.test.ts`); `/api/landing-events` status codes, the hashed payload without IP or user agent, bot/prefetch drops and the rate limit (`src/app/api/landing-events/route.test.ts`); the `waitlist_signup` event in `/api/waitlist` (`src/app/api/waitlist/route.test.ts`); series, funnel and breakdown aggregation (`src/lib/landing-analytics.test.ts`); tracker opt-out (`src/lib/landing-tracker.test.ts`); the admin card (`src/components/admin/LandingTraffic.test.tsx`).


### Journal

- Journaling streak: the transition on a new entry, milestone bonuses and the celebration (`src/lib/streak.test.ts`); the displayed streak, shown as stored while the next entry would continue it and as 0 once a missed day has broken it, with "today" in the profile timezone (`displayedStreak`, `streakFromProfile` in the same file); the top bar's streak (`src/lib/shell-stats.test.ts`) and `fetchProfileStreak` (`src/lib/profile-streak.test.ts`). That an edited entry earns no XP and leaves the streak alone is in the submit handler of `entry-form.tsx` and is not covered by an automated test.
- Mobile step construction/navigation.
- Mobile wizard validation and state preservation.
- Dirty close/discard behavior.

### Workout

- Exercise dataset migration invariants.
- Workout utility calculations.
- Analytics and personal-record calculations.
- Exercise filtering/library behavior.
- Active workout save/finish behavior.

### Nutrition

- Nutrient and recipe calculations.
- Provider food normalization/deduplication.
- Tracker migration assumptions.
- Diary utility behavior.
- Food search and diary interactions.
- External search route behavior.

### Knowledge and projects

- Wiki-link parsing.
- Markdown rendering.
- Knowledge migration assumptions.
- Project progress metrics.

Automated coverage is meaningful but not complete. Barcode/import route handlers, the complete journal submission pipeline, RLS, and browser-to-Supabase integration still need stronger automated coverage.

## Database and RLS verification

Run database checks against a non-production Supabase project populated with:

- A trusted admin.
- A route-allowlisted user without the trusted claim.
- A normal user.
- A second foreign user.
- Global system exercises/templates.

Verify:

1. Each user can access only owned rows.
2. Normal and allowlist-only users cannot access admin tracker data.
3. System exercises/templates are readable where expected and immutable.
4. Multi-table RPCs reject foreign IDs.
5. Reward RPCs remain idempotent under repeated calls.
6. Only one active workout can exist per user.
7. Saved meal/recipe logs are all-or-nothing.

After schema changes, run Supabase Security and Performance Advisors.

## Manual authenticated QA

Minimum viewport matrix:

| Viewport | Focus |
| --- | --- |
| 390×844 | Small mobile, keyboard, bottom safe area |
| 430×932 | Larger mobile |
| 768px | Tablet breakpoint and journal desktop transition |
| 1440px | Desktop density and admin sidebar |

Test in white, system, and dark themes.

### Critical user flows

- Register/sign in, password reset, onboarding, refresh, sign out.
- Commit and recover a Today Plan.
- Create/edit/complete/reopen/defer/delete tasks.
- Create/edit/reorder/check/history/archive/restore habits.
- Complete a mobile and desktop journal entry.
- Recover and discard a journal draft.
- Claim a quest/lesson reward exactly once.
- Claim journal city rewards and place a building.
- Change timezone and verify date-keyed features.
- Delete an account in a test environment.

### Critical admin flows

- Confirm allowlist warning versus trusted claim.
- Start/resume/finish/discard workouts.
- Exercise filters and all six tracking modes.
- Dirty-set retry, supersets, timer, history, analytics, plate calculation.
- Food search under full success, partial provider failure, and offline conditions.
- Barcode manual fallback, import, portions, quick add, edit, move/copy.
- Saved meal and recipe logging.
- Knowledge draft recovery, wiki links, conflict handling, and version restore.
- Project create/home note, task board/list, milestones, and progress.

### Interaction checks

- Keyboard-open layouts do not cover the active field/action.
- Sticky actions respect safe areas.
- Dialogs/sheets trap focus and restore it after closing.
- Loading, empty, error, and retry states are reachable.
- Repeated clicks do not create duplicate writes/rewards.
- Refresh restores durable state and supported browser drafts.

## Test-writing conventions

- Prefer user-observable behavior over component implementation details.
- Keep calculation functions pure and cover boundary values.
- Use timezone/date-only fixtures that cross month, year, DST, and UTC-offset boundaries.
- Mock provider boundaries, not internal normalization logic in the same test.
- Assert rollback and retained input on failed mutations.
- For regression fixes, first add a test that fails for the original bug.


## Projects verification

`src/lib/projects/project-workspace.test.ts` covers empty-column moves, same-column ordering, legacy duplicate positions, child/cancelled exclusions and URL validation. `project-data.test.ts` covers complete creation fields, paginated reads above 1000 rows, error handling and server summary pagination. Dialog tests cover failed-save draft preservation, retries and dirty-close confirmation. Existing Tasks/Planner/calendar tests also assert main-task filtering.

The standalone `scripts/test-projects-database.cjs` creates a disposable in-memory PostgreSQL database using a temporary `@electric-sql/pglite` installation; no application database is changed. Set `PGLITE_MODULE` to that installation's module path and run `node scripts/test-projects-database.cjs`. It applies the original Knowledge migration and the Projects migration against a minimal legacy Tasks/Auth bootstrap, then checks atomic creation, status synchronization, family reassignment, invalid nesting, optimistic conflicts, notes, links, archive and RLS under actual authenticated/anonymous roles.

Run the standard full test, type, lint and build checks afterward. ESLint excludes embedded `.claude/worktrees/**` checkouts, matching Vitest's existing isolation. Pre-existing lint findings elsewhere must be distinguished from changed-file findings. Authenticated browser QA should exercise card/menu actions, drag into empty columns, two tabs, save failure, browser history, Knowledge return, archive restore and 390/430/768/1440-pixel layouts.
Verification on the combined Projects/current-Staging revision: 133 test files / 1055 tests passed; typecheck, changed-file ESLint and production build passed. Full ESLint still reports 30 pre-existing errors across eight untouched files. Disposable Postgres integration and deployed-schema rollback checks passed. Authenticated browser/device acceptance remains pending because the available browser has no Admin session.

Contacts tests cover task identity/assignment preservation, failed-save retry, calendar source retention and directed relationship labels. Run scripts/test-contacts-database.cjs with PGLITE_MODULE pointing at a temporary @electric-sql/pglite installation for role/constraint/recurrence/idempotence/pagination checks. On Windows, Vitest may need permission to rename its temporary transformation cache files.

Contacts verification on the combined feature/current-Staging revision: 135 test files / 1064 tests passed with `npm run test -- --maxWorkers=2`. The initial concurrent test/build run hit two five-second test timeouts; the complete repeat with limited workers passed without changing test timeouts. Typecheck, production build and changed-file ESLint passed with zero changed-file warnings. Full ESLint still reports the same 30 pre-existing errors in eight untouched files. Disposable Postgres integration and deployed-schema rollback checks passed. Documentation links and whitespace checks passed. Authenticated browser/device acceptance remains pending: the available in-app browser twice failed to attach a webview, so no manual desktop/mobile acceptance is claimed.

## Standalone metrics tests

Vitest files for the feature:

- `src/lib/metrics.test.ts`: validation, `metTarget`, `stepFor` boundaries, scorecard rows, label matching for the template builder, `entryMetricWrites`, `buildMetricAssistantContext` and the Supabase calls (fetch, log, update and delete with mocked clients).
- `src/components/metrics/`: `MetricCreateDialog`, `MetricCreateLauncher`, `MetricCreatedHint`, `MetricEmptyState`, `MetricHistoryList`, `MetricList`, `MetricLogBox`, `MetricLogDialog`, `MetricPageHeader`, `MetricSettingsDialog`, `MetricStepper` and `MetricValueDialog`, each with a `*.test.tsx`.
- `src/components/journal/MetricChart.test.tsx`, `JournalMetricsBlock.test.tsx`, `entry-form.test.tsx` (metric writes on submit, entry date, changed inputs only, retry after a failed write) and `journal-wizard.test.tsx` (the metrics block on the last step).
- `src/components/dashboard/ScorecardSection.test.tsx`, `src/components/layout/quick-action-button.test.tsx` (the `Metric` entry), `src/components/template-builder/template-builder.test.tsx` (link re-pointing, `Also asks for`) and `field-config-editor.test.tsx` (`Feeds metric`).

The tests of the earlier field-based code (`src/lib/legacy-metrics.test.ts`, `src/lib/metric-targets.test.ts`, `MetricTargetControl.test.tsx`) were removed together with that code.

The authenticated browser walk-through (create a metric, set a target, log from the dashboard and the metric page, journal link, edit and delete a value) needs the standalone-metrics migrations on the database the app points at; see `docs/operations/deployment.md`.

## Standalone metrics database checks

`scripts/verify-standalone-metrics.mjs` applies the `metric_targets`, `create_standalone_metrics` and `migrate_tracked_metrics` migrations to minimal journal fixtures in PGlite. It checks the merge of an archived and an active "Weight" field into one metric, the link to the active template's field, the target choice, the combined value history with latest-entry-wins, that a second `backfill_metric_values()` changes nothing, that a directly entered value survives it, that a new journal value or a newer entry is picked up and an older one is not, values written again after an edited response, entries of another user on a mapped field ignored, a tracked field on a system template and a group on archived templates only, a second run of the migration file creating no duplicate metrics, owner-only RLS (including the metric ownership check on `metric_values` inserts), the one-value-per-day key, check constraints, values surviving a deleted entry, and, with Supabase-style default grants emulated, that `anon` cannot read the tables and neither `anon` nor `authenticated` can read `metric_legacy_fields` or execute the backfill. Install `@electric-sql/pglite@0.5.13` in a separate tooling directory and run `LIFEQUEST_PGLITE_MODULE=<file URL of its dist/index.js> node scripts/verify-standalone-metrics.mjs`; it prints `ok: N checks`. It reads no environment files and never connects to Supabase.

## Academy regression checks

Course behavior and access boundaries are covered by `personal-learning.test.ts`, `InteractiveLessonPlayer.test.tsx`, `LearningPathLibrary.test.tsx` and `learning-access.test.tsx`. Existing public Library tests remain unchanged. Test-local storage uses `test/local-storage-stub.ts` because recent Node versions expose an experimental global that otherwise shadows jsdom storage.

For an actual isolated PostgreSQL check, install `@electric-sql/pglite@0.5.13` in a separate tooling directory and set `LIFEQUEST_PGLITE_MODULE` to the file URL of its `dist/index.js`, then run `node scripts/verify-learning-academy.mjs` from the repository. Alternatively make that package available to the script's module resolver. The script does not read `.env` or use a network database. It checks roles/helper grants, user-metadata spoofing, a fourth-path draft, explicit publication, visual-content round trips, server grades, ordering, once-only rewards, reflection ownership and enrollment version pinning. Minimal fixture tables do not cover the whole application's schema or hosted Auth/session refresh behavior.

Visual QA must distinguish actual component rendering on an isolated local harness from a signed-in deployed session. Remove any temporary QA route before building/integrating. Verify 390px and desktop layouts, course/lesson navigation, both cases, keyboard focus and wrong/correct feedback. Report migration deployment separately.

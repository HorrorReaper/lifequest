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

The repository currently contains 32 test files.

### Auth

- Timezone option list always includes the active/stored zone, including one absent from the runtime-supported set (`src/lib/timezones.test.ts`).
- Auth callback redirect-target validation rejects protocol-relative and backslash-normalized open-redirect payloads (`src/lib/auth-redirect.test.ts`).

### Planning, tasks, and habits

- Day-plan normalization.
- Today Plan calculations and UI.
- Task grouping, sorting, helpers, compact list, and editor.
- Habit mutations, analytics, manager behavior, and editor.

### Journal

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


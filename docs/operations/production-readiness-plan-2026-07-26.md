# Production readiness and UX plan

This document turns the 2026-07-26 product, UX, code, build, and live Supabase audit into an implementation sequence. It is an approval document: application behavior should not be changed until the plan is accepted.

Audit baseline: application commit `edb6610`, connected LifeQuest Supabase project, authenticated mobile and desktop browser review.

## Executive assessment

LifeQuest already has a coherent visual identity and several unusually strong MVP flows. The Today Plan wizard, task and habit editors, mobile journal flow, workout shell, nutrition diary, settings, and city all feel like parts of the same product.

It is not production-ready yet. The main risk is not visual polish; it is the combination of database drift, non-atomic writes, incomplete account recovery, security-advisor findings, dependency vulnerabilities, missing end-to-end coverage, and a few information-architecture and responsive UX gaps.

The recommended release strategy is:

1. Make the journaling MVP safe and reliable for invited first users.
2. Keep LifeQuest Labs and all admin trackers private.
3. Harden private admin features enough that they cannot damage shared data or regress the main application.
4. Run a small invited beta before opening access more broadly.

Expected effort for one focused implementation stream is approximately 15–24 working days, followed by a seven-day monitored beta. Work can be shortened through safe parallel implementation after the shared data and UX foundations are settled.

## Current scorecard

| Area | Status | Audit result |
| --- | --- | --- |
| Product direction | Good foundation | Clear journaling, planning, habit, task, and gamification loop |
| Mobile visual quality | Good foundation | Consistent, polished, and generally touch-friendly |
| Desktop experience | Needs work | User app stays phone-width on a 1440px viewport and wastes available space |
| TypeScript | Pass | `npx tsc --noEmit` succeeds |
| Unit/component tests | Pass with gaps | 115 tests in 30 files pass; critical cross-feature journeys are not covered |
| Production build | Conditional pass | Build succeeds with network access; Google Fonts makes it non-deterministic |
| Lint | Fail | 35 errors and 10 warnings |
| Dependency security | Fail | 16 production dependency findings, including 8 high-severity findings |
| Database reproducibility | Fail | Repository migrations, remote migration ledger, live schema, and generated types differ |
| Supabase security | Fail | Function grants, mutable search paths, permissive waitlist policy, and password protection need work |
| Data integrity | High risk | Several important multi-table workflows are non-atomic or non-idempotent |
| Accessibility | Mixed | Strong labels in many new flows; dialog, tabs, dense grids, and some search fields need remediation |
| Observability and E2E | Missing | No full browser journey suite or production error-monitoring baseline |

## Critical findings

### P0 — fix before inviting users

#### 1. Reconcile the database before applying another migration

The remote migration ledger contains only five recorded migrations while the repository contains seventeen. The live database contains later features, suggesting that some schema changes were applied outside the recorded migration chain. The live `exercises` table also lacks fields present in `database.types.ts`, and the live catalog has 177 exercises rather than the expected 1,324.

Risk: a routine migration, reset, preview environment, or generated client can silently produce a different application than production.

Required work:

- Export and back up the live schema and essential user data.
- Diff the live schema against the repository migrations and generated types.
- Build a canonical additive baseline without replaying destructive or already-applied statements.
- Repair the remote migration ledger in a controlled staging environment first.
- Regenerate `database.types.ts` from the reconciled schema and remove false handwritten coverage.
- Verify row-level security, grants, functions, triggers, indexes, and the exercise dataset after reconciliation.
- Never run all local migrations blindly against the current live project.

#### 2. Make rewards and multi-table saves transactional and idempotent

Task completion and XP awards are implemented in more than one place. The dashboard quick-complete path updates the task, inserts an XP event, reads XP, and updates the profile separately. Journal submission performs a long sequence across entries, responses, learnings, habits, tasks, planning, XP, and streak state. City placement, routine replacement, and some nutrition creation/import flows have similar partial-write risks.

Risk: duplicate XP, lost updates, a half-saved reflection, or an interface that says an action failed even though part of it succeeded.

Required work:

- Create narrowly scoped security-invoker RPCs for journal submission, task completion/reopening plus reward, city placement, routine replacement, and other multi-table commits.
- Use durable idempotency keys for user actions that can be retried.
- Centralize task reward rules instead of duplicating them in dashboard, task manager, and chat code.
- Return a complete authoritative result from each transaction so the client can reconcile optimistic state.
- Add concurrency, double-submit, retry, and rollback tests.

#### 3. Close authentication and account-recovery gaps

The login screen explicitly states that password reset is not available. The middleware matcher does not include several authenticated routes such as tasks, habits, quests, and learning. Server layouts still block signed-out access, but session refresh and onboarding enforcement are inconsistent, allowing authenticated users with incomplete onboarding to reach some app routes.

Required work:

- Implement request-reset and set-new-password flows with safe redirects.
- Enable Supabase leaked-password protection.
- Make the protected-route matcher complete, or move all onboarding enforcement into one authoritative server boundary.
- Test expired sessions, refreshed sessions, OAuth return, onboarding bypass attempts, sign-out, and account deletion.
- Verify account-deletion cascades and communicate that existing access tokens can remain valid until expiry unless explicitly revoked.

#### 4. Resolve security-advisor findings

The live advisor reports mutable function `search_path` settings, permissive waitlist insertion, anonymous execution grants on security-definer functions, and disabled leaked-password protection.

Required work:

- Pin safe `search_path` values for database functions.
- Revoke default `PUBLIC` execution and grant each function only to the intended roles.
- Review every security-definer function for ownership or trusted-admin checks.
- Replace the public browser waitlist write with one protected server workflow, rate limiting, spam controls, consent capture, and no PII logging.
- Re-run the security advisor and document any intentionally accepted warning.

References:

- [Function search-path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Permissive RLS policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy)
- [Anonymous security-definer execution guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Password and leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

#### 5. Patch the production dependency graph

The production dependency audit reports 16 findings: 2 low, 6 moderate, and 8 high. The installed Next.js release is within a vulnerable range, and a newer patched release is available. The `shadcn` CLI appears in runtime dependencies and brings a large server/tooling dependency tree into the audit surface.

Required work:

- Upgrade Next.js and other vulnerable packages in controlled, reviewable commits.
- Determine whether `shadcn` is used at runtime; remove it or move it out of production dependencies if it is development-only.
- Avoid a blind forced audit fix.
- Re-run tests, type checking, lint, build, route smoke tests, and the production dependency audit after each package group.
- Accept no high-severity production dependency finding at launch.

#### 6. Restore a green engineering baseline

The repository has 35 lint errors and 10 warnings, including explicit `any`, missing hook dependencies, state changes inside effects, unused values, and unescaped content.

Required work:

- Fix every lint error rather than lowering the rules.
- Triage warnings and document any rare intentional suppression beside the relevant code.
- Self-host the application font so production builds do not require Google Fonts network access.
- Add `data-scroll-behavior="smooth"` to the correct document element or remove the global smooth-scroll behavior.
- Make test, type-check, lint, dependency audit, and build required continuous-integration checks.

### P1 — core UX and reliability before broader beta

#### 7. Make Today the unmistakable operating loop

The individual surfaces are strong, but the overall system is less discoverable than its feature set. Tasks, habits, and daily planning live behind dashboard cards or the quick-action menu while the persistent navigation prioritizes Journal, City, and Settings.

Recommended model:

- **Today**: daily plan, next action, due tasks, habits, and reflection status.
- **Capture**: one consistent quick action for task, note/reflection, habit, meal, and workout.
- **Review**: journal insights, task and habit history, weekly review, and progress.
- **Grow**: quests, learning, city, and optional private Labs.

Required work:

- Establish one primary Today screen with a clear next action and progressive disclosure.
- Keep creation interactions consistent across tasks, habits, planning, and journal.
- Distinguish true empty states from load or permission failures.
- Refresh date-bound state at midnight, on tab visibility, and after timezone changes.
- Surface unsaved, offline, retrying, and failed states consistently.

#### 8. Create an adaptive desktop shell

At 1440px the signed-in user app remains approximately phone-width and uses the same bottom navigation, leaving large unused space. This makes the product feel like a mobile prototype on desktop.

Required work:

- Keep the strong mobile shell below the tablet breakpoint.
- Introduce a desktop navigation rail or sidebar and a wider two-column Today layout.
- Use the second column for plan context, progress, and upcoming work rather than simply stretching forms.
- Preserve focused single-column journal writing where a narrow measure improves readability.
- Test 768px as a deliberate transition rather than an accidental edge case.

#### 9. Reduce density and management noise

Habit and journal template cards are tall, dashboard sections are spacious, and habit reordering controls compete with daily check-in. On small screens this hides the breadth of the product.

Required work:

- Separate “do today” from “manage/reorder/archive”.
- Use compact summaries with optional expansion.
- Preserve large touch targets while reducing decorative vertical space.
- Remove duplicate or redundant actions, such as multiple Resume controls for the same workout.
- Verify sticky actions against mobile keyboards and safe-area insets.

#### 10. Complete accessibility semantics

Required work:

- Replace placeholder-only labels, especially in nutrition food search and waitlist fields.
- Use real dialog behavior with focus trapping, return focus, Escape handling, and scroll locking.
- Implement semantic tab state and keyboard navigation for horizontally scrolling tab sets.
- Give the 100-cell city an accessible grid pattern with roving focus instead of 100 sequential tab stops.
- Test touch targets, focus visibility, contrast in every theme, reduced motion, screen-reader names, and zoom to 200%.
- Do not treat the Next.js development indicator as production UI during visual review.

### P1 — feature-specific hardening

#### Workout tracker

- Reconcile and deploy the intended exercise catalog before claiming full catalog coverage.
- Validate start, resume, background recovery, dirty-set flush, retry, finish, and editing against real long-running sessions.
- Test all six tracking modes, previous values, supersets, notes, timers, trends, and plate calculations.
- Improve the narrow weight/repetition inputs on mobile.
- Replace clipped admin navigation and tracker tabs with a clearly scrollable or compact pattern.
- Keep social and public workout profiles out of scope.

#### Nutrition tracker

- Fix the mobile food-search sheet’s horizontal clipping.
- Give search, tabs, meals, portions, and icon actions complete accessible names and state.
- Do not silently default the global Add Food action to “Other”; use an explicit meal choice or a clear time-based default that users can see and change.
- Test local-food fallback during USDA or Open Food Facts failure.
- Test serving conversions, snapshot-preserving edits, copy/move, saved meals, recipes, barcode permission denial, and manual barcode fallback.
- Keep external provider credentials on the server.

#### Journal, tasks, habits, and Today Plan

- Preserve the excellent one-prompt-per-step mobile journal experience and focused Today Plan flow.
- Add explicit final required-field state, draft recovery, double-submit protection, and durable transaction feedback.
- Test date-only task behavior across DST and timezone boundaries.
- Preserve historical habit logs when unchecking, and make history editing clearly separate from today.
- Replace remaining browser prompts and confirms with consistent accessible dialogs.

#### Knowledge and projects

- Keep them private while the journaling MVP launches.
- Add conflict handling and safe save feedback before they contain important user data.
- Split very large client components before adding major capability.
- Do not let experimental admin complexity determine the public product navigation.

### P2 — maintainability and performance

The largest interactive files range from approximately 700 to 1,500 lines. Examples include Today Planner, Admin Notes, Habit Manager, Entry Form, Task Manager, chat handling, and Daily Briefing.

Required work:

- Extract domain hooks, schemas, transaction clients, calculation modules, and focused view components.
- Replace broad type assertions and `any` at Supabase boundaries with generated, verified types.
- Lazy-load private admin tools, charts, rich-text/Markdown features, and other heavy secondary interfaces.
- Attribute large client chunks by route and set a route budget after measuring compressed transfer and hydration cost.
- Optimize or remove oversized public assets and self-host fonts.
- Add indexes for validated high-frequency foreign-key and filter paths; do not delete “unused” indexes solely because a young product has little query history.

## Implementation sequence

### Milestone 0 — freeze and reconcile, 1–2 days

Deliverables:

- A dedicated `codex/production-readiness` branch and isolated worktree.
- A tagged or exported live database backup.
- A live-schema versus migration versus type report.
- A documented release scope: public journaling MVP, private LifeQuest Labs.
- A staging environment that mirrors production safely.

Exit gate:

- The team can recreate the intended schema without guessing and without changing production.

### Milestone 1 — safety and launch blockers, 4–6 days

Deliverables:

- Canonical additive migration baseline and regenerated types.
- Transactional/idempotent critical writes.
- Password recovery and complete auth/onboarding protection.
- Security-advisor remediation.
- Patched dependency graph.
- Green lint, type check, unit tests, and deterministic build.
- Unified, protected waitlist workflow.

Exit gate:

- No known P0 defect, no high-severity production dependency finding, and no unexplained security-advisor warning.

### Milestone 2 — product loop and responsive UX, 4–6 days

Deliverables:

- Final Today/Capture/Review/Grow information architecture.
- Adaptive desktop shell.
- Compact, action-first mobile dashboard, task, habit, and journal discovery.
- Consistent loading, empty, offline, error, retry, and unsaved states.
- Accessibility remediation for navigation, dialogs, tabs, grids, labels, focus, contrast, and motion.
- Correct midnight and timezone refresh behavior.

Exit gate:

- A first-time user can understand what to do next, complete the daily loop without coaching, and recover from interruption or failure.

### Milestone 3 — feature hardening and maintainability, 4–7 days

Deliverables:

- Critical journal, task, habit, plan, quest, and city paths hardened.
- Private workout and nutrition paths verified without expanding public scope.
- Large high-risk components split along domain boundaries.
- Measured bundle, image, query, and index improvements.

Exit gate:

- The public MVP and private Labs can coexist without shared-data or navigation regressions.

### Milestone 4 — automated release gate, 2–3 days

Deliverables:

- Browser end-to-end tests for sign-up/login/recovery, onboarding, Today Plan, journal save/recovery, task rewards, habits, settings, and account deletion.
- Admin smoke journeys for workout and nutrition.
- Supabase RLS and RPC integration tests using separate users and roles.
- Continuous integration for tests, TypeScript, lint, build, migration checks, security advisor, and dependency audit.
- Error reporting with redaction and a small set of product-health events.

Exit gate:

- Every critical journey is repeatable in a clean staging environment and failures are observable.

### Milestone 5 — invited beta, 2 days to prepare plus 7 days monitored

Deliverables:

- Five to ten invited users with fresh accounts.
- A tested rollback path, support contact, privacy information, terms, backup, and incident checklist.
- Daily review of activation, journal-save success, failed mutations, auth failures, and qualitative friction.
- Fixes for all beta P0/P1 defects before wider invitation.

Exit gate:

- Seven consecutive days without data-loss or security incidents, no unresolved P0/P1 defect, and evidence that new users complete the core daily loop.

## Required release checks

Run all checks against the exact commit intended for production:

```bash
npm run test
npx tsc --noEmit
npm run lint
npm audit --omit=dev
npm run build
git diff --check
```

Additional gates:

- Full browser journeys pass at 390×844, 430×932, 768px, and 1440px.
- Mobile keyboard, safe areas, refresh recovery, offline behavior, slow network, reduced motion, and all themes are verified.
- Two-tab and repeated-submit tests do not duplicate rewards or records.
- Date-bound behavior passes before/after midnight, DST, and profile-timezone changes.
- RLS tests prove isolation between two normal users, an admin, anonymous access, and global system records.
- A clean environment can be built from the canonical migrations.
- Production smoke tests pass immediately after release.

## Definition of production-ready

LifeQuest is ready for first users when:

- A new user can sign up, recover access, complete onboarding, plan the day, use tasks and habits, save a reflection, and understand progress without assistance.
- No normal client action can create partial core records or duplicate XP.
- Production and generated database types describe the same schema.
- Security and dependency findings are either resolved or explicitly accepted with a written rationale and compensating control.
- Errors are visible to the user, retryable where safe, and observable by the operator without exposing private journal content.
- The application is usable with keyboard and screen reader and across the supported mobile and desktop widths.
- CI and staging can reproduce the release, the rollback is tested, and the beta has met its stability gate.

## Approval and change control

On approval, implementation should start with Milestone 0 and proceed in order. Visual refinements must not jump ahead of schema safety, account recovery, or transaction integrity.

Every milestone should end with:

1. A small set of reviewable commits.
2. Automated evidence for its exit gate.
3. Authenticated mobile and desktop QA.
4. An updated audit record listing closed, deferred, and newly discovered findings.

Production deployment should happen only after the final release gate and an explicit deployment confirmation.

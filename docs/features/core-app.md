# Core application and dashboard

## Purpose

The authenticated application is the daily entry point into LifeQuest. It combines the user's plan, tasks, habits, journal prompts, quests, learning progress, streak, XP, coins, and city progression without requiring the user to visit every feature separately.

The primary implementation is in:

- `src/app/(app)/dashboard/page.tsx`
- `src/components/dashboard/`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/app-top-bar.tsx`
- `src/components/layout/bottom-nav.tsx`
- `src/components/layout/quick-action-button.tsx`

## Onboarding

`/onboarding` is a four-step first-run flow: a welcome step, display name and IANA timezone, a short explanation of the app's Plan/Act/Grow loop, and picking an initial journal template. Earlier steps asking for the user's intention and journaling rhythm were removed — that data was collected but never persisted or used anywhere, so it was pure friction. Completing the flow redirects into a first journal entry (`?firstEntry=1`), whose success screen and a matching dashboard welcome card (`?welcome=1`, dismissal in `localStorage`) orient a brand-new user instead of dropping them onto an unfamiliar dashboard.

The timezone picker (shared with Settings via `src/lib/timezones.ts`) is generated from `Intl.supportedValuesOf('timeZone')` at render time and grouped by IANA region, rather than a curated list. The active value is always guaranteed a matching option, so the control cannot display a zone different from what is actually stored.

Completing the final step upserts the profile instead of updating it, since a session that reaches onboarding without an existing profile row (for example sign-up with email confirmation disabled) would otherwise update zero rows without erroring and loop back to onboarding indefinitely.

The authenticated layout and Supabase session middleware redirect incomplete profiles to onboarding. Pages should not independently invent a second onboarding state.

## Dashboard composition

The dashboard server page loads the initial authenticated snapshot. Client widgets then support focused mutations and refresh the server snapshot when needed.

### Greeting and progression

The top of the dashboard is `DashboardGreeting` (`src/components/dashboard/DashboardGreeting.tsx`): the avatar's head, hat included, and "Welcome back, <name>". Under the Trail theme the heading uses the scoped Fraunces font and ends in a full stop; the other themes keep the wave emoji. There is no hero card any more.

Below it, `JournalNudge` (`src/components/dashboard/JournalNudge.tsx`) suggests the day's next move as a single 48px row: the first journal template not yet written today, labelled "Next best move", linking straight into it (or to `/journal` when the user has no templates). Once anything is journaled today it shrinks to a small muted "Add reflection" link to `/journal`; the journal tab is always in the navigation, so nothing more is shown.

Level, XP progress, coins and streak are in the top bar that every page with the standard shell shows, so they are not repeated on the dashboard (`/profile` keeps its own `DashboardHero` card).

#### Top bar

`src/components/layout/app-top-bar.tsx` is one row: `Lv N`, a thin XP progress bar with "XP / next level threshold", coins, and the current streak (best streak stays on `/profile`). It is sticky at the top of `AppShell` and hidden on the same immersive routes as the bottom navigation. A brand-new account's raw progress is below zero (level 1 starts above 0 XP), so the bar clamps it to 0 to 100.

While an admin previews as a user, the bar sticks directly beneath `PreviewAsUserBanner` instead of behind it: the layout sets `--preview-banner-height` (`src/components/layout/preview-banner-height.ts`) and the banner has a fixed height to match. Keep the two in step.

#### Where the numbers come from

`src/app/(app)/layout.tsx` calls `fetchShellStats` (`src/lib/shell-stats.ts`) on every request: `total_xp` and `current_streak` from `profiles`, `coins` from `city_states`, and the equipped avatar items via `fetchAvatarState`. A part that fails falls back to its default so chrome can never take a page down. `AppShell` hands the result to `useShellStats` (`src/components/layout/use-shell-stats.ts`), which renders the server values first, then copies them into the Zustand user store and reads from it. Anything that already calls `addXp`, `setCoins`, `updateStreak` or `setEquippedItems` therefore moves the bar and the nav's avatar immediately, and a `router.refresh()` re-syncs the store with fresh server values.

XP and coins are persisted in Supabase. The Zustand user store exists for responsive presentation and level-up feedback; it is not the durable source of truth.

### Daily briefing

`DailyBriefingWidget` brings together:

- Today's habits and completion state.
- Relevant tasks.
- Journal templates and today's journal entries.
- Today's committed plan.
- Contextual quick actions.

The widget is shared dashboard wiring. When changing tasks, habits, planning, or journal data contracts, verify this component as an integration point.

### Today Plan summary

`TodayPlanWidget` presents the committed intention, outcomes, blocks, current activity, and past activities. The complete editing ritual lives at `/plan`; see [Planning, tasks, habits, and routines](./planning-tasks-habits.md).

### Daily Reflection

One question a day, and one step from reading it to answering it.

The prompts are authored in `src/lib/daily-reflection.ts` and walked one per calendar day, so the list's length is the rotation and the same date always yields the same question — on the dashboard, in the entry form it opens, and when the entry is read back later. That derivation is why the list is append-only: reordering it rewrites what older reflections appear to have asked.

The answer is written through the normal journal entry form against the `Daily Reflection` system template, seeded by `supabase/migrations/20260911120000_create_daily_reflection_template.sql` and referenced by a fixed id rather than by name. Reflections therefore earn XP, count towards the streak, and can be marked as insights like every other entry. Once today's reflection exists the section links to it instead of starting a second one.

The section is in the visibility registry as `reflection`, so it can be turned off in settings like the others.

### Admin-only dashboard additions

Trusted or route-allowlisted admins may also see:

- Active goals.
- Habit routines.
- Learning/knowledge summaries.
- Admin-specific quick actions.

These additions must not make admin data queryable by normal users.

## Quick actions

The center navigation action opens shortcuts to common creation flows. The dashboard also recognizes query-string shortcuts:

```text
/dashboard?quick=task
/dashboard?quick=habit
/dashboard?quick=plan
/dashboard?quick=goal
/dashboard?quick=routine
```

`plan` redirects to the immersive planner. Goal and routine actions are admin-only in the current product.

Trusted/route-allowlisted admins additionally see a "LifeQuest Labs" entry at the top of the quick action sheet linking to `/admin`. The standard bottom navigation has no persistent admin entry point, so this is currently the only in-app way to reach the admin workspace on mobile without typing the URL.

## Navigation

The standard mobile navigation contains:

1. Home.
2. Journal.
3. Quick action.
4. Library (`/learn`), the same page as "Learn" in the quick action sheet. It stays highlighted on the pages below it, such as `/learn/tools`.
5. Avatar (`/profile`), drawn as the player's own head with the equipped hat (`AvatarHead`) rather than a generic icon; a ring around the head marks the active tab. Settings has no tab of its own: it opens from the Settings button on `/profile`, and the Avatar tab stays highlighted on `/settings`.

The top bar (level, XP, coins, streak) sits above the page on the same routes. The standard shell is hidden on immersive workflows, including Today Plan, journal entry forms, routine execution, and admin pages. This prevents competing navigation while the user is completing a focused flow.

## Settings

`/settings` supports:

- Profile name.
- Profile timezone (same grouped, runtime-derived picker as onboarding).
- White, system, or dark appearance.
- AI assistant consent.
- Routine management where authorized.
- Sign-out.
- Permanent account deletion.

Account deletion requires the user to enter the authenticated email and is completed by a server-only endpoint. See [Authentication, authorization, and privacy](../backend/auth-security.md).

## Refresh contract

Client mutations use one or both of:

- `router.refresh()` to re-run Server Components.
- The `lifequest-data-updated` browser event to notify listening widgets.

New dashboard-connected mutations should follow this contract. Do not rely only on changing the Zustand store, because a refresh or new session must reconstruct the same state from Supabase.

## Experimental routes

`/dashboard2` is an alternate dashboard retained for product exploration. It is not the canonical dashboard and may diverge from `/dashboard`.


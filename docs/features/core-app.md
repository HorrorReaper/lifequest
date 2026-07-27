# Core application and dashboard

## Purpose

The authenticated application is the daily entry point into LifeQuest. It combines the user's plan, tasks, habits, journal prompts, quests, learning progress, streak, XP, coins, and city progression without requiring the user to visit every feature separately.

The primary implementation is in:

- `src/app/(app)/dashboard/page.tsx`
- `src/components/dashboard/`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/bottom-nav.tsx`
- `src/components/layout/quick-action-button.tsx`

## Onboarding

`/onboarding` is a six-step first-run flow. It captures:

- Display name.
- The user's primary intention for LifeQuest.
- Preferred daily rhythm.
- IANA timezone.
- Initial journaling preference/template.
- A final confirmation before entering the app.

The authenticated layout and Supabase session middleware redirect incomplete profiles to onboarding. Pages should not independently invent a second onboarding state.

## Dashboard composition

The dashboard server page loads the initial authenticated snapshot. Client widgets then support focused mutations and refresh the server snapshot when needed.

### Hero and progression

The hero displays:

- Current level and XP progress.
- Current and best journaling streak.
- Coins and city tier information.
- The next meaningful city reward.

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

## Navigation

The standard mobile navigation contains:

1. Home.
2. Journal.
3. Quick action.
4. City.
5. Settings.

The standard shell is hidden on immersive workflows, including Today Plan, journal entry forms, routine execution, and admin pages. This prevents competing navigation while the user is completing a focused flow.

## Settings

`/settings` supports:

- Profile name.
- Profile timezone.
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


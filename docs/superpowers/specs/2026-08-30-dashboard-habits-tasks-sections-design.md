# Dashboard redesign — retiring Today's Focus

> Date: 2026-08-30
> Status: Draft — design reviewed, three decisions still open (see below). Nothing implemented; no code has been changed.
> Scope: the authenticated dashboard only — `src/app/(app)/dashboard/page.tsx` and `src/components/dashboard/`. No route, data-model, or migration changes are proposed here.

## Problem

`DailyBriefingWidget` ("Today Focus") summarises six things in one card and lets the user act on almost none of them without first opening a modal:

- **Habit Chain** renders a percentage bar and names only the *next* unchecked habit. Checking the second one costs a trip into the "Manage your day" sheet. For a tracker whose entire daily interaction is ticking binary boxes, that is the wrong shape.
- **Top Task** shows exactly one task, even though the page has already fetched up to eight.
- **Journal** was removed from the card when `JournalNudge` was promoted to its own section (`feat/trail-page-and-journal-section`), which is the precedent this draft follows.

The proposal is to replace the card with two sections that each do one job properly, and to resolve what happens to the rest.

## Design direction

Full mockups, built with the app's real Trail tokens (`#F2EBDC` ground, `#26543F` primary, Fraunces + Inter) rather than an approximation:

- [Retiring Today's Focus](https://claude.ai/code/artifact/2218c991-054d-44d0-b5ab-f9f84cbf1553) — the approved-pending reference for both sections, their states, and the migration table.

### Section 1 — Habits

A section header (`Habits` · `3 of 5 today`), a chain of one dot per habit filled as they are checked, then every habit as its own row: emoji, name, current streak, and a tap target sized checkbox. Footer: `Add habit` and `Manage habits →`.

The chain replaces the progress bar deliberately: it carries the same completion signal but also tells the user *how many* habits there are, which a percentage does not.

States:

| State | Behaviour |
| --- | --- |
| Empty | "No habits yet", with Add habit as the only action |
| All done | Chain fully filled, header reads `5 of 5`, no nagging copy |
| Failed write | Row reverts with an inline retry, matching `/habits` |

### Section 2 — Tasks

Header (`Tasks` · `1 overdue · 3 today`), then each task as a row with a priority stripe, a completing checkbox, the title, and a due chip. Footer: `Add task` and `All tasks →`.

Scope is deliberately today-and-overdue only — exactly the set `dashboard/page.tsx` already queries (incomplete, due today or earlier, capped at eight). Anything beyond that belongs to `/tasks`.

Priority becomes a 3px stripe rather than the words "high priority". That frees the card's only red text for "Overdue", so it stays the thing the eye lands on. Completing in place awards the same 5 XP as today's quick-complete, with the same optimistic rollback.

States:

| State | Behaviour |
| --- | --- |
| Empty | "Nothing due today." — a finished state, not an error |
| Overflow | Show eight; footer reads `All tasks (14)` |
| Undated | Stay out of the section; they are not due today by definition |

## Consequence: what the sheet was hiding

This is the part with teeth. Three components are reachable **only** through the "Manage your day" sheet today, so deleting the card orphans them:

- `HabitDashboardWidget`
- `TaskList` (compact mode)
- `GoalsDashboardWidget`

The first two are the reason this is mostly a move rather than a build. `HabitDashboardWidget` already loads habits with today's logs and handles check, uncheck, optimistic rollback, and retry — it is simply buried in a tab. The Habits section is largely that component with a section header and streaks added. `TaskList` in compact mode is the same story. Writing either from scratch would create exactly the duplicate surface this codebase has repeatedly grown (`/dashboard` vs `/dashboard2`, the two former `city.ts` copies).

The remaining sheet tabs resolve cleanly: **Plan** was always just a link to `/plan`, and **Routines** already have their own dashboard section for admins.

One wiring detail rides along: the quick-action button deep-links with `?quick=task` and `?quick=habit`, which currently open the sheet on the matching tab. With inline sections those should open the section's own add-form instead.

## Open questions — must be resolved before an implementation plan

1. **Where does the plan content go?** Main Quest, Now/Next, and Upcoming Plan are the real content left over. Either a third "Today's plan" section alongside these two, or fold it into `TodayPlanWidget`, which already exists and is currently only rendered on `/dashboard2`. Recommendation: the latter — it is already written, and it avoids a fourth card on the home screen.
2. **Per-habit streaks — worth the query?** The dashboard currently fetches only *today's* habit logs. Showing a streak per habit means loading log history as well. It is the most motivating number on the card but it is not free. Ship without them first, or pay for it now?
3. **Does `GoalsDashboardWidget` survive?** It is admin-only and about to lose its only entry point. Give it a dashboard section as routines have, or drop it?

## Next step

Once questions 1–3 are answered, write a dated implementation plan under `docs/superpowers/plans/` (task-by-task, matching `docs/superpowers/plans/2026-08-21-landing-page-nightfall-city.md`) before any code is written.

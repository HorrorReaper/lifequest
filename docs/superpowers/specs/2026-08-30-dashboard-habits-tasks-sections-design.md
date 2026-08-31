# Dashboard redesign — retiring Today's Focus

> Date: 2026-08-30 · Amended 2026-08-31 (all open questions resolved)
> Status: Approved. Ready for an implementation plan. No code has been changed yet.
> Scope: the authenticated dashboard only — `src/app/(app)/dashboard/page.tsx` and `src/components/dashboard/`. One shared library is extracted (`src/lib/habit-check-in.ts`) and `src/components/habits/HabitManager.tsx` is refactored onto it. No route, data-model, or migration changes.

## Problem

`DailyBriefingWidget` ("Today Focus") summarises six things in one card and lets the user act on almost none of them without first opening a modal:

- **Habit Chain** renders a percentage bar and names only the *next* unchecked habit. Checking the second one costs a trip into the "Manage your day" sheet. For a tracker whose entire daily interaction is ticking binary boxes, that is the wrong shape.
- **Top Task** shows exactly one task, even though the page has already fetched up to eight.
- **Journal** was removed from the card when `JournalNudge` was promoted to its own section (`feat/trail-page-and-journal-section`), which is the precedent this design follows.

The card is replaced by sections that each do one job properly.

## Design direction

The original mockup (`claude.ai/code/artifact/2218c991-…`) is **no longer retrievable** — the artifact was deleted. The prose below is now the reference; nothing depends on recovering it.

Sections use the app's semantic tokens (`bg-background`, `border`, `text-muted-foreground`, `primary`), not literal hex values. The mockup was drawn in Trail colours, but `THEMES` in `src/components/providers/theme-provider.tsx` lists five (`light`, `dark`, `system`, `white`, `trail`), so hardcoding Trail's palette would break the other three. `JournalNudge` is the pattern to follow.

### Page order

```
DashboardHero → JournalNudge → TodayPlanSection → HabitsSection → TasksSection
→ MetricDashboardWidget → [admin: AdminLearningWidget, RoutinesDashboardWidget, GoalsDashboardWidget] → QuestDashboardWidget
```

`FirstRunWelcome`, `DailyPlanPrompt`, and `EveningReviewPrompt` are modals and keep their current positions.

### Section 1 — Habits

A section header (`Habits` · `3 of 5 today`), a chain of one dot per habit filled as they are checked, then every habit as its own row: emoji, name, current streak, and a tap-target-sized checkbox. Footer: `Add habit` and `Manage habits →`.

The chain replaces the progress bar deliberately: it carries the same completion signal but also tells the user *how many* habits there are, which a percentage does not.

A client component, but fed **entirely by server props** — habits with `completed` and `streakThroughYesterday` already resolved — holding only optimistic state. It does not fetch on mount, so unlike `HabitDashboardWidget` it never puts a loading spinner on the home screen.

| State | Behaviour |
| --- | --- |
| Empty | "No habits yet", with Add habit as the only action |
| All done | Chain fully filled, header reads `5 of 5`, no nagging copy |
| Failed write | Row reverts with an inline retry, matching `/habits` |

### Section 2 — Tasks

Header (`Tasks` · `1 overdue · 3 today`), then each task as a row with a priority stripe, a completing checkbox, the title, and a due chip. Footer: `Add task` and `All tasks (14) →`.

Priority becomes a 3px stripe rather than the words "high priority". That frees the card's only red text for "Overdue", so it stays the thing the eye lands on.

| State | Behaviour |
| --- | --- |
| Empty, undated tasks exist | Header reads `Nothing due today · 3 unscheduled`; up to 8 undated open tasks render |
| Empty, nothing open | "Nothing due today." — a finished state, not an error |
| Overflow | Show at most eight rows regardless of how many were fetched; footer reads `All tasks (14)` |

### Section 3 — Today's plan

A new **server** component carrying the three things worth keeping from the retired card: Main Quest, Now/Next, and the remaining blocks. It takes `planBlocks`, `mainQuestTitle`, `planCommitted`, and `todayLabel` as props — all of which `dashboard/page.tsx` already computes, with the profile timezone correctly applied and `isCurrent` / `isPast` already resolved. No fetching, no client JS.

`TodayPlanWidget` is **not** reused (see Decision 2).

## Consequence: what the sheet was hiding

Three components are reachable only through the "Manage your day" sheet, so deleting the card orphans them. Note the sheet has no visible trigger at all — `sheetOpen` is only ever true when a `?quick=` deep link sets it, so these are already reachable only by URL.

- `HabitDashboardWidget` — superseded by `HabitsSection`; **deleted**.
- `TaskList` (compact mode) — **untouched**; still live on `/dashboard2` and covered by `TaskList.test.tsx`.
- `GoalsDashboardWidget` — promoted to its own admin-only section (Decision 3).

The remaining sheet tabs resolve cleanly: **Plan** was always just a link to `/plan`, and **Routines** already have their own dashboard section for admins.

### `?quick=` rewiring

The quick-action button deep-links with `?quick=task`, `?quick=habit`, and `?quick=routine`, all of which currently open the sheet on the matching tab.

- `task` / `habit` → pass `initiallyOpen` to the section's own `TaskEditorDialog` / `HabitEditorDialog`.
- `routine` → `redirect('/routines')`, matching how `plan` already redirects.
- `goal` → dropped from `parseQuickAction`'s accepted values. It is not in `quick-action-button.tsx` and never was reachable from the UI.

## Decisions

### 1. Habit check-ins award the same XP everywhere

The same user action has three implementations today, and two of them pay nothing:

| Path | Reward |
| --- | --- |
| `HabitManager` (`/habits`) | `calculateHabitCheckInXp(streak)` → 10–20 XP + 3 coins via `check_in_habit_reward` |
| `HabitDashboardWidget` | none — plain `setHabitLogCompletion` |
| `DailyBriefingWidget` quick-check | none — raw `habit_logs` upsert |

Promoting an unrewarded path to the home screen is not acceptable, so `HabitsSection` reaches full parity: streak-scaled XP and coins through the same RPCs, and `undo_habit_check_in_reward` on uncheck.

**This makes per-habit streaks load-bearing rather than decorative** — the streak is an input to the XP formula — which settles the "worth the query?" question as *yes*.

The client still needs no log history. `calculateCurrentStreak` walks backwards from today, so if the server supplies **`streakThroughYesterday`** per habit, everything derives from it:

- displayed streak = `completed ? streakThroughYesterday + 1 : streakThroughYesterday`
- XP on check = `calculateHabitCheckInXp(streakThroughYesterday + 1)`

That second line is exactly what `/habits` computes: `buildHabitSummary` runs over logs *including* the just-saved one, so its `currentStreak` is `streakThroughYesterday + 1` by construction.

Server cost is a replacement, not an addition. The existing today-only `habit_logs` query widens to a 400-day window selecting only `habit_id, log_date` where `completed = true`; `completedHabitIds` (needed by `RoutinesDashboardWidget`) comes from the same rows. A streak longer than 400 days would be under-reported — an acceptable ceiling, noted in a comment rather than engineered around.

To stop the three paths from ever diverging again, the check-and-reward sequence is extracted to `src/lib/habit-check-in.ts`, taking the streak as a parameter so each caller keeps its own way of knowing it. `HabitManager` is refactored onto it.

`TasksSection` gets task-XP parity for free by calling the existing `awardTaskCompletionXp`, which — unlike the briefing card's hand-rolled `xp_events` insert — checks for an existing event first and is therefore idempotent. Deleting the card fixes an unreported double-award.

### 2. Plan content goes to a new server section, not `TodayPlanWidget`

The earlier recommendation was to fold it into `TodayPlanWidget` because that component "already exists". It does not survive contact: it client-fetches its own plan, derives the date from the device rather than the profile timezone, and knows nothing about Main Quest or mission types. Retrofitting it means rewriting it *and* keeping `/dashboard2` working, for no gain over ~80 lines of server component fed from props the page already has.

`TodayPlanWidget` stays exactly as it is on `/dashboard2` and dies with that route.

### 3. `GoalsDashboardWidget` gets an admin-only section

It is not losing its entry point — it never had one. `?quick=goal` is absent from `quick-action-button.tsx` and there is no `/goals` route, so 371 lines and an AI quest-suggestions API route have only ever been reachable by hand-typing a URL.

It is rendered directly on the dashboard behind `isAdmin`, exactly as `RoutinesDashboardWidget` already is. `page.tsx` already fetches `activeGoals`, so this is a two-line change and the cheapest way to stop losing a built feature. Nothing else in this design depends on it.

### 4. Task scope is today-and-overdue, falling back to undated

The earlier draft claimed undated tasks were already out of scope. They are not: `page.tsx` queries `due_date.lte.${today},due_date.is.null`, so undated tasks are in today's set today.

Excluding them outright would leave a user who never sets due dates staring at an empty Tasks section while holding twenty open tasks. So: the section shows today-and-overdue, and *only when that set is empty* falls back to undated open tasks under a distinct header (`Nothing due today · 3 unscheduled`).

No extra query. The existing single query keeps its `OR` clause with `limit` raised to 16, and the page partitions the rows server-side. `due_date asc nullsFirst: false` guarantees dated rows come first, so the partition is correct at any mix. A separate `count: 'exact', head: true` supplies the footer's total.

### 5. `TasksSection` is a new component, not a third `TaskManager` mode

The earlier draft argued the Tasks section should be "largely `TaskList` compact mode", on the grounds that building fresh grows duplicate surfaces — the real pathology behind `/dashboard` vs `/dashboard2` and the two former `city.ts` copies.

That reasoning applies to duplicating *logic*, and this design does not. `TasksSection` reuses `toggleTask`, `awardTaskCompletionXp`, and `TaskEditorDialog` — the libraries where drift would actually hurt. What it declines to reuse is `TaskManager`'s chrome, and for concrete reasons: compact mode fetches its own data (a spinner on the home screen), ignores the today-scope entirely, and is one of two modes already sharing 837 lines. A third mode selected by flags is how that file got long.

The same argument does *not* apply to habits, where `HabitDashboardWidget` is genuinely superseded and therefore deleted rather than left as a second surface.

## File-level summary

**New**
- `src/lib/habit-check-in.ts` (+ test) — the single check/uncheck-with-reward path
- `src/components/dashboard/HabitsSection.tsx` (+ test)
- `src/components/dashboard/TasksSection.tsx` (+ test)
- `src/components/dashboard/TodayPlanSection.tsx` (+ test)

**Modified**
- `src/app/(app)/dashboard/page.tsx` — widened habit-log window, `limit(16)` + server-side task partition, open-task count, three new sections, `GoalsDashboardWidget`, `?quick=` rewiring
- `src/components/habits/HabitManager.tsx` — refactored onto `habit-check-in.ts`

**Deleted**
- `src/components/dashboard/DailyBriefingWidget.tsx`
- `src/components/dashboard/HabitDashboardWidget.tsx`

**Deliberately untouched**
- `src/components/tasks/TaskManager.tsx` and `TaskList.tsx` (live on `/dashboard2`, tested)
- `src/components/dashboard/TodayPlanWidget.tsx` (lives on `/dashboard2`)

## Next step

Write a dated implementation plan under `docs/superpowers/plans/`, task-by-task, matching `docs/superpowers/plans/2026-08-27-skill-categories-and-habit-xp.md`.

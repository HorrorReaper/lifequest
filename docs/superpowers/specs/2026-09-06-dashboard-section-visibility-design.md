# Dashboard section visibility

**Date:** 2026-09-06
**Status:** Approved, not implemented

Let people turn the dashboard's main content sections on and off from
Settings.

## Problem

The dashboard renders twelve blocks in one column. Six of them are permanent
content sections; the rest are the hero, the journal nudge, and prompts that
already show and hide themselves by time of day or first visit. Someone who
does not use quests, or does not track a metric, scrolls past those sections
every day with no way to remove them.

## Scope

Toggleable: **Today's Plan, Habits, Tasks, Metric, Quests, Routines.**

Not toggleable, and deliberately so:

- The hero, which carries level, XP, coins, streak and avatar.
- `FirstRunWelcome`, `DailyPlanPrompt`, `EveningReviewPrompt`, `JournalNudge` —
  these already appear only under their own conditions. A permanent switch on
  something that hides itself invites turning off a prompt and then forgetting
  it exists.
- `AdminLearningWidget`, which is admin-only and was not asked for.

Also out of scope: reordering sections, per-device settings, and any change to
how the sections themselves work.

## Storage

A single JSONB column on `profiles`, holding a map of section id to boolean.

```sql
alter table public.profiles
  add column dashboard_sections jsonb not null default '{}'::jsonb;
```

An empty object means everything is visible, so existing users need no
backfill and notice nothing.

**Why not one column per section.** Named booleans would be typed end to end
with no normalizer, but they need a migration for every section added, and
they put the list of sections in two places — the schema and the code — which
can then drift. Two dashboard sections were added in a single working session
recently.

**Why not a `dashboard_preferences` table.** It would follow the existing
`workout_preferences` pattern, but that table is read only on workout screens.
This one would be read on every dashboard load, adding a query for six
booleans, and a missing row would have to mean "all visible" anyway.

The dashboard already selects the profile with `select('*')`, so the column
costs no extra query.

## The registry

`src/lib/dashboard-sections.ts`, a pure module with no Supabase dependency, is
the single source of truth for which sections exist:

```ts
export interface DashboardSectionDef {
  id: string
  label: string
  description: string
  adminOnly?: boolean
}

export const DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  {
    id: 'today_plan',
    label: "Today's Plan",
    description: 'The shape of your day, block by block.',
  },
  {
    id: 'habits',
    label: 'Habits',
    description: "Today's habits, checkable without leaving the page.",
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'What is due today, and what is already overdue.',
  },
  {
    id: 'metric',
    label: 'Metric',
    description: 'A chart of the metric you are tracking.',
  },
  {
    id: 'quests',
    label: 'Quests',
    description: 'Quests ready to claim, and the ones still running.',
  },
  {
    id: 'routines',
    label: 'Routines',
    description: 'Guided chains of habits.',
    adminOnly: true,
  },
]
```

Three functions, following the normalize-on-read pattern already used by
`normalizeMoodReasons` and `parseTodayPlanNotes`:

- `normalizeDashboardSections(value)` — drops ids this build no longer knows,
  and treats anything unparseable as all-visible.
- `isSectionVisible(prefs, id)` — **a missing id is visible.** A section
  shipped after someone last saved their settings must appear, not vanish
  silently.
- `visibleSectionCount(prefs, { isAdmin })` — counts only the sections this
  user could see at all, so an admin-only section does not keep a non-admin
  permanently above zero.

The database never learns the list of sections. Adding one is a line in the
registry and nothing else.

## Dashboard

Read once, near the top, after the profile loads:

```ts
const sections = normalizeDashboardSections(profile.dashboard_sections)
const shows = (id: string) => isSectionVisible(sections, id)
```

### Queries that can be skipped

Three fetches belong to exactly one section and are skipped when it is off:

| Section  | Fetch | Note |
|----------|-------|------|
| Quests   | `fetchQuestPageData` | Its own sequential `await` today |
| Metric   | `fetchTrackedMetrics` + one `fetchMetricSeries` per metric | Its own sequential `await`; the largest saving |
| Routines | `fetchRoutines` | Already inside an `isAdmin ?` branch; gains a second condition |

### Queries that must keep running

Habits, tasks and the day plan are shared with blocks that stay on screen:

- `dayPlanRes` also produces `planCommitted` for `DailyPlanPrompt`.
- The habit rows and logs also feed `habitsCompletedToday` and the habit total
  for `EveningReviewPrompt`.
- `tasksCompletedTodayRes` also feeds `EveningReviewPrompt`.

For these three, turning the section off stops the rendering, not the query.
The page gets shorter, not faster.

### Rendering

Each of the six becomes `shows('…') && …`. Routines stays behind `isAdmin` as
well.

When `visibleSectionCount` reaches zero, the dashboard shows one quiet line
naming how many sections are hidden and linking to Settings. Without it, a
user who turned everything off sees a hero and some prompts, and cannot tell
that from a broken page.

### Deliberately unchanged

The quest and metric fetches run sequentially before the main `Promise.all`
rather than inside it. That is a real cost, but a different problem; making
them conditional does not make it this change's business to fix.

## Settings

A new card in `settings-form.tsx`, built like the ones around it: `Card`,
`CardHeader`, `CardTitle` "Start screen", `CardDescription` "Choose what your
dashboard shows." One `Switch` per registry entry, labelled from the registry,
with its description underneath. The routines switch renders only for admins,
matching the section.

`settings/page.tsx` passes `dashboardSections` as a new prop, the way it
already passes `aiAssistantEnabled`.

**Saving is optimistic, with rollback.** The neighbouring `handleAiConsent`
writes first and updates state after, which is right for a single consent
decision but would put a visible round trip behind each of six switches. The
switch moves immediately; on failure it returns and the card explains. This is
not a new pattern — the habit and task rows on the dashboard already work this
way.

The write sends the **whole map**, not the single changed key, through
`supabaseUpdateWhere(supabase, 'profiles', …, 'id', userId)`.

## Testing

The dashboard page is a server component wrapping a dozen Supabase queries and
is not worth unit testing here. The decisions therefore live in the registry,
where they can be tested directly:

- `normalizeDashboardSections`: unknown ids dropped; missing ids visible;
  `null`, a string, and an array all yield all-visible.
- `isSectionVisible`: a missing id is visible, so a newly shipped section
  appears rather than disappearing.
- `visibleSectionCount`: an admin-only section does not count for a non-admin.

For the settings card:

- One switch per section, and the routines switch only for admins.
- Toggling writes the complete map, not just the changed key.
- A failed write returns the switch to its previous position and shows a
  message.

## Migration dependency

Settings cannot save until the migration is applied. It is additive with a
default, so applying it needs no downtime and no backfill.

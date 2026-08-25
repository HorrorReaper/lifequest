# Today planning, tasks, habits, and routines

## Today Plan

`/plan` is a five-step daily planning ritual implemented by `TodayPlanner`.

### Steps

1. **Reset** — write the day's intention.
2. **Top Three** — choose must-win, progress, and health outcomes.
3. **Anchors** — add fixed habits, journal moments, and an admin-only workout anchor.
4. **Timeline** — turn choices into a realistic schedule.
5. **Commit** — review capacity, resolve conflicts, and save.

Each outcome can include a duration and a linked existing task. The day also has start, end, and shutdown times.

### Timeline construction

The planner:

- Preserves existing manually stored blocks.
- Creates mission blocks from selected outcomes and anchors.
- Adds ten-minute transition gaps where possible.
- Calculates available, planned, and remaining minutes.
- Classifies the plan as open, balanced, full, or over capacity.
- Rejects invalid time ranges and overlapping blocks.

At least one must-win outcome is required before commitment.

### Persistence and drafts

The committed plan is stored in `day_plans`. Rich Today Plan metadata is serialized into the notes field with the prefix:

```text
LIFEQUEST_TODAY_PLAN_V1:
```

The envelope preserves legacy free-form notes rather than replacing them.

Before commitment, the planner stores a user-and-date-scoped draft in `sessionStorage`. Closing or leaving a dirty plan asks for discard confirmation. No database write occurs until commit.

## Task manager

`/tasks` is the full user task manager. `TaskList` remains a compact, backward-compatible dashboard consumer.

### Views and sorting

Tasks are grouped into:

- Today, including overdue incomplete tasks.
- Upcoming.
- No Date.
- Completed.

Users can search title and description and filter by priority. Priority order is explicit: high, medium, then low.

### Supported operations

- Create and edit title, description, priority, and due date.
- Complete and reopen.
- Defer an incomplete task to tomorrow.
- Delete after confirmation.
- Retry a failed mutation.

The editor uses a full-height sheet on mobile and a centered dialog on desktop.

### Dates

Task due dates are stored as `YYYY-MM-DD`. Helpers parse date-only values at local noon so that neither a positive nor a negative UTC offset can shift them into an adjacent day.

`taskViewForDate`, `filterTasks`, and `countTaskViews` take the current day as a required argument, and `TaskManager` receives it as a prop resolved from the profile timezone on the server. Do not reintroduce a `localDateKey()` default: it silently swaps the profile day for the device day, which is how the Today column used to roll over at a different moment than the dashboard and habits.

### Mutation behavior and XP

Task mutations use locks to prevent repeated submission, optimistic updates where helpful, rollback on failure, and visible error/retry state.

Completing an ordinary task awards 5 XP once. The client checks for an existing `xp_events` row with the task as its source before applying the reward. This check and the subsequent writes are not one atomic RPC, so the database remains the correct place for any future stronger idempotency guarantee.

The public task manager deliberately exposes only durable basic fields. Project status, estimates, subtasks, and blocked states belong to the admin project workspace.

## Habit manager

`/habits` manages daily, binary habits using the existing `habits` and `habit_logs` data.

### Views

- **Today** — active habits and today's completion.
- **History** — active habits with historical context.
- **Archived** — archived habits that can be restored.

Each habit shows its emoji, color, today's state, current streak, and seven-day completion strip.

### Supported operations

- Create/edit name, emoji, and color.
- Daily cadence display; richer schedules are intentionally unsupported.
- Check or uncheck today.
- Check a past, non-future day after the habit's creation date.
- Drag or use buttons to reorder.
- Archive with confirmation.
- Restore.
- Retry failed mutations after optimistic rollback.

Active habits cannot share the same normalized name.

Unchecking updates the matching log to `completed=false`; it does not delete the row. This preserves history and any journal linkage.

### Timezone

Habit date keys use the profile's IANA timezone. Do not replace this with the browser timezone or raw UTC date.

## Habit analytics

`/habits/[habitId]` provides:

- Current and longest streak.
- 30-day, 90-day, and all-time completion rates.
- A 42-day heat map.
- An eight-week trend.
- Weekday consistency.
- Recent completions.

Date arithmetic uses day-number helpers so daylight-saving changes do not change streak length.

## Routines

Routines group habits for a focused execution session.

Capabilities include:

- Create, update, archive, and delete a routine.
- Add and reorder routine items.
- Calculate completion progress from habit logs.
- Run a routine at `/routines/[routineId]/run`.
- Upsert the included habit completions during the run.

Current migrations restrict routine access to trusted admins even though routines appear in some shared application components. Routine item replacement currently deletes and reinserts items sequentially rather than using an atomic RPC.

## Shared integration contract

Tasks and habits are consumed by the dashboard, Today Plan, journal fields, and admin productivity hub. Changes should preserve:

- Compact component props used by dashboard widgets.
- `lifequest-data-updated` refresh events.
- Profile-timezone date keys.
- Journal-created task and habit flows.
- Existing Supabase columns and RLS boundaries.


# Today planning, tasks, habits, and routines

## Today Plan

`/plan` is the daily planner implemented by `TodayPlanner`. It has two modes:

- **Plan editor.** When today already has blocks, `/plan` opens straight on the timeline (`TodayPlanScreen` passes `startAt="timeline"`). The header shows "Edit today's plan" and a save state ("All changes saved", "Unsaved changes", "Saving…", "Saved at HH:mm") instead of step numbers. The footer has "Dashboard" and "Save plan"; Save is disabled until something changed. Saving (`savePlanEdits`) writes the plan and stays on the timeline. It does not require a main priority, keeps `ritual_completed_at` (or sets it if the plan never had one), and on failure keeps the edits on screen with "Not saved. Your changes are still here in this tab.", turns the header status red ("Not saved") and scrolls the message into view, since Save sits in the footer and the message at the end of the page.
 Leaving with unsaved changes offers "Save plan", "Continue editing", "Leave and keep draft" and "Discard draft". `?step=timeline` opens the same editor.
- **Daily ritual.** Without blocks, or with `?step=ritual` (linked from the editor as "Start the full daily ritual instead"), the six-step ritual below runs from the start.

### Steps

1. **Mood** — how the day starts; optional reasons.
2. **Intention** — the day's guiding line.
3. **Priorities** — a main priority (required), a second priority and recovery (both optional). These replace the earlier "Must Win" and "Main / Side / Recovery Quest" names; the quest wording survives only in the main priority's helper line. Blocks show "Main priority", "Priority", "Anchor" or "Recovery".
4. **Anchors** — habits, reflections and the admin-only training anchor, grouped under "Habits", "Reflections" and "Training". Each says whether it "Rides along, reserves no time" or "Reserves N min on the timeline". Journal templates with the same name are told apart by `journalAnchorTitles`: "(standard)" for the built-in one, "(your copy)" for the user's own.
5. **Timeline** — turn choices into a realistic schedule.
6. **Review** — capacity, conflicts, and "Save today's plan".

Each outcome can include a duration and a linked existing task. The day also has start, end, and shutdown times.

### Timeline construction

The planner:

- Preserves existing manually stored blocks.
- Creates mission blocks from selected outcomes and anchors.
- Adds ten-minute transition gaps where possible.
- Calculates available, planned, and remaining minutes.
- Classifies the plan as open, balanced, full, or over capacity.
- Rejects invalid time ranges and overlapping blocks.

The capacity panel is titled "Capacity of scheduled blocks" and counts time blocks only; when anchors ride along it adds that they are not counted. The review step's summary shows how many anchors have no time.

Every block has an always-visible resize pill on its bottom edge (no hover needed on touch). Blocks shorter than 25 minutes get a thin 6px strip instead of the 16px one, which would otherwise cover a 15-minute block and turn every tap on it into a resize. The accessible alternative to dragging: Enter or Space on a block opens its editor with exact start and end fields, and arrow keys move it (Shift with arrows changes the length), described to screen readers through `aria-describedby`. The block editor says what is wrong in words ("Give this block a title.", "The end time has to be after the start time.") and offers "Space them out" for an overlap.

At least one main priority is required to finish the ritual; the plan editor does not ask for one.

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

- Create and edit title, description, priority, and due date. The dialog asks for the title first; the description sits under a collapsed "Details (optional)" that opens by itself when the task already has one. The due date is four buttons, "Today", "Tomorrow", "Choose date" and "No date" (`DueDateField` in `src/components/tasks/DueDateField.tsx`, computed from the profile day passed in as `today`), with a line under them saying what will be saved ("Due tomorrow. Planning it into a day is separate."). Only "Choose date" shows the calendar, and it stays selected once pressed, also on a task already due today or tomorrow.
- `/tasks?new=1` opens the create dialog directly (the quick action sheet's "Task").
- Complete and reopen.
- Defer an incomplete task to tomorrow.
- Delete after confirmation.
- Retry a failed mutation.

The editor uses a full-height sheet on mobile and a centered dialog on desktop.

The popover is capped to the height Base UI measures as available (`--available-height`) and scrolls inside it, so in a short window (200 % zoom) the calendar stays on screen instead of flipping up past the top edge. The calendar popover is layered above the dialog on its positioned wrapper (`PopoverPrimitive.Positioner` in `src/components/ui/popover.tsx`, `z-[90]`), not only on the inner popup. With the layer on the popup alone, the wrapper stayed at the page's base layer: the calendar opened behind the task dialog and clicks on its days hit the dialog's priority buttons. Select, dropdown and tooltip positioners use the same layer. Below `sm` the field is the native date input.

Each row has exactly one completion control, `CompletionToggle` (`src/components/ui/completion-toggle.tsx`): a single `role="checkbox"` button named "Complete <title>" or "Reopen <title>" with a 44px hit area. The Checkbox primitive it replaced paired its box with a hidden native input, which accessibility tooling listed as a second, unnamed checkbox. Rows show "Due today" / "Due Oct 30" / "Overdue · due …" and, separately, "In today's plan" when today's plan has a block for the task (`plannedTaskIds`, read on the server page). Planning a task never changes its due date.

With a search or priority filter active, a line shows "Showing N of M tasks in <view>" with "Clear search and filter", and an empty result says "Nothing here matches your search or priority filter" with the same button. An empty view without filters says what belongs there and offers "Add task".

### Dates

Task due dates are stored as `YYYY-MM-DD`. Helpers parse date-only values at local noon so that neither a positive nor a negative UTC offset can shift them into an adjacent day.

`taskViewForDate`, `filterTasks`, and `countTaskViews` take the current day as a required argument, and `TaskManager` receives it as a prop resolved from the profile timezone on the server. Do not reintroduce a `localDateKey()` default: it silently swaps the profile day for the device day, which is how the Today column used to roll over at a different moment than the dashboard and habits.

### Mutation behavior and XP

Task mutations use locks to prevent repeated submission, optimistic updates where helpful, rollback on failure, and visible error/retry state.

Completing an ordinary task awards 5 XP once, through `completeTaskWithReward` in `src/lib/tasks.ts` wherever a check-off is offered (task list, dashboard section, Next up). Reopening keeps the XP, and completing again does not pay twice. The client checks for an existing `xp_events` row with the task as its source before applying the reward. Create dialogs guard submit with a ref set before the first `await`, so a double tap creates one task. This check and the subsequent writes are not one atomic RPC, so the database remains the correct place for any future stronger idempotency guarantee.

The public task manager deliberately exposes only durable basic fields. Project status, estimates, subtasks, and blocked states belong to the admin project workspace.

## Habit manager

`/habits` manages daily, binary habits using the existing `habits` and `habit_logs` data.

### Views

- **Today** — active habits and today's completion.
- **History** — active habits with historical context.
- **Archived** — archived habits that can be restored.

Each habit card shows its icon, its name on up to two lines, "Daily", and either the current streak or, before its first check-in, "Ready for its first check-in". The check-in control is a single `role="checkbox"` button ("Check in <name> today" / "Undo check-in for <name> today"); done is always the filled primary circle with a tick, whatever the habit's colour.

"Add habit" is a button in the page header (`PageHeader` in `src/components/ui/page-header.tsx`). It used to float at the bottom of the list, where on a phone the fixed navigation covered it and took its taps. `/habits?new=1` opens the create dialog directly.

### Supported operations

- Create/edit name, emoji, color, and an optional skill category. Creating asks for the name; icon, colour and skill sit under a collapsed "Icon, color and skill (optional)" (open when editing). New habits start with a neutral seedling icon (`DEFAULT_HABIT_EMOJI`, 🌱) instead of the green tick, which looked like a finished check-in. Existing habits keep their icon.
- A "Daily habit" note: checked off once a day, and days before creation never count as missed. Habits are daily only for the first beta; flexible weekdays and weekly targets ("3× a week") are a later extension and are not offered.
- Check or uncheck today.
- Check a past, non-future day after the habit's creation date.
- Reorder by dragging the card (on the Today tab): a long press (250 ms) on touch, so a normal swipe still scrolls, or a 6 px mouse drag. The grip handle on every card is the keyboard route (Space to pick up, arrows to move). The new order is saved as `sort_order`.
- Tapping a card (anywhere but the check-in circle and the grip) opens it in `HabitEditorDialog`. In edit mode the dialog also links to the habit's stats page (`/habits/[habitId]`, "Details & stats") and offers "Archive habit". Archiving hands over to the existing confirmation dialog, so it stays two steps. The cards carry no separate edit/archive icons or up/down buttons.
- Archive with confirmation. Long names wrap in the confirmation title and are clamped to two lines in the Archived list, clear of the Restore button. On a phone the editor's Save/Cancel footer sticks to the sheet's bottom edge and covers its padding, so the form never shows underneath it.
- Restore.
- Retry failed mutations after optimistic rollback.

Active habits cannot share the same normalized name.

Unchecking updates the matching log to `completed=false`; it does not delete the row. This preserves history and any journal linkage.

### Check-in rewards

Checking a habit true for the day grants XP and coins; unchecking claws them back. See [Gamification](./gamification.md#habit-check-in-xp) for the streak-multiplier formula and dedup guarantee. Reward failures are caught separately from the log save — a failed reward grant is logged to the console but does not roll back the check-in itself, since the log write is the source of truth for completion state.

The optional skill category set on a habit is copied onto its XP events, feeding the per-category totals on `/analytics`.

### Timezone

Habit date keys use the profile's IANA timezone. Do not replace this with the browser timezone or raw UTC date.

## Habit analytics

`/habits/[habitId]` provides the following. For a habit younger than 14 days it shows only the current streak and total check-ins, a "Not enough data yet … (day N of 14)" note, and, before the first check-in, a highlighted "Ready for the first check-in" card; completion rate, longest streak, weekly trend and weekday pattern appear from day 14:


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


## Project checklist compatibility

Main tasks remain the canonical Tasks/Planner items. `parent_task_id` identifies one-level project checklist rows; ordinary task reads, dashboard counts, Daily Planner suggestions, calendar and Productivity task lists exclude them and cancelled tasks. Task IDs in saved day plans remain unchanged when project assignments change. The shared editor's optional project context is used only by Projects. Completing checklist items neither auto-completes the parent nor awards admin XP.

Contacts link to existing main tasks via task_contacts. Editing contact assignments preserves project/Planner metadata; completion does not imply a real-world interaction. TaskEditorDialog accepts optional contact selectors and creation defaults. Public task screens do not query private contact attributes.

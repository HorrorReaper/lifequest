# Today planning, tasks, habits, and routines

## Today Plan

`/plan` is the daily planner implemented by `TodayPlanner`. It has two modes:

- **Plan editor.** When today already has blocks, `/plan` opens straight on the timeline (`TodayPlanScreen` passes `startAt="timeline"`). The header shows "Edit today's plan" and a save state ("All changes saved", "Unsaved changes", "Saving…", "Saved at HH:mm") instead of step numbers. The page is the same timeline as the ritual's timeline step (day hours, "Add to your day", "Also today"). The footer has "Dashboard" and "Save plan"; Save is disabled until something changed. Saving (`savePlanEdits`) writes the plan and stays on the timeline. It does not require a main priority, keeps `ritual_completed_at` (or sets it if the plan never had one), and on failure keeps the edits on screen with "Not saved. Your changes are still here in this tab.", turns the header status red ("Not saved") and scrolls the message into view, since Save sits in the footer and the message at the end of the page.
 Leaving with unsaved changes offers "Save plan", "Continue editing", "Leave and keep draft" and "Discard draft". `?step=timeline` opens the same editor.
- **Daily ritual.** Without blocks, or with `?step=ritual` (linked from the editor as "Start the full daily ritual instead (mood, intention, priorities)"), the five-step ritual below runs from the start.

### Steps

The step order lives in `src/components/planning/planner-steps.ts` (`PLANNER_STEP_IDS`). The header reads "Step N of 5", from 640px up with the step name in front ("Shape your day · Step 4 of 5"), over a five-part progress bar.

1. **Mood** — how the day starts; optional reasons. Required to go on.
2. **Intention** — the day's guiding line. Optional.
3. **Priorities** — "What matters most today?" ("Choose one focus. Add one more if there’s room."). One main focus (required), one optional second task, and a separate, optional moment to recharge. See [Priorities step](#priorities-step). "Next" turns the chosen priorities into blocks (`buildTodayPlanSchedule`).
4. **Shape your day** — "Make room for your day". The timeline, with the day hours, "Add to your day" and "Also today" around it. See [Timeline step](#timeline-step). Its forward button reads "Review plan"; it refuses to go on while a block is invalid, two blocks overlap, or the day ends before it starts.
5. **Review** — the main focus and intention, the day's blocks in time order with the capacity line, the day-end reminder, what is kept flexible, conflicts, and "Save today's plan".

Daily anchors used to be a step of their own between the priorities and the timeline. Its parts moved into the timeline step: the day hours into the line above the timeline, habits and reflections into "Add to your day" and "Also today". The footer shows "Back" (on the first step "Dashboard"), "Draft · not saved" from 400px up, and "Next".

Each outcome can include a duration and a linked existing task. The day also has start and end times and an optional day-end reminder.

### Priorities step

`src/components/planning/TodayPriorities.tsx` renders the step as an overview with no form on it. There are three rows, separated by hairlines rather than boxed in cards, so the main focus visibly outweighs the rest:

- **Your main focus** (`must_win`). It has a thin primary-coloured accent on the left. The chosen title is set larger than the line under it, which shows the block length and, for a linked task, its due date (`describeTaskDue` in `src/lib/today-plan.ts`: "Due today", "Due tomorrow", "Due Aug 3", "Overdue since Jul 20"). A plain-text focus shows "Not saved as a task" instead. Empty, the row reads "Choose your main task", with "Required. If you finish one thing today, make it this." under it. "Next" without a main focus shows "Choose your main focus before moving on." and turns the accent to the destructive colour. The main focus can be changed but not removed.
- **Also worth doing** · Optional (`progress`). Less weight: base-size title, muted empty state "Choose a second task". When filled it has a "Remove second task" button beside the row.
- **A moment to recharge** (`health`). Its own section under a second hairline, with a leaf icon and "Make room for yourself, too.". The action button reads "Add", or the chosen activity once there is one, with "Remove recharge moment" beside it. Recovery is not a third priority level.

Every row is a single button with a visible change indicator (chevron; "Change" from 400px up). It opens `src/components/planning/PriorityPickerDialog.tsx`, a compact dialog with:

- The current choice, if any. Its "Block length" in minutes (5–240, digits only, typed digit by digit, snapping back on blur when unusable) lives here instead of on the overview. For the second task and recharge there is also "Remove from today".
- The task search: `TaskCombobox` in its `inline` mode (`src/components/planning/TaskCombobox.tsx`). The list stays under the field instead of in a popup, shows every loaded task with due date, estimate and "High priority" on a second line, and is navigated with the arrow keys through `aria-activedescendant`. A title with no exact match offers "Create task “…”" and "Plan “…” without a task". The first creates a real task through `createTask` with only the title. The second keeps the outcome as plain text (`task_id: null`), as earlier plans could.
- For recharge only, while the search is empty, three starting points as plain text: "Go for a walk", "Stretch for 10 minutes", "Read a book".

Choosing closes the dialog straight away. The overview shows the result, a polite live region announces it, and focus returns to the row that opened the picker. Removing from the overview also puts focus back on that row. With a pointer or keyboard the search field takes focus on open. On touch the dialog title does, so the on-screen keyboard does not cover the list. A task creation that fails keeps the dialog open with "Could not create the task. Please try again." and the typed title. A second create cannot start while one is running.

A task can hold only one role for the day. The picker leaves out tasks used by another role, and `assignTaskToRole` in `TodayPlanner` refuses one that slipped through. Choosing a task for today only writes the plan: the task's record, including its due date, is not updated. A created task gets no due date.

Going back from the timeline and changing a priority updates its block: `buildTodayPlanSchedule` gives an existing block with that `outcome_role` the new title and task link (`source_type`/`source_id`) and keeps its times, and drops the block of a priority that was removed. Going back and forward again never adds a second block for the same priority.

### Timeline step

From top to bottom, in one column of at most 48rem (no side panels):

1. **Day hours line** (`src/components/planning/DayFrameBar.tsx`): "Your day · 08:00–18:00", under it "Day-end reminder · 18:00 · No time block" (or "No day-end reminder"), and "Edit day hours". The button opens `DayHoursDialog.tsx` with "Day starts", "Day ends", a "Day-end reminder" switch ("Optional. A marker on the timeline; it reserves no time.") and "Reminder at". Problems are stated under their field ("Your day has to end after it starts.", "The reminder has to come after your day starts.", "Choose a time for the reminder, or turn it off.") and Apply stays disabled until they are fixed. Cancel and Escape change nothing. When the new hours would leave blocks outside, the dialog lists them ("1 block falls outside these hours.", title and times) and says they stay where they are. Applying never moves or deletes a block.
2. **"Add to your day"**, the step's main action, with "Tasks, habits, reflections, breaks or anything else." beside it.
3. A conflict banner when blocks overlap: "Two blocks want the same minutes." with "Space them out" (`resolveOverlaps`).
4. **The timeline** (`src/components/planning/PlanTimeline.tsx`), described below, with a line on how to drag under it.
5. **Capacity line** (`PlanCapacityLine.tsx`), e.g. "2h 15m scheduled · 7h 45m unplanned". See [Capacity](#capacity).
6. **Also today** (`AlsoToday.tsx`), see [Flexible habits and reflections](#flexible-habits-and-reflections).

#### The timeline

A block is as tall as it is long (1.2px per minute). Each shows its title and, from 40 minutes up, "08:00–09:30 · 1h 30m" plus its priority ("Main focus", "Second task", "Recharge"), "Outside day hours" and "Overlaps" where they apply. Shorter blocks show title and times on one line. Only the main focus has a tinted fill; other blocks are card-coloured with a thin category or mission colour on the left edge. A block outside the day hours has a dashed border and `data-outside="true"`, and the time outside the day hours is shaded.

Free time at least 20 minutes long carries a visible "+ 45m free" label. Hovering previews the hour that would be offered; tapping (or Enter on the focused gap) opens "Add to your day" with that start filled in and suggested lengths capped to the room before the next block.

Free time of two hours or more (`COMPRESS_FREE_MINUTES`) is folded into one 48px row: "12:00–18:00 · 6h 15m free" with "Show" (`aria-expanded="false"`). Only free time folds, so every block keeps its real height and its real distance to its neighbours (`timelineSegments`, `offsetForMinute`, `minuteForOffset` in `src/lib/today-plan.ts`). "Show" opens that stretch at scale; "Show full day" above the timeline opens all of them and "Compact view" folds them again. The layout is held still while a block is dragged.

The day-end reminder is a dashed line across the timeline labelled "Day-end reminder · 18:00". It is never a block and is not counted.

Blocks are dragged to move and pulled at the always-visible bar on their bottom edge to lengthen (a thin strip on blocks under 20 minutes, so a tap still opens them). Both go through `applyBlockTimeChange`, which carries every later block along by the same amount. While dragging, a polite line above the timeline says where the block is and how many later blocks it moves ("Also moves 2 later blocks."). A drag that moved does not also open the block.

Tapping a block, or Enter/Space on it, opens `BlockEditorDialog.tsx` ("Edit block"), the full alternative to dragging: title, "Starts", "Ends" (moving the start keeps the length), "Type", and for a priority block "Main focus for today · linked to a task". Nothing changes until Apply; Cancel leaves the day as it was. Problems are stated at their field ("Give this block a title.", "Enter a start time.", "The end time has to be after the start time.") and disable Apply. When the new times would push later blocks, a group titled "This change moves N later blocks" lists them with their new start and shift ("Side quest → 09:45 (+30m)") and offers "Move them along" or "Keep them where they are". An overlap that results is named at the start or end field ("Overlaps “Side quest” (09:15–10:00). You can still apply and space them out on the timeline."). "Remove from plan" takes the block out of today's plan and says what stays ("Removing it keeps the task in your task list."); a habit or reflection block also offers "Keep flexible instead". Arrow keys move a focused block by 5 minutes, Shift with an arrow changes its length; the hint is tied to each block through `aria-describedby`. A block whose times cannot be drawn is listed under the timeline with "needs a valid time" and opens the same editor.

#### Add to your day

`src/components/planning/AddToDayDialog.tsx`, opened by "Add to your day", by tapping free time, and from "Also today". "What to add" is a row of choices: Task, Habit, Reflection, Break, General, and for admins with workouts Training.

- **Task**: the inline `TaskCombobox` (search, "Create task “…”", "Plan “…” without a task"). Tasks already on the timeline are not offered. The chosen task shows its due date with "its due date stays as it is"; the planned time is stored in the block only.
- **Habit** and **Reflection**: a list of the user's habits or journal templates. Habits and reflections already done today are hidden; "Show completed (N)" shows them, marked "Done today". Each row says its suggested length and, when already planned, "In today's plan · 10:00–10:15" or "In today's plan · no time reserved". Reflections say "Built-in template" or "Your template", and templates with the same name keep the "(standard)" / "(your copy)" names from `journalAnchorTitles`. Then "Planning": **"Reserve a time block"** (start and length) or **"Keep flexible"** ("On today's list, no time reserved.").
- **Break**: a name ("Break" by default) and a time block.
- **General**: a "Title" (required: "Give the block a title.") and a time block, for anything that is neither a task nor a habit, such as lunch or a call. It is saved as a plain block (`category: "other"`, `source_type: "manual"`, no `source_id`, no mission) and creates no task, habit or anchor; "Plan “…” without a task" under Task does the same from the search field.
- **Training**: always a time block.

Time blocks take "Starts" and "Length" (5 minutes to 4 hours). The field states problems ("Enter a start time.", "This would run past midnight. …"), a collision ("Overlaps “Side quest” (09:15–10:00).") with a button to "Start at 10:00 instead" (`firstFreeStart`), or that the time is outside the day hours; otherwise "Ends at 10:45". Without a choice, confirming says "Choose a task, or type a title." (or "Choose a habit." / "Choose a reflection."). The confirm button reads "Add to your day", or "Update today's plan" for a habit or reflection already in the plan.

Nothing is planned twice: the dialog accepts one confirm and closes, a task already on the timeline is retimed instead of added again, and habits and reflections go through `reserveAnchorBlock` and `keepAnchorFlexible`, which keep one anchor and at most one block per habit or template. Planning is not doing: nothing here checks off a habit or writes a journal entry, and habits stay on their normal pages whether planned or not.

#### Flexible habits and reflections

A habit or reflection kept flexible is stored in `metadata.anchors` without a block (`flexibleAnchors`). A reserved one is the same anchor plus one block with `mission_type: "anchor"`, `source_type` `habit` or `journal` and `source_id` the habit or template id (`blockForAnchor` matches on these, never on the title). Training (`source_type: "workout"`) always gets a block.

"Also today" lists the flexible ones as rows: emoji, title, "Habit" or "Reflection" and, separately, "Done today" when the habit or template is already done. Each row has "Set a time" (opens the dialog on that item with "Reserve a time block") and "Remove … from today's plan". Removing drops the anchor and any block of it; the habit or template and its history are untouched. An empty list shows one line instead of a box. The section header has "Add" for a flexible item. Turning a reserved block back with "Keep flexible instead" removes only its block.

#### Capacity

`calculateTodayPlanCapacity` counts the minutes covered by valid blocks, merging overlaps so shared minutes count once (`occupiedSpans`). Minutes inside the day hours are "scheduled"; the day hours left over are "unplanned", never negative. Minutes before the start or after the end are reported apart ("· 45m outside your day hours", in amber) and set the status to `over`. Flexible habits and reflections and the day-end reminder never count. When blocks overlap the line adds "· overlapping time counted once"; the overlap itself is flagged by `findTodayPlanBlockProblems` as before. Invalid blocks count as 0 minutes.

At least one main priority is required to finish the ritual; the plan editor does not ask for one.

### Persistence and drafts

The committed plan is stored in `day_plans`. Rich Today Plan metadata is serialized into the notes field with the prefix:

```text
LIFEQUEST_TODAY_PLAN_V1:
```

The envelope preserves legacy free-form notes rather than replacing them. `shutdown_time` is `""` when the day-end reminder is turned off; a missing or unreadable value still falls back to the day's end, as plans from before the switch expect.

Before commitment, the planner stores a user-and-date-scoped draft in `sessionStorage` (`lifequest:today-plan:<userId>:<date>`): the metadata, the blocks, and the step it was on as a step id (`"timeline"`). A restored draft shows "Your unfinished plan was restored." and reopens on that step, but never past a missing answer: without a mood on the mood step, without a main focus on the priorities (`furthestStepFor`). Drafts from before the anchors step was folded in carry no step (reopen at the start), an old step index (0–5 of the six-step order) or the name `anchors`; `resolvePlannerStep` maps the old anchors step to the timeline. The plan editor ignores the stored step. Closing or leaving a dirty plan asks for discard confirmation. No database write occurs until commit, apart from creating a task from a picker or "Add to your day".

Saving is guarded against double taps by a ref, so a second tap while a save runs sends nothing. A failed final save keeps every choice on screen and in the draft, shows "Your plan is still safe in this tab, but it could not be saved." with "Retry save", and stays on the review step. Removing anything from the plan only changes `day_plans`; tasks, habits, journal templates and their history are separate records.

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

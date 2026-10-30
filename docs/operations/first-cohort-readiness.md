# First-cohort readiness (2026-10-25)

Implementation list for the UX test report "LifeQuest – UX-Praxistest: Tasks,
Habits & Daily Plan" (Notion, 2026-10-25) and its plan L-01 to L-14. Branch:
`feat/first-cohort-readiness`, based on `feat/top-bar-avatar-nav` because the
test ran against that state (top bar, dashboard sections).

Status legend: `[ ]` open · `[~]` implemented and covered by automated tests,
not checked in the running app · `[x]` implemented and checked in the running
app (evidence noted).

## How the browser check was run

On 2026-10-25 in the app's built-in browser against the local dev server
(`localhost:3000`), signed in as the maintainer's own account with
onboarding reset for debugging. **No fresh standard account was available**
(sign-up goes to the hosted Supabase project), so the account already had
level, habits, tasks and a three-block plan for the day. The account is an
admin account, not the "viewing as a normal user" preview. Everything created
is marked `UX-Test ·`. Widths checked: desktop (977 px), 360, 390, 430, and
640 × 423 as the CSS viewport of a 1280 × 846 window at 200 % zoom. No real
phone, no on-screen keyboard, no screen reader.

## 1. Confirmed blockers

- [x] Task calendar hidden behind the task dialog (T-01 / L-02). The layer is
  on the popover's positioner (`src/components/ui/popover.tsx`). Checked:
  calendar opens above the dialog; `elementFromPoint` at a day returns the
  day; a mouse click on Oct 29 set "Due Oct 29" and left the priority
  unchanged (that click used to change the priority); saved, reloaded, filed
  under Upcoming. Keyboard: Tab to the trigger, Enter opens with focus on the
  selected day, arrows + Enter pick, Escape closes only the calendar, "Clear
  date" clears it. Found and fixed during the check: "Choose date" did
  nothing on a task already due today (regression test added), and in a
  423 px-tall window the calendar ran off the top (now capped to the
  available height and scrollable). Mobile widths use the native date input.
- [x] "Add habit" covered by the bottom navigation (H-01 / L-03). At 360,
  390 and 430 px the button is in the page header and a tap reaches it; the
  last habit ends at 640 px with the navigation starting at 765 px (390 ×
  844). Found and fixed: the edit sheet's Save/Cancel footer let the form
  show underneath it on a phone.
- [x] "all done" when blocks are only past (P-01 / L-05). With the account's
  real plan (three past blocks whose tasks are still open) the section shows
  "Open" on each and no "all done". The running block shows "Now · until
  21:30"; after "Mark task done" it reads "Task done. 34 min left in this
  block." and the row says "task done".

## 2. UI basis (L-01)

- [x] Shared page header, one completion control per item, field-level
  errors and save states on tasks, habits, plan, onboarding and feedback.
- [x] Error colour contrast measured in all four themes (≥ 4.5:1). In the
  browser only the light theme was looked at.

## 3. Dashboard (L-04)

- [x] Order greeting + date → Next up → plan → habits → tasks → journal
  nudge, challenge, metric, reflection (390 px and desktop).
- [~] Fresh-account empty states ("Add your first task", "Plan your day"):
  covered by unit tests only, the account was not empty.

## 4. Onboarding (L-06)

- [x] Three steps, name carried over ("Hi Patrick"), timezone as one line with
  "Change timezone", no age question, focus suggestions.
- [x] No duplicates: double-click on "Save task" → one task; Back + edited
  title → same task id updated; reload mid-flow → saved task restored;
  double-click on "Plan it and finish" → one block. The existing three blocks
  of the day were kept.
- [x] Welcome card with habit and optional reflection. Found and fixed: it
  disappeared about a second after arriving.

## 5. Tasks (L-07)

- [x] "Task" in the + menu opens the form with the title focused; `?new=1` is
  removed after closing.
- [x] Today / Tomorrow / Choose date / No date, each persisted and filed in
  the right view after reload.
- [x] Accessibility tree: exactly one checkbox per task, named "Complete …".
- [x] "Due today" and "In today's plan" shown separately.
- [x] "Clear search and filter"; empty search result text and button.
- [x] Complete → +5 XP; reopen keeps XP; complete again → no XP.
- [x] Closing with unsaved input asks first. Fixed wording for new tasks
  ("Discard this new task? It has not been saved yet.").

## 6. Habits (L-08)

- [x] Create with name only (details folded), 🌱 icon, "Daily", "Ready for
  its first check-in", two-line names.
- [x] Check in → +10 XP, +3 coins, streak 1, "Done today"; undo → values back
  exactly.
- [x] Archive (confirmation explains history is kept) → Archived → Restore →
  back after reload. Found and fixed: long names ran under the Restore button
  and under the dialog's close button.
- [x] Stats page of a new habit: first check-in card, streak and total only,
  "Not enough data yet (day 1 of 14)". Period switch now hidden until then.

## 7. Day plan (L-09)

- [x] `/plan` with a plan opens the editor: no steps, save state, "Saved"
  disabled until a change, ritual link.
- [x] End time changed with real keystrokes (20:45–21:00 → 21:30); invalid
  end explained in the block editor; Save refused with an explanation and the
  broken block listed; leave → keep draft → draft restored; simulated
  network failure → "Not saved", edits kept; save → "Saved at 20:52"; reload
  shows 21:30 and the other three blocks unchanged.
- [x] Resize pills visible without hover. Found and fixed: on a 15-minute
  block the new 16 px handle covered the block and swallowed taps.
- [x] "Capacity of scheduled blocks" label.
- [~] Anchor grouping and copy names: unit-tested; the ritual's anchor step
  was not opened in the browser.

## 8. Language and accessibility (L-10 / L-11)

- [x] "Library", "Profile" tab, English dates in task rows.
- [x] Input kept and one message per failure (task dialog, onboarding,
  feedback, plan save).
- [x] No horizontal overflow on dashboard, tasks, habits, plan, profile and
  library at 360, 430 and the 200 % equivalent.
- [ ] Screen reader pass and real phone with on-screen keyboard.

## 9. Feedback and activation (L-12)

- [x] Feedback dialog reachable; failure state checked (text kept, one
  message). The send fails because the table does not exist yet.
- [ ] **Migration `20261025120000_beta_feedback_and_activation.sql` not
  applied**, so the success path and the `/admin/tools` funnel are untested.

## 10. Verification (L-13)

- [x] Automated after the browser fixes: `npx vitest run` 150 files / 1178
  passed (1 skipped); `npx tsc --noEmit` clean; `npx eslint` clean on every
  changed file (30 pre-existing errors elsewhere); `npx next build` passed.
- [x] Browser: the flows above.
- [ ] A truly fresh standard (non-admin) account, day change, another
  timezone, slow connection (only a hard failure was simulated), real phone.

## Test data left in the account

- Tasks: "UX-Test · Onboarding first task edited" (completed, due today, with
  a plan block 20:45–21:30) and "UX-Test · Calendar future date" (completed).
- Habit: "UX-Test · Read ten pages of a book before going to bed every
  evening" (active, no check-in).
- Nothing of the account's existing data was edited or deleted.

## Remaining manual release (L-14)

A short test with three to five independent people, without explaining the
UI: plan an important task for today, create a daily habit and check it off,
change the day plan. Record interventions and misunderstandings.

# Today's Plan — inline task combobox for Progress/Health, remove "Pull from tasks" sidebar

> Date: 2026-08-08
> Status: Approved
> Scope: `src/components/planning/TodayPlanner.tsx`, Step 2 ("Top Three") only.

## Problem

Step 2 of the Today's Plan ritual (`STEPS[1]`, "Top Three") lays out the Must Win /
Progress / Health outcome cards next to a "Pull from tasks" sidebar
(`TodayPlanner.tsx:841-911`). The sidebar lists open tasks and assigns the clicked
task to whichever outcome card is currently active.

Must Win already has its own inline search-and-create field (`TaskCombobox`,
`TodayPlanner.tsx:754-774`), so the sidebar is redundant when working on Must
Win. But Progress and Health only have a plain `<Input>` — the sidebar is
currently their *only* way to link a task, which means the UI keeps a
whole extra section around just to serve two of the three cards.

## Design

1. **Reuse `TaskCombobox` for Progress and Health.** Replace the plain
   `<Input>` for the `progress` and `health` outcome roles
   (`TodayPlanner.tsx:775-797`) with the same `<TaskCombobox>` component
   already used for `must_win`, wired to that card's own role:
   - `onSelectTask` → `assignTaskToRole(role, task)`
   - `onCreateTask` → `createAndAssignTask(role, title)`
   - `onChangeText` → `updateOutcome(role, { title: text, task_id: null })`

   No changes needed to `assignTaskToRole` or `createAndAssignTask` — both
   already take an explicit `role` argument rather than relying on shared
   state, so this is a direct reuse, not a rewrite.

2. **Delete the "Pull from tasks" sidebar.** Remove the `<aside>` block
   (`TodayPlanner.tsx:841-911`) entirely. Change the Step 2 grid from
   `lg:grid-cols-[1.2fr_0.8fr]` to a single full-width column
   (`TodayPlanner.tsx:709`).

3. **Remove now-dead state.** With the sidebar gone, nothing reads
   `activeRole` except the click-to-highlight ring on the outcome cards
   (`TodayPlanner.tsx:721`, `onClick={() => setActiveRole(role)}`) and the
   sidebar-only `assignTask` helper (`TodayPlanner.tsx:387-389`). Remove:
   - `activeRole` / `setActiveRole` state (`TodayPlanner.tsx:278-279`)
   - `assignTask` function (`TodayPlanner.tsx:387-389`)
   - the card's `onClick={() => setActiveRole(role)}` and the
     `activeRole === role && "ring-2 ring-primary/30"` class
     (`TodayPlanner.tsx:721,727`)

## Out of scope

- No change to the outcome data model (`TodayPlanOutcome`, `task_id`,
  `duration_minutes`).
- No change to task creation (`createTask`) or the `taskList` state itself.
- No change to any other Today's Plan step (Reset, Anchors, Timeline,
  Commit).
- No change to `TaskCombobox` itself — it is already role-agnostic.

## Testing

- `TodayPlanner.test.tsx` has no existing coverage of the sidebar or of
  Progress/Health task-linking, so this is net-new test surface, not a
  migration of existing tests. Add coverage for: selecting an existing
  task into Progress/Health via combobox, creating a new task from
  Progress/Health, and confirming the sidebar/aside is no longer rendered
  in Step 2.
- `TaskCombobox.test.tsx` is unaffected (component itself doesn't change).

# Today's Plan — Inline Task Combobox for Progress/Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared "Pull from tasks" sidebar in Today's Plan Step 2 ("Top Three") with a per-card `TaskCombobox`, so Must Win, Progress, and Health can each search-or-create a task inline, without a separate section.

**Architecture:** `TaskCombobox` (`src/components/planning/TaskCombobox.tsx`) is already role-agnostic and already used for the Must Win card. This plan extends that same component to the Progress and Health cards inside `TodayPlanner.tsx`, deletes the `<aside>` sidebar and the `activeRole` state it existed to serve, and fixes the loading/error state (previously a single shared boolean/string, safe only because just one card could create tasks) to be tracked per-role now that all three cards can create tasks concurrently-in-sequence.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library.

## Global Constraints

- Single file behavior change: `src/components/planning/TodayPlanner.tsx`. `TaskCombobox.tsx` itself is not modified — it is already generic.
- No changes to the outcome data model (`TodayPlanOutcome`), `createTask` API, or `taskList` state shape.
- No changes to any other Today's Plan step (Reset, Anchors, Timeline, Commit).
- Design source: `docs/superpowers/specs/2026-08-08-today-plan-inline-task-combobox-design.md`.

---

### Task 1: Give Progress/Health their own TaskCombobox, remove the "Pull from tasks" sidebar

**Files:**
- Modify: `src/components/planning/TodayPlanner.tsx`
- Test: `src/components/planning/TodayPlanner.test.tsx`

**Interfaces:**
- Consumes: `TaskCombobox` props unchanged (`ariaLabel`, `tasks`, `linkedTaskId`, `value`, `onChangeText`, `onSelectTask`, `onCreateTask`, `creating`, `placeholder`) — from `src/components/planning/TaskCombobox.tsx`, already imported.
- Consumes: `assignTaskToRole(role: DayPlanOutcomeRole, task: TodayPlannerTask)` and `createAndAssignTask(role: DayPlanOutcomeRole, title: string): Promise<void>` — both already defined in this file and already take an explicit `role`, so their call sites change but their signatures do not.
- Produces: no new public interface. `TodayPlanner`'s own props and default export are unchanged — this is an internal-only refactor. Two internal state variables change shape (not exported, but noted for anyone reading this file later): `creatingTask: boolean` → `creatingRole: DayPlanOutcomeRole | null`, and `createTaskError: string | null` → `createTaskError: { role: DayPlanOutcomeRole; message: string } | null`.

This task is one unit because the test suite cannot pass with only half of it: removing the sidebar without wiring Progress/Health to their own combobox would strand those two roles with no task-linking UI at all, and the updated test for Must Win's flow only compiles against the post-change interaction pattern.

- [ ] **Step 1: Update `TodayPlanner.test.tsx` — fix the Must Win interaction and add sidebar-removal coverage (RED)**

The existing "builds the timeline" test currently assigns Must Win by clicking a plain `<button>` rendered by the "Pull from tasks" sidebar (implicit role `button`). Once the sidebar is deleted in Step 3 below, that button won't exist — the test must instead open the Must Win combobox and click its dropdown option, which has `role="option"` (see `TaskCombobox.tsx:156-186`). Also add a new test that asserts the sidebar heading text is gone and that Progress has its own working combobox.

In `src/components/planning/TodayPlanner.test.tsx`, replace:

```tsx
  it("builds the timeline and performs one final write", async () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: /Write launch brief/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
```

with:

```tsx
  it("builds the timeline and performs one final write", async () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.focus(screen.getByLabelText("Must Win outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
```

(The rest of that test — from `fireEvent.click(screen.getByRole("button", { name: /Read/ }));` through the end — is unchanged.)

Then add a new test directly after it (before `"restores an unfinished tab-local draft"`):

```tsx
  it("gives Progress and Health their own task combobox instead of a shared sidebar", () => {
    render(<TodayPlanner {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.queryByText("Pull from tasks")).toBeNull();

    fireEvent.focus(screen.getByLabelText("Progress outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));

    expect(screen.getByDisplayValue("Write launch brief")).toBeTruthy();
    expect(screen.getByLabelText("Health outcome")).toHaveProperty("value", "");
  });
```

- [ ] **Step 2: Run the tests and confirm the right failures**

Run: `npx vitest run src/components/planning/TodayPlanner.test.tsx`

Expected: FAIL. The new test fails because `screen.getByLabelText("Progress outcome")` currently renders a plain `<Input>`, not a combobox, so `getByRole("option", ...)` after focusing it finds nothing (no dropdown). The updated "builds the timeline" test fails because `getByRole("option", { name: /Write launch brief/ })` doesn't exist yet either (the Must Win combobox works today, but this failure confirms the test file is exercising the right element before you change any production code — if it unexpectedly passes, stop and re-check the query).

- [ ] **Step 3: Track task-creation loading/error state per role**

The shared `creatingTask`/`createTaskError` state was safe when only Must Win could create a task. Now that Progress and Health can too, track which role is creating so the spinner and error message show under the correct card, not all three (or the wrong one).

In `src/components/planning/TodayPlanner.tsx`, replace:

```tsx
  const [creatingTask, setCreatingTask] = useState(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
```

with:

```tsx
  const [creatingRole, setCreatingRole] = useState<DayPlanOutcomeRole | null>(
    null
  );
  const [createTaskError, setCreateTaskError] = useState<{
    role: DayPlanOutcomeRole;
    message: string;
  } | null>(null);
```

Then replace the `assignTask` helper and `createAndAssignTask` function:

```tsx
  function assignTask(task: TodayPlannerTask) {
    assignTaskToRole(activeRole, task);
  }

  async function createAndAssignTask(role: DayPlanOutcomeRole, title: string) {
    const trimmed = title.trim();
    if (!trimmed || creatingTask) return;

    setCreatingTask(true);
    setCreateTaskError(null);
    try {
      const created = await createTask(supabase, userId, { title: trimmed });
      const plannerTask: TodayPlannerTask = {
        id: created.id,
        title: created.title,
        dueDate: created.due_date,
        priority: created.priority,
        isOverdue: false,
        estimateMinutes: null,
      };
      setTaskList((current) => [plannerTask, ...current]);
      assignTaskToRole(role, plannerTask);
    } catch (error) {
      console.error("Failed to create task from Today Plan", error);
      setCreateTaskError("Could not create the task. Please try again.");
    } finally {
      setCreatingTask(false);
    }
  }
```

with (note `assignTask` is deleted — it only existed to read the now-deleted `activeRole`, and its only caller was the sidebar being removed in Step 4):

```tsx
  async function createAndAssignTask(role: DayPlanOutcomeRole, title: string) {
    const trimmed = title.trim();
    if (!trimmed || creatingRole) return;

    setCreatingRole(role);
    setCreateTaskError(null);
    try {
      const created = await createTask(supabase, userId, { title: trimmed });
      const plannerTask: TodayPlannerTask = {
        id: created.id,
        title: created.title,
        dueDate: created.due_date,
        priority: created.priority,
        isOverdue: false,
        estimateMinutes: null,
      };
      setTaskList((current) => [plannerTask, ...current]);
      assignTaskToRole(role, plannerTask);
    } catch (error) {
      console.error("Failed to create task from Today Plan", error);
      setCreateTaskError({
        role,
        message: "Could not create the task. Please try again.",
      });
    } finally {
      setCreatingRole(null);
    }
  }
```

Also delete the now-unused `activeRole` state declaration:

```tsx
  const [activeRole, setActiveRole] =
    useState<DayPlanOutcomeRole>("must_win");
```

(This sits directly above the `taskList` state declaration, right after `const [step, setStep] = useState(0);` — remove the two lines and update the comment on the line below from referencing "the Must Win combobox" / "the sidebar" since both are now stale; see Step 4 for the corrected comment.)

- [ ] **Step 4: Update the comment above `taskList`**

Replace:

```tsx
  // Seeded from the server-loaded prop, then grown locally so a task created
  // inline from the Must Win combobox shows up immediately here and in the
  // "Pull from tasks" sidebar without a round trip back to the server.
  const [taskList, setTaskList] = useState<TodayPlannerTask[]>(tasks);
```

with:

```tsx
  // Seeded from the server-loaded prop, then grown locally so a task created
  // inline from any outcome's combobox shows up immediately in the other
  // two comboboxes without a round trip back to the server.
  const [taskList, setTaskList] = useState<TodayPlannerTask[]>(tasks);
```

- [ ] **Step 5: Replace the Step 2 ("Top Three") card grid and delete the sidebar**

Replace the entire `{step === 1 && ( ... )}` block with the version below. This:
- Renders `TaskCombobox` for all three roles instead of only `must_win`, each wired to its own `role`.
- Removes `onClick={() => setActiveRole(role)}` and the `activeRole === role && "ring-2 ring-primary/30"` ring highlight from the `Card` (nothing reads `activeRole` anymore).
- Makes `overflow-visible` unconditional on the `Card` (every role's dropdown now needs to escape the card's clipping, not just Must Win's).
- Shows the create-task error under whichever card's role matches `createTaskError.role`, instead of hardcoding `must_win`.
- Deletes the `<aside>` sidebar and collapses the two-column grid (`lg:grid-cols-[1.2fr_0.8fr]`) into a single-column `space-y-4` list.

Old:

```tsx
          {step === 1 && (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                {(Object.keys(OUTCOME_META) as DayPlanOutcomeRole[]).map(
                  (role) => {
                    const outcome = roleOutcome(metadata, role);
                    const item = OUTCOME_META[role];
                    const Icon = item.icon;
                    return (
                      <Card
                        key={role}
                        className={cn(
                          "rounded-3xl transition",
                          activeRole === role && "ring-2 ring-primary/30",
                          // Card clips overflow by default for rounded image
                          // corners; must_win needs its combobox dropdown to
                          // escape that clip, and nothing here relies on it.
                          role === "must_win" && "overflow-visible"
                        )}
                        onClick={() => setActiveRole(role)}
                      >
                        <CardContent className="space-y-4 p-5 sm:p-6">
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                                item.style
                              )}
                            >
                              <Icon className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-semibold">{item.label}</h2>
                                <Badge
                                  variant="outline"
                                  className={cn("rounded-full", item.style)}
                                >
                                  {item.mission}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {item.helper}
                              </p>
                            </div>
                          </div>
                          {role === "must_win" ? (
                            <TaskCombobox
                              ariaLabel={`${item.label} outcome`}
                              tasks={taskList}
                              linkedTaskId={outcome?.task_id ?? null}
                              value={outcome?.title ?? ""}
                              onChangeText={(text) => {
                                setActiveRole(role);
                                updateOutcome(role, { title: text, task_id: null });
                              }}
                              onSelectTask={(task) => {
                                setActiveRole(role);
                                assignTaskToRole(role, task);
                              }}
                              onCreateTask={(title) => {
                                setActiveRole(role);
                                void createAndAssignTask(role, title);
                              }}
                              creating={creatingTask}
                              placeholder="What must move today? Search or create a task…"
                            />
                          ) : (
                            <Input
                              aria-label={`${item.label} outcome`}
                              value={outcome?.title ?? ""}
                              onFocus={() => setActiveRole(role)}
                              onChange={(event) =>
                                updateOutcome(role, {
                                  title: event.target.value,
                                  task_id:
                                    event.target.value === outcome?.title
                                      ? outcome?.task_id ?? null
                                      : null,
                                })
                              }
                              maxLength={160}
                              placeholder={
                                role === "progress"
                                  ? "What creates forward momentum?"
                                  : "What protects your energy?"
                              }
                              className="h-12 rounded-xl text-base"
                            />
                          )}
                          {role === "must_win" && createTaskError && (
                            <p role="alert" className="text-xs text-destructive">
                              {createTaskError}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">
                              {outcome?.task_id
                                ? "Linked to a task"
                                : "Standalone outcome"}
                            </span>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              Budget
                              <select
                                aria-label={`${item.label} time budget`}
                                value={
                                  outcome?.duration_minutes ??
                                  item.defaultDuration
                                }
                                onChange={(event) =>
                                  updateOutcome(role, {
                                    duration_minutes: Number(
                                      event.target.value
                                    ),
                                  })
                                }
                                className="h-9 rounded-lg border bg-background px-2 text-foreground"
                              >
                                {DURATION_OPTIONS.map((minutes) => (
                                  <option key={minutes} value={minutes}>
                                    {formatPlanMinutes(minutes)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                )}
              </div>

              <aside className="h-fit rounded-3xl border bg-background/75 p-5 lg:sticky lg:top-24">
                <div className="flex items-center gap-2">
                  <ListTodo className="size-4 text-blue-500" />
                  <h2 className="text-sm font-semibold">Pull from tasks</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Assign a task to{" "}
                  <span className="font-medium text-foreground">
                    {OUTCOME_META[activeRole].label}
                  </span>
                  .
                </p>
                {taskList.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {taskList.slice(0, 10).map((task) => {
                      const assignedRole = metadata.outcomes.find(
                        (outcome) => outcome.task_id === task.id
                      )?.role;
                      const assignedElsewhere =
                        assignedRole && assignedRole !== activeRole;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          disabled={Boolean(assignedElsewhere)}
                          onClick={() => assignTask(task)}
                          className={cn(
                            "flex min-h-12 w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                            assignedRole === activeRole
                              ? "border-primary bg-primary/8"
                              : "hover:border-primary/35 hover:bg-primary/5",
                            assignedElsewhere && "cursor-not-allowed opacity-45"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-1 size-2 shrink-0 rounded-full",
                              task.isOverdue
                                ? "bg-red-500"
                                : task.priority === "high"
                                  ? "bg-amber-500"
                                  : task.priority === "medium"
                                    ? "bg-blue-500"
                                    : "bg-muted-foreground/50"
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-medium">
                              {task.title}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {assignedElsewhere
                                ? `Already used for ${OUTCOME_META[assignedRole].label}`
                                : task.estimateMinutes
                                  ? `${formatPlanMinutes(task.estimateMinutes)} estimate`
                                  : `${task.priority} priority`}
                            </span>
                          </span>
                          {assignedRole === activeRole && (
                            <Check className="size-4 shrink-0 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No open tasks. Write outcomes directly.
                  </p>
                )}
              </aside>
            </div>
          )}
```

New:

```tsx
          {step === 1 && (
            <div className="space-y-4">
              {(Object.keys(OUTCOME_META) as DayPlanOutcomeRole[]).map(
                (role) => {
                  const outcome = roleOutcome(metadata, role);
                  const item = OUTCOME_META[role];
                  const Icon = item.icon;
                  return (
                    <Card
                      key={role}
                      // Card clips overflow by default for rounded image
                      // corners; every role renders a TaskCombobox whose
                      // dropdown needs to escape that clip.
                      className="overflow-visible rounded-3xl transition"
                    >
                      <CardContent className="space-y-4 p-5 sm:p-6">
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                              item.style
                            )}
                          >
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-semibold">{item.label}</h2>
                              <Badge
                                variant="outline"
                                className={cn("rounded-full", item.style)}
                              >
                                {item.mission}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {item.helper}
                            </p>
                          </div>
                        </div>
                        <TaskCombobox
                          ariaLabel={`${item.label} outcome`}
                          tasks={taskList}
                          linkedTaskId={outcome?.task_id ?? null}
                          value={outcome?.title ?? ""}
                          onChangeText={(text) =>
                            updateOutcome(role, { title: text, task_id: null })
                          }
                          onSelectTask={(task) => assignTaskToRole(role, task)}
                          onCreateTask={(title) =>
                            void createAndAssignTask(role, title)
                          }
                          creating={creatingRole === role}
                          placeholder={
                            role === "must_win"
                              ? "What must move today? Search or create a task…"
                              : role === "progress"
                                ? "What creates forward momentum? Search or create a task…"
                                : "What protects your energy? Search or create a task…"
                          }
                        />
                        {createTaskError?.role === role && (
                          <p role="alert" className="text-xs text-destructive">
                            {createTaskError.message}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {outcome?.task_id
                              ? "Linked to a task"
                              : "Standalone outcome"}
                          </span>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            Budget
                            <select
                              aria-label={`${item.label} time budget`}
                              value={
                                outcome?.duration_minutes ??
                                item.defaultDuration
                              }
                              onChange={(event) =>
                                updateOutcome(role, {
                                  duration_minutes: Number(
                                    event.target.value
                                  ),
                                })
                              }
                              className="h-9 rounded-lg border bg-background px-2 text-foreground"
                            >
                              {DURATION_OPTIONS.map((minutes) => (
                                <option key={minutes} value={minutes}>
                                  {formatPlanMinutes(minutes)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </div>
          )}
```

- [ ] **Step 6: Remove the now-unused `ListTodo` import**

`ListTodo` was only used by the deleted sidebar heading icon. Check first that nothing else in the file references it:

Run: `grep -n "ListTodo" src/components/planning/TodayPlanner.tsx`
Expected: no matches after Step 5's edit (only the import line will show up before you remove it).

In `src/components/planning/TodayPlanner.tsx`, remove the `ListTodo,` line from the `lucide-react` import:

```tsx
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CircleGauge,
  Clock3,
  Dumbbell,
  Flame,
  HeartPulse,
  ListTodo,
  MoonStar,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
```

becomes:

```tsx
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CircleGauge,
  Clock3,
  Dumbbell,
  Flame,
  HeartPulse,
  MoonStar,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
```

- [ ] **Step 7: Run the full test file and confirm it passes**

Run: `npx vitest run src/components/planning/TodayPlanner.test.tsx`
Expected: PASS — all 4 tests (`blocks progress until a Must Win is selected`, `builds the timeline and performs one final write`, `gives Progress and Health their own task combobox instead of a shared sidebar`, `restores an unfinished tab-local draft`).

- [ ] **Step 8: Run the TaskCombobox test file to confirm it's untouched and still green**

Run: `npx vitest run src/components/planning/TaskCombobox.test.tsx`
Expected: PASS — this file wasn't modified, this just confirms Step 5's reuse didn't require any changes to the component itself.

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. This specifically catches any leftover reference to the deleted `activeRole`/`setActiveRole`/`assignTask`, or a mismatched `createTaskError` shape.

Run: `npm run lint`
Expected: no errors, including no unused-import warning for `ListTodo`.

- [ ] **Step 10: Manually verify in the running app**

Run: `npm run dev`, open `/plan`, advance to "Set your Top Three". Confirm:
- Must Win, Progress, and Health each have their own search/create input (no separate sidebar section on the page).
- Typing a query and selecting an existing task fills that card only.
- Typing a new title and choosing "Create ..." creates a task and assigns it to that card only (watch the network tab or the resulting task list — this exercises the real `createTask` call that unit tests mock/skip).
- The dropdown list isn't visually clipped by the card's rounded corners on any of the three cards.

- [ ] **Step 11: Commit**

```bash
git add src/components/planning/TodayPlanner.tsx src/components/planning/TodayPlanner.test.tsx
git commit -m "$(cat <<'EOF'
feat(plan): give Progress/Health their own task combobox

Replaces the shared "Pull from tasks" sidebar in Today's Plan Step 2
with a per-card TaskCombobox, matching what Must Win already had.
Must Win no longer needed the sidebar since it already had inline
search; Progress/Health now get the same inline search instead of
relying on a separate section.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

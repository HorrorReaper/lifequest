# Habits Day-Dot Direct Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each day-dot in a habit card's 7-day strip directly toggle that day's completion for that one habit, instead of switching the whole page into History mode for every habit.

**Architecture:** `SortableHabitCard` (inside `HabitManager.tsx`) currently wires day-dot clicks to `onSelectDate`, which the parent implements as a page-wide view/date switch. This plan removes `onSelectDate` entirely and replaces it with `onToggleDate(date, completed)`, which the parent implements by calling the existing `saveCompletion` helper with an arbitrary date — the same function the "mark complete" icon button already uses, just parameterized per-dot instead of fixed to the page's `visibleDate`. The card's single `disabled: boolean` prop becomes `isDisabled: (date: string) => boolean` so each of the 7 dots can independently reflect its own busy/eligibility state.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, `@dnd-kit` (unaffected by this change).

## Global Constraints

- Single file behavior change: `src/components/planning/../habits/HabitManager.tsx` (`src/components/habits/HabitManager.tsx`). No other file is modified.
- The "History" tab (`HistoryPicker`, `historyDate`/`view` state, 14-day `recentDates`) is untouched — it remains the only way to browse all habits on one specific day up to 14 days back.
- The icon button's behavior is unchanged: it still toggles the page's current `visibleDate` (today, on the Today tab).
- No change to `saveCompletion`, `setHabitLogCompletion`, optimistic-update/rollback logic, or any Supabase/RPC call.
- Design source: `docs/superpowers/specs/2026-08-09-habits-day-dot-toggle-design.md`.

---

### Task 1: Replace day-dot navigation with a direct per-day toggle

**Files:**
- Modify: `src/components/habits/HabitManager.tsx`
- Test: `src/components/habits/HabitManager.test.tsx` (new file)

**Interfaces:**
- Consumes: `saveCompletion(habit: Habit, date: string, completed: boolean, previousLog?: HabitLog)` — already defined in this file (`HabitManager.tsx:170`), unchanged, already accepts an arbitrary `date`.
- Consumes: `logIndex: Map<string, HabitLog>` (from `indexHabitLogs(logs)`) and `habitLogKey(habitId, date): string` — already defined/imported in this file, unchanged.
- Produces: `SortableHabitCardProps` gains `isDisabled: (date: string) => boolean` (replacing `disabled: boolean`) and `onToggleDate: (date: string, completed: boolean) => void` (replacing `onSelectDate: (date: string) => void`). No other component imports `SortableHabitCard` (it is a private, file-local function), so this interface change has no consumers outside this file.

This is one task because the interface change (props) and its only call site (the parent's JSX) and only consumer (the card's JSX) must all move together — a reviewer could not approve "remove `onSelectDate`" separately from "add `onToggleDate`" without the file failing to compile in between.

- [ ] **Step 1: Write the new test file (RED)**

Create `src/components/habits/HabitManager.test.tsx`. `HabitManager` fetches its own data on mount via `fetchHabits` (from `@/lib/habits`) and a direct `supabase.from("habit_logs")...` query chain, so both need mocking — there is no existing test file for this component to follow, so this sets the pattern.

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitManager } from "@/components/habits/HabitManager";
import type { Habit, HabitLog } from "@/lib/types";

const fetchHabits = vi.fn();
const setHabitLogCompletion = vi.fn();

vi.mock("@/lib/habits", async () => {
  const actual = await vi.importActual<typeof import("@/lib/habits")>("@/lib/habits");
  return {
    ...actual,
    fetchHabits: (...args: unknown[]) => fetchHabits(...args),
    setHabitLogCompletion: (...args: unknown[]) => setHabitLogCompletion(...args),
  };
});

let habitLogRows: HabitLog[] = [];

function habitLogsQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    lte: () => query,
    order: () => Promise.resolve({ data: habitLogRows, error: null }),
  };
  return query;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== "habit_logs") {
        throw new Error(`Unexpected table in test: ${table}`);
      }
      return habitLogsQuery();
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    user_id: "user-1",
    name: "Meditation",
    emoji: "🧘",
    color: "blue",
    is_archived: false,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = "2026-08-09";

beforeEach(() => {
  habitLogRows = [];
  fetchHabits.mockReset();
  setHabitLogCompletion.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HabitManager", () => {
  it("toggling a non-today day-dot marks only that day for that habit, without switching views or affecting other habits", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    const habitB = habit({ id: "habit-b", name: "Journaling" });
    fetchHabits.mockResolvedValue([habitA, habitB]);
    const savedLog: HabitLog = {
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: "2026-08-06",
      completed: true,
      created_at: "2026-08-06T12:00:00.000Z",
    };
    setHabitLogCompletion.mockResolvedValue(savedLog);

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);

    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    fireEvent.click(
      screen.getByRole("button", { name: "Mark Meditation complete for 2026-08-06" })
    );

    await waitFor(() =>
      expect(setHabitLogCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          habitId: "habit-a",
          date: "2026-08-06",
          completed: true,
        })
      )
    );

    expect(
      screen.getByRole("tab", { name: "Today" }).getAttribute("aria-selected")
    ).toBe("true");
    expect(screen.queryByLabelText("History date")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Mark Journaling complete for 2026-08-09" })
    ).toBeTruthy();
  });

  it("a pending toggle for one date does not disable a different date's dot on the same habit", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    fetchHabits.mockResolvedValue([habitA]);
    let resolveSave: (log: HabitLog) => void = () => {};
    setHabitLogCompletion.mockImplementation(
      () => new Promise<HabitLog>((resolve) => { resolveSave = resolve; })
    );

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    const mondayButton = screen.getByRole("button", {
      name: "Mark Meditation complete for 2026-08-03",
    });
    fireEvent.click(mondayButton);

    await waitFor(() => expect(setHabitLogCompletion).toHaveBeenCalledTimes(1));
    expect(mondayButton.hasAttribute("disabled")).toBe(true);

    const tuesdayButton = screen.getByRole("button", {
      name: "Mark Meditation complete for 2026-08-04",
    });
    expect(tuesdayButton.hasAttribute("disabled")).toBe(false);

    resolveSave({
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: "2026-08-03",
      completed: true,
      created_at: "2026-08-03T12:00:00.000Z",
    });
    await waitFor(() => expect(mondayButton.hasAttribute("disabled")).toBe(false));
  });

  it("shows the full habit name as a tooltip when it is truncated in the list", async () => {
    const habitA = habit({
      id: "habit-a",
      name: "Enjoy five minutes of quiet before the day starts",
    });
    fetchHabits.mockResolvedValue([habitA]);

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);

    await waitFor(() =>
      expect(
        screen.getByTitle("Enjoy five minutes of quiet before the day starts")
      ).toBeTruthy()
    );
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

Run: `npx vitest run src/components/habits/HabitManager.test.tsx`

Expected: FAIL. The first test fails because clicking "Mark Meditation complete for 2026-08-06" finds no such element — today, that day-dot's accessible name is `"Thu, Aug 6: not completed"` (a status readout), not `"Mark Meditation complete for 2026-08-06"` (an action label), because `onClick={() => onSelectDate(day)}` doesn't call `setHabitLogCompletion` at all yet. The third test fails because the habit name `<Link>` has no `title` attribute yet. If any test fails for a different reason (e.g. a mocking error), fix the mock before proceeding — do not move to Step 3 until the failures are exactly "element not found" for the reasons above.

- [ ] **Step 3: Update the props interface and function signature**

In `src/components/habits/HabitManager.tsx`, replace:

```tsx
interface SortableHabitCardProps {
  habit: Habit;
  logs: HabitLog[];
  timezone: string;
  today: string;
  date: string;
  completed: boolean;
  disabled: boolean;
  reorderDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: (completed: boolean) => void;
  onEdit: () => void;
  onArchive: () => void;
  onMove: (offset: -1 | 1) => void;
  onSelectDate: (date: string) => void;
}
```

with:

```tsx
interface SortableHabitCardProps {
  habit: Habit;
  logs: HabitLog[];
  timezone: string;
  today: string;
  date: string;
  completed: boolean;
  isDisabled: (date: string) => boolean;
  reorderDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: (completed: boolean) => void;
  onEdit: () => void;
  onArchive: () => void;
  onMove: (offset: -1 | 1) => void;
  onToggleDate: (date: string, completed: boolean) => void;
}
```

Then replace the function's destructured parameters:

```tsx
function SortableHabitCard({
  habit,
  logs,
  timezone,
  today,
  date,
  completed,
  disabled,
  reorderDisabled,
  canMoveUp,
  canMoveDown,
  onToggle,
  onEdit,
  onArchive,
  onMove,
  onSelectDate,
}: SortableHabitCardProps) {
```

with:

```tsx
function SortableHabitCard({
  habit,
  logs,
  timezone,
  today,
  date,
  completed,
  isDisabled,
  reorderDisabled,
  canMoveUp,
  canMoveDown,
  onToggle,
  onEdit,
  onArchive,
  onMove,
  onToggleDate,
}: SortableHabitCardProps) {
```

- [ ] **Step 4: Update the icon button's `disabled` prop and add a tooltip to the habit name**

Replace:

```tsx
        <button
          type="button"
          onClick={() => onToggle(!completed)}
          disabled={disabled}
          aria-pressed={completed}
          aria-label={`Mark ${habit.name} ${completed ? "incomplete" : "complete"} for ${date}`}
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl text-xl text-white shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45",
            habitColorClass(habit.color),
            completed && "scale-[0.96]"
          )}
        >
          {completed ? <Check className="size-5" /> : habit.emoji}
        </button>
```

with:

```tsx
        <button
          type="button"
          onClick={() => onToggle(!completed)}
          disabled={isDisabled(date)}
          aria-pressed={completed}
          aria-label={`Mark ${habit.name} ${completed ? "incomplete" : "complete"} for ${date}`}
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl text-xl text-white shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45",
            habitColorClass(habit.color),
            completed && "scale-[0.96]"
          )}
        >
          {completed ? <Check className="size-5" /> : habit.emoji}
        </button>
```

Then replace the habit name link:

```tsx
              <Link
                href={`/habits/${habit.id}`}
                className={cn(
                  "block truncate font-medium hover:text-primary",
                  completed && isToday && "text-muted-foreground"
                )}
              >
                {habit.name}
              </Link>
```

with:

```tsx
              <Link
                href={`/habits/${habit.id}`}
                title={habit.name}
                className={cn(
                  "block truncate font-medium hover:text-primary",
                  completed && isToday && "text-muted-foreground"
                )}
              >
                {habit.name}
              </Link>
```

- [ ] **Step 5: Replace the day-dot block**

Replace:

```tsx
          <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label={`${habit.name} last seven days`}>
            {week.map((day) => {
              const dayCompleted = summary.completionDates.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  title={formatDateOnly(day, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  aria-label={`${formatDateOnly(day, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}: ${dayCompleted ? "completed" : "not completed"}`}
                  aria-pressed={date === day}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    "aspect-square rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dayCompleted
                      ? cn("border-transparent", habitColorClass(habit.color))
                      : "border-border bg-muted/45",
                    date === day && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-card"
                  )}
                />
              );
            })}
          </div>
```

with:

```tsx
          <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label={`${habit.name} last seven days`}>
            {week.map((day) => {
              const dayCompleted = summary.completionDates.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled(day)}
                  title={formatDateOnly(day, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  aria-pressed={dayCompleted}
                  aria-label={`Mark ${habit.name} ${dayCompleted ? "incomplete" : "complete"} for ${day}`}
                  onClick={() => onToggleDate(day, !dayCompleted)}
                  className={cn(
                    "aspect-square rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                    dayCompleted
                      ? cn("border-transparent", habitColorClass(habit.color))
                      : "border-border bg-muted/45",
                    day === today && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-card"
                  )}
                />
              );
            })}
          </div>
```

- [ ] **Step 6: Update the parent's wiring into `SortableHabitCard`**

Replace:

```tsx
              <div className="space-y-3">
                {activeHabits.map((habit, index) => {
                  const existingLog = logIndex.get(
                    habitLogKey(habit.id, visibleDate)
                  );
                  const createdDate = dateInTimezone(
                    new Date(habit.created_at),
                    timezone
                  );
                  return (
                    <SortableHabitCard
                      key={habit.id}
                      habit={habit}
                      logs={logs}
                      timezone={timezone}
                      today={today}
                      date={visibleDate}
                      completed={existingLog?.completed ?? false}
                      disabled={
                        busyKeys.has(habitLogKey(habit.id, visibleDate)) ||
                        visibleDate > today ||
                        visibleDate < createdDate
                      }
                      reorderDisabled={view !== "today" || busyKeys.has("reorder")}
                      canMoveUp={index > 0}
                      canMoveDown={index < activeHabits.length - 1}
                      onToggle={(completed) =>
                        void saveCompletion(
                          habit,
                          visibleDate,
                          completed,
                          existingLog
                        )
                      }
                      onEdit={() => startEdit(habit)}
                      onArchive={() => setArchiveTarget(habit)}
                      onMove={(offset) => moveWithButton(habit.id, offset)}
                      onSelectDate={(date) => {
                        if (date === today) {
                          setView("today");
                        } else {
                          setHistoryDate(date);
                          setView("history");
                        }
                      }}
                    />
                  );
                })}
              </div>
```

with:

```tsx
              <div className="space-y-3">
                {activeHabits.map((habit, index) => {
                  const existingLog = logIndex.get(
                    habitLogKey(habit.id, visibleDate)
                  );
                  const createdDate = dateInTimezone(
                    new Date(habit.created_at),
                    timezone
                  );
                  const isDisabled = (checkDate: string) =>
                    busyKeys.has(habitLogKey(habit.id, checkDate)) ||
                    checkDate > today ||
                    checkDate < createdDate;
                  return (
                    <SortableHabitCard
                      key={habit.id}
                      habit={habit}
                      logs={logs}
                      timezone={timezone}
                      today={today}
                      date={visibleDate}
                      completed={existingLog?.completed ?? false}
                      isDisabled={isDisabled}
                      reorderDisabled={view !== "today" || busyKeys.has("reorder")}
                      canMoveUp={index > 0}
                      canMoveDown={index < activeHabits.length - 1}
                      onToggle={(completed) =>
                        void saveCompletion(
                          habit,
                          visibleDate,
                          completed,
                          existingLog
                        )
                      }
                      onEdit={() => startEdit(habit)}
                      onArchive={() => setArchiveTarget(habit)}
                      onMove={(offset) => moveWithButton(habit.id, offset)}
                      onToggleDate={(toggleDate, completed) =>
                        void saveCompletion(
                          habit,
                          toggleDate,
                          completed,
                          logIndex.get(habitLogKey(habit.id, toggleDate))
                        )
                      }
                    />
                  );
                })}
              </div>
```

(The inline `isDisabled` local function is named `checkDate` in its parameter to avoid shadowing the outer `date` used elsewhere in the same `.map()` callback scope — TypeScript would still resolve shadowing correctly either way, but the distinct name keeps the block easy to read.)

- [ ] **Step 7: Run the test file and confirm it passes**

Run: `npx vitest run src/components/habits/HabitManager.test.tsx`
Expected: PASS — all 3 tests.

- [ ] **Step 8: Run the wider habits test suite to confirm nothing else broke**

Run: `npx vitest run src/components/habits`
Expected: PASS — `HabitEditorDialog.test.tsx` (pre-existing, untouched) plus the new `HabitManager.test.tsx`, output pristine.

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. This specifically catches any leftover reference to the removed `disabled`/`onSelectDate` props or a mismatched `isDisabled`/`onToggleDate` signature.

Run: `npm run lint`
Expected: no errors on `src/components/habits/HabitManager.tsx` or the new test file.

- [ ] **Step 10: Manually verify in the running app**

Run: `npm run dev`, open `/habits`. Confirm:
- Tapping a past day's dot on one habit toggles that day for that habit only — the page stays on the Today tab, and no other habit's card changes.
- The habit's streak/heatmap on its detail page (`/habits/[habitId]`) reflects the change after navigating there.
- Tapping today's dot behaves the same as tapping the icon button (both toggle today).
- A long habit name still truncates in the list, and hovering it (desktop) shows the full name as a tooltip.
- The "History" tab still works exactly as before: it opens a date picker that browses all habits together on one selected day, unaffected by this change.

- [ ] **Step 11: Commit**

```bash
git add src/components/habits/HabitManager.tsx src/components/habits/HabitManager.test.tsx
git commit -m "$(cat <<'EOF'
fix(habits): make day-dots toggle that day directly

Tapping a day-dot in a habit's week strip used to switch the whole
page into History mode for every habit instead of marking that one
day for that one habit. Day-dots now call the same completion-save
path the "mark complete" button already uses, just for an arbitrary
date instead of always the page's current date. Also adds a tooltip
to truncated habit names.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

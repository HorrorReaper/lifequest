# Habits — make week-strip day-dots a direct per-habit toggle

> Date: 2026-08-09
> Status: Approved
> Scope: `src/components/habits/HabitManager.tsx` only (`SortableHabitCard` and its parent's wiring into it).

## Problem

On the Habits page (`/habits`, Today tab), each habit card renders a 7-dot "last seven days" strip (`HabitManager.tsx:853-882`). Tapping any dot does **not** toggle that day for that habit. Instead it calls `onSelectDate(day)` (`:547-554`), which:

- if `day === today`: sets `view` to `"today"` (a no-op when already there)
- otherwise: sets the **page-wide** `historyDate` and switches `view` to `"history"`

`visibleDate = view === "today" ? today : historyDate` (`:153`) is shared across every habit card (`date={visibleDate}` at `:526`) — so tapping one dot on one habit silently switches the entire page into History mode, and every other habit's card now also shows that other date instead of today. The only actual "mark complete" control is the habit's own emoji icon button (`:796-809`), which has no checkbox affordance and toggles whatever `visibleDate` currently is.

This mismatches the near-universal mental model for a week-dot habit tracker (tap a day cell to toggle it) and produces a confusing, page-wide side effect from what looks like a small, local tap.

Two smaller issues ride along with the same element:
- The day-dot's `aria-pressed={date === day}` (`:870`) encodes "is this the selected day," while its `aria-label` (`:865-869`) simultaneously reports completion status ("Sun, Aug 9: not completed") — a screen reader announces "not completed, pressed," which is contradictory, and nothing in the label hints that activating it will navigate away from the current tab.
- The habit name `<Link>` (`:813-821`) truncates with `truncate` and no `title` attribute, so a long name has no way to be read in full without opening the detail page.

## Design

**1. Day-dots become a direct, per-habit, per-day toggle.** Remove `onSelectDate` from `SortableHabitCardProps` entirely (and its call site at `:547-554`). Add:

- `onToggleDate: (date: string, completed: boolean) => void` — new prop. Parent implements it as:
  ```ts
  onToggleDate={(date, completed) =>
    void saveCompletion(habit, date, completed, logIndex.get(habitLogKey(habit.id, date)))
  }
  ```
  `saveCompletion` (`:170`) is unchanged — it already accepts an arbitrary `date`, it has just never been called with anything but `visibleDate` before.

- Each day-dot's `onClick` becomes `() => onToggleDate(day, !dayCompleted)`, where `dayCompleted` is the existing `summary.completionDates.has(day)` value already computed at `:855`.

**2. Per-date disabled check replaces the single card-wide boolean.** The `disabled: boolean` prop on `SortableHabitCardProps` becomes `isDisabled: (date: string) => boolean`. Parent implements it as the same logic currently inlined at `:528-532`:
```ts
isDisabled={(date) =>
  busyKeys.has(habitLogKey(habit.id, date)) || date > today || date < createdDate
}
```
The icon button uses `isDisabled(date)` (where `date` is the existing `date` prop = `visibleDate`); each day-dot uses `isDisabled(day)`. This is necessary because toggling Monday shouldn't be blocked by an in-flight mutation for Tuesday on the same habit, and vice versa — each dot now needs its own busy check instead of one shared check for the whole card.

**3. Day-dot ARIA/label matches the icon button's existing convention**, resolving the contradiction as a consequence of the dot becoming a real toggle rather than as a separate patch:
- `aria-pressed={dayCompleted}` (was `date === day`)
- `aria-label={`Mark ${habit.name} ${dayCompleted ? "incomplete" : "complete"} for ${day}`}` (was a passive `"{day}: completed/not completed"` status string)
- The existing `title={formatDateOnly(day, {...})}` native tooltip is unchanged — still useful for sighted mouse users to confirm exactly which date they're about to toggle.

**4. "Today" gets a static visual marker, decoupled from any selection state.** Since dots no longer represent a "currently selected day," the existing conditional ring (`date === day && "ring-2 ..."`, tied to shared selection) is replaced with a fixed marker keyed only on `day === today`, so the rightmost dot is always identifiable as "today" regardless of tab or any interaction.

**5. Truncated habit name gets a tooltip.** Add `title={habit.name}` to the `<Link>` at `:813`. One line, no behavior change.

## Explicitly out of scope

- The "History" tab (`HistoryPicker` component, `historyDate`/`view` state, `recentDates` 14-day window) is untouched. It remains the only way to browse *all* habits on one specific day up to 14 days back — a distinct, still-valid use case from the per-card 7-day strip.
- The icon button's own behavior is unchanged: on the Today tab it still toggles *today* specifically (`date` prop = `visibleDate` = `today`). It will simply now sit next to dots that behave predictably instead of redirecting the whole page.
- No change to `saveCompletion`, `setHabitLogCompletion`, optimistic-update/rollback logic, or any Supabase/RPC call.
- No change to the emoji-as-default-icon issue, the "Total completed" labeling, or mobile drag-reorder — those were deferred out of this fix's scope by the user.

## Testing

- `HabitManager.test.tsx` does not currently exist (no test file for this component found in the repo) — this is net-new test coverage, not a migration of existing tests.
- Add coverage for: tapping a non-today day-dot toggles that specific day for that specific habit without changing `view` or any other habit's displayed state; the day-dot's disabled state respects an in-flight mutation for a *different* date on the same habit (i.e. toggling Monday doesn't get blocked by a pending Tuesday save, and vice versa); the habit name's tooltip is present.

import { describe, expect, it } from "vitest";
import { addDays, dateInTimezone, formatDateOnly } from "@/lib/dates";
import {
  buildDateWindow,
  buildHabitSummary,
  indexHabitLogs,
  moveHabit,
  moveHabitByOffset,
  patchHabitOptimistically,
} from "@/lib/habit-manager";
import type { Habit, HabitLog } from "@/lib/types";

const habits: Habit[] = ["read", "train", "sleep"].map((name, index) => ({
  id: name,
  user_id: "user-1",
  name,
  emoji: "✅",
  color: "blue",
  is_archived: false,
  sort_order: index,
  created_at: "2026-07-01T12:00:00.000Z",
}));

const logs: HabitLog[] = [
  {
    id: "log-1",
    user_id: "user-1",
    habit_id: "read",
    entry_id: "journal-1",
    log_date: "2026-07-23",
    completed: true,
    created_at: "2026-07-23T12:00:00.000Z",
  },
  {
    id: "log-2",
    user_id: "user-1",
    habit_id: "read",
    entry_id: null,
    log_date: "2026-07-24",
    completed: true,
    created_at: "2026-07-24T12:00:00.000Z",
  },
  {
    id: "log-3",
    user_id: "user-1",
    habit_id: "read",
    entry_id: null,
    log_date: "2026-07-25",
    completed: false,
    created_at: "2026-07-25T12:00:00.000Z",
  },
];

describe("habit manager date handling", () => {
  it("performs date-only arithmetic without local timezone shifts", () => {
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(buildDateWindow("2026-07-25", 3)).toEqual([
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
    ]);
  });

  it("uses the supplied profile timezone", () => {
    const instant = new Date("2026-07-24T23:30:00.000Z");
    expect(dateInTimezone(instant, "Europe/Berlin")).toBe("2026-07-25");
    expect(dateInTimezone(instant, "America/Los_Angeles")).toBe("2026-07-24");
  });

  it("formats date-only values at UTC noon", () => {
    expect(formatDateOnly("2026-07-25", { month: "short", day: "numeric" })).toBe(
      "Jul 25"
    );
  });
});

describe("habit manager state derivation", () => {
  it("indexes false logs instead of treating them as missing", () => {
    const index = indexHabitLogs(logs);
    expect(index.get("read:2026-07-25")?.completed).toBe(false);
    expect(index.get("read:2026-07-23")?.entry_id).toBe("journal-1");
  });

  it("builds streaks using completed logs only", () => {
    const summary = buildHabitSummary({
      habit: habits[0],
      logs,
      today: "2026-07-25",
      timezone: "UTC",
    });
    expect(summary.currentStreak).toBe(2);
    expect(summary.completionDates.has("2026-07-25")).toBe(false);
  });

  it("reorders by drag target and normalizes durable sort orders", () => {
    const moved = moveHabit(habits, "sleep", "read");
    expect(moved.map((habit) => habit.id)).toEqual(["sleep", "read", "train"]);
    expect(moved.map((habit) => habit.sort_order)).toEqual([0, 1, 2]);
  });

  it("supports accessible button reordering and protects boundaries", () => {
    expect(moveHabitByOffset(habits, "train", -1).map((habit) => habit.id)).toEqual([
      "train",
      "read",
      "sleep",
    ]);
    expect(moveHabitByOffset(habits, "read", -1)).toBe(habits);
  });

  it("supports archive, restore, and exact optimistic rollback", () => {
    const archived = patchHabitOptimistically(habits, "read", {
      is_archived: true,
    });
    expect(archived.next[0].is_archived).toBe(true);
    expect(archived.rollback).toBe(habits);

    const restored = patchHabitOptimistically(archived.next, "read", {
      is_archived: false,
    });
    expect(restored.next[0].is_archived).toBe(false);
    expect(restored.rollback).toBe(archived.next);
  });
});

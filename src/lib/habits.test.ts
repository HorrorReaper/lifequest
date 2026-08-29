import { describe, expect, it } from "vitest";
import {
  hasDuplicateHabitName,
  planHabitCompletionMutation,
} from "@/lib/habits";
import type { Habit, HabitLog } from "@/lib/types";

const existingLog: HabitLog = {
  id: "log-1",
  user_id: "user-1",
  habit_id: "habit-1",
  entry_id: "journal-entry-1",
  log_date: "2026-07-25",
  completed: true,
  created_at: "2026-07-25T09:00:00.000Z",
};

describe("habit completion mutations", () => {
  it("unchecks an existing log with an update that preserves journal linkage", () => {
    const mutation = planHabitCompletionMutation({
      existingLog,
      userId: "user-1",
      habitId: "habit-1",
      date: "2026-07-25",
      completed: false,
    });

    expect(mutation).toEqual({
      kind: "update",
      id: "log-1",
      patch: { completed: false },
    });
    expect(mutation.patch).not.toHaveProperty("entry_id");
  });

  it("creates a durable false row when no log exists", () => {
    const mutation = planHabitCompletionMutation({
      userId: "user-1",
      habitId: "habit-1",
      date: "2026-07-24",
      completed: false,
    });

    expect(mutation.kind).toBe("upsert");
    expect(mutation.row).toMatchObject({
      user_id: "user-1",
      habit_id: "habit-1",
      log_date: "2026-07-24",
      completed: false,
      entry_id: null,
    });
  });
});
describe("habit duplicate handling", () => {
  const habits: Habit[] = [
    {
      id: "habit-1",
      user_id: "user-1",
      name: "Read 20 Minutes",
      emoji: "📖",
      color: "blue",
      skill_category: null,
      is_archived: false,
      sort_order: 0,
      created_at: "2026-07-01T12:00:00.000Z",
    },
    {
      id: "habit-2",
      user_id: "user-1",
      name: "Walk",
      emoji: "🚶",
      color: "green",
      skill_category: null,
      is_archived: true,
      sort_order: 1,
      created_at: "2026-07-01T12:00:00.000Z",
    },
  ];

  it("normalizes whitespace and casing for active duplicates", () => {
    expect(hasDuplicateHabitName(habits, "  read   20 minutes ")).toBe(true);
  });

  it("allows the current habit and archived names", () => {
    expect(hasDuplicateHabitName(habits, "Read 20 Minutes", "habit-1")).toBe(false);
    expect(hasDuplicateHabitName(habits, "Walk")).toBe(false);
  });
});

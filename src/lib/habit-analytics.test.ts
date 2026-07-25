import { describe, expect, it } from "vitest";
import { buildHabitAnalytics } from "@/lib/habit-analytics";

describe("buildHabitAnalytics", () => {
  it("keeps the current streak alive until the current day ends", () => {
    const analytics = buildHabitAnalytics({
      completionDates: ["2026-07-22", "2026-07-23", "2026-07-24"],
      createdDate: "2026-07-20",
      today: "2026-07-25",
      period: 30,
    });

    expect(analytics.currentStreak).toBe(3);
  });

  it("counts today when it has already been completed", () => {
    const analytics = buildHabitAnalytics({
      completionDates: ["2026-07-23", "2026-07-24", "2026-07-25"],
      createdDate: "2026-07-20",
      today: "2026-07-25",
      period: 30,
    });

    expect(analytics.currentStreak).toBe(3);
  });

  it("finds the longest historical sequence and removes duplicate dates", () => {
    const analytics = buildHabitAnalytics({
      completionDates: [
        "2026-07-01",
        "2026-07-02",
        "2026-07-02",
        "2026-07-05",
        "2026-07-06",
        "2026-07-07",
        "2026-07-08",
      ],
      createdDate: "2026-07-01",
      today: "2026-07-10",
      period: "all",
    });

    expect(analytics.longestStreak).toBe(4);
    expect(analytics.totalCompletions).toBe(6);
  });

  it("uses the habit creation date as the first eligible day", () => {
    const analytics = buildHabitAnalytics({
      completionDates: ["2026-07-21", "2026-07-23"],
      createdDate: "2026-07-20",
      today: "2026-07-24",
      period: 30,
    });

    expect(analytics.eligibleDays).toBe(5);
    expect(analytics.periodCompletions).toBe(2);
    expect(analytics.completionRate).toBe(40);
  });

  it("ignores future and pre-creation check-ins", () => {
    const analytics = buildHabitAnalytics({
      completionDates: ["2026-07-19", "2026-07-20", "2026-07-26"],
      createdDate: "2026-07-20",
      today: "2026-07-25",
      period: "all",
    });

    expect(analytics.totalCompletions).toBe(1);
    expect(analytics.recentCompletions).toEqual(["2026-07-20"]);
  });
});

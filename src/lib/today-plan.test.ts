import { describe, expect, it } from "vitest";
import type { DayPlanBlock } from "@/lib/types";
import {
  applyBlockTimeChange,
  buildTodayPlanSchedule,
  calculateTodayPlanCapacity,
  createDefaultTodayPlanMetadata,
  findTodayPlanBlockProblems,
  parseTodayPlanNotes,
  blockSpanForGap,
  findTimelineGaps,
  nextGridStart,
  resolveOverlaps,
  snapToDragGrid,
  timelineWindow,
  serializeTodayPlanNotes,
  shiftEndTime,
} from "@/lib/today-plan";

describe("today plan notes", () => {
  it("round-trips the guided plan while preserving legacy notes", () => {
    const metadata = {
      ...createDefaultTodayPlanMetadata(),
      intention: "Ship the customer onboarding flow",
      outcomes: [
        {
          id: "main",
          role: "must_win" as const,
          title: "Finish onboarding",
          task_id: "task-1",
          duration_minutes: 90,
        },
      ],
    };

    const parsed = parseTodayPlanNotes(
      serializeTodayPlanNotes(metadata, "Original journal note")
    );

    expect(parsed.metadata).toEqual(metadata);
    expect(parsed.legacyNotes).toBe("Original journal note");
  });

  it("keeps a valid mood value and drops one outside the shared vocabulary", () => {
    const withValidMood = {
      ...createDefaultTodayPlanMetadata(),
      mood: "good",
    };
    expect(
      parseTodayPlanNotes(serializeTodayPlanNotes(withValidMood)).metadata?.mood
    ).toBe("good");

    const withInvalidMood = {
      ...createDefaultTodayPlanMetadata(),
      mood: "ecstatic",
    };
    expect(
      parseTodayPlanNotes(serializeTodayPlanNotes(withInvalidMood)).metadata
        ?.mood
    ).toBeNull();
  });

  it("treats unstructured notes as legacy content", () => {
    expect(parseTodayPlanNotes("Keep the afternoon light.")).toEqual({
      metadata: null,
      legacyNotes: "Keep the afternoon light.",
    });
  });

  it("rejects malformed planning payloads safely", () => {
    expect(
      parseTodayPlanNotes("LIFEQUEST_TODAY_PLAN_V1:{not json")
    ).toEqual({
      metadata: null,
      legacyNotes: null,
    });
  });
});

describe("today plan schedule", () => {
  it("schedules outcomes and workouts, but never habits or journals", () => {
    const metadata = {
      ...createDefaultTodayPlanMetadata(),
      outcomes: [
        {
          id: "main",
          role: "must_win" as const,
          title: "Write launch brief",
          task_id: "task-1",
          duration_minutes: 60,
        },
        {
          id: "health",
          role: "health" as const,
          title: "Train",
          task_id: null,
          duration_minutes: 45,
        },
      ],
      anchors: [
        {
          id: "journal",
          source_type: "journal" as const,
          source_id: "template-1",
          title: "Morning reflection",
          emoji: "📓",
          duration_minutes: 10,
        },
        {
          id: "workout",
          source_type: "workout" as const,
          source_id: null,
          title: "Training session",
          emoji: "🏋",
          duration_minutes: 75,
        },
      ],
    };
    let counter = 0;

    const scheduled = buildTodayPlanSchedule({
      blocks: [],
      metadata,
      idFactory: () => `block-${++counter}`,
    });
    const scheduledAgain = buildTodayPlanSchedule({
      blocks: scheduled,
      metadata,
      idFactory: () => `block-${++counter}`,
    });

    // The journal anchor rides along instead of taking a slot; the workout
    // genuinely occupies the clock, so it stays on the timeline.
    expect(scheduled).toHaveLength(3);
    expect(
      scheduled.some((block) => block.source_type === "journal")
    ).toBe(false);
    expect(scheduled[0]).toMatchObject({
      start_time: "08:00",
      end_time: "09:00",
      mission_type: "main_quest",
      outcome_role: "must_win",
      source_type: "task",
    });
    expect(scheduled[1]).toMatchObject({
      start_time: "09:15",
      end_time: "10:00",
      mission_type: "recovery",
      outcome_role: "health",
    });
    expect(scheduled[2]).toMatchObject({
      start_time: "10:15",
      end_time: "11:30",
      mission_type: "anchor",
      source_type: "workout",
      category: "exercise",
    });
    expect(scheduledAgain).toEqual(scheduled);
  });

  it("does not duplicate an anchor that carries no source id", () => {
    const metadata = {
      ...createDefaultTodayPlanMetadata(),
      anchors: [
        {
          id: "workout-daily-anchor",
          source_type: "workout" as const,
          source_id: null,
          title: "Training session",
          emoji: "🏋",
          duration_minutes: 75,
        },
      ],
    };
    let counter = 0;
    const idFactory = () => `block-${++counter}`;

    const once = buildTodayPlanSchedule({ blocks: [], metadata, idFactory });
    const twice = buildTodayPlanSchedule({ blocks: once, metadata, idFactory });

    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
  });

  it("starts on the quarter hour after an existing block, past the transition gap", () => {
    const metadata = {
      ...createDefaultTodayPlanMetadata(),
      outcomes: [
        {
          id: "main",
          role: "must_win" as const,
          title: "Main quest",
          task_id: null,
          duration_minutes: 60,
        },
      ],
    };

    const scheduled = buildTodayPlanSchedule({
      blocks: [
        {
          id: "existing",
          start_time: "09:00",
          end_time: "10:00",
          title: "Existing call",
          category: "meeting",
        },
      ],
      metadata,
      idFactory: () => "generated",
    });

    expect(scheduled[1].start_time).toBe("10:15");
  });
});

describe("today plan capacity and validation", () => {
  const blocks: DayPlanBlock[] = [
    {
      id: "one",
      start_time: "09:00",
      end_time: "10:30",
      title: "Main quest",
      category: "deep_work",
    },
    {
      id: "two",
      start_time: "10:00",
      end_time: "11:00",
      title: "Overlapping call",
      category: "meeting",
    },
  ];

  it("calculates capacity from canonical block durations", () => {
    expect(calculateTodayPlanCapacity(blocks, "08:00", "12:00")).toEqual({
      availableMinutes: 240,
      plannedMinutes: 150,
      remainingMinutes: 90,
      utilizationPercent: 63,
      status: "open",
    });
  });

  it("finds overlaps and invalid blocks", () => {
    const problems = findTodayPlanBlockProblems([
      ...blocks,
      {
        id: "invalid",
        start_time: "12:00",
        end_time: "11:00",
        title: "",
        category: "other",
      },
    ]);

    expect(problems.invalidBlockIds).toEqual(["invalid"]);
    expect(problems.overlappingBlockIds.sort()).toEqual(["one", "two"]);
  });
});

describe("shiftEndTime", () => {
  it("moves the end time by the same amount as the start time, preserving duration", () => {
    expect(shiftEndTime("08:00", "18:00", "09:00")).toBe("19:00");
    expect(shiftEndTime("09:00", "09:30", "09:15")).toBe("09:45");
  });

  it("clamps the shifted end time to the last minute of the day", () => {
    expect(shiftEndTime("22:00", "23:30", "23:00")).toBe("23:59");
  });

  it("leaves the end time untouched when the existing span is zero or negative", () => {
    expect(shiftEndTime("10:00", "10:00", "11:00")).toBe("10:00");
    expect(shiftEndTime("10:00", "09:00", "11:00")).toBe("09:00");
  });

  it("leaves the end time untouched when any input is not a valid time", () => {
    expect(shiftEndTime("", "18:00", "09:00")).toBe("18:00");
    expect(shiftEndTime("08:00", "18:00", "")).toBe("18:00");
    expect(shiftEndTime("08:00", "", "09:00")).toBe("");
  });
});

describe("nextGridStart", () => {
  it("clears the transition gap and lands on the next quarter hour", () => {
    // 10:00 + 10 minutes is 10:10, which rounds up to 10:15.
    expect(nextGridStart(10 * 60)).toBe(10 * 60 + 15);
  });

  it("never returns a gap shorter than the transition minimum", () => {
    // 10:05 + 10 is exactly 10:15, so rounding must not pull it back to 10:15
    // from below or snap it down to 10:05.
    expect(nextGridStart(10 * 60 + 5)).toBe(10 * 60 + 15);
    expect(nextGridStart(10 * 60 + 6)).toBe(10 * 60 + 30);
  });

  it("stops at the last minute of the day", () => {
    expect(nextGridStart(23 * 60 + 55)).toBe(23 * 60 + 59);
  });
});

describe("applyBlockTimeChange", () => {
  function chain(): DayPlanBlock[] {
    return [
      {
        id: "a",
        start_time: "08:00",
        end_time: "09:00",
        title: "Main quest",
        category: "deep_work",
      },
      {
        id: "b",
        start_time: "09:15",
        end_time: "10:00",
        title: "Side quest",
        category: "deep_work",
      },
      {
        id: "c",
        start_time: "11:00",
        end_time: "11:45",
        title: "Training",
        category: "exercise",
      },
    ];
  }

  it("carries every later block along when one is moved", () => {
    const next = applyBlockTimeChange(chain(), "a", {
      start_time: "08:30",
      end_time: "09:30",
    });

    expect(next[1]).toMatchObject({ start_time: "09:45", end_time: "10:30" });
    expect(next[2]).toMatchObject({ start_time: "11:30", end_time: "12:15" });
  });

  it("preserves the deliberate gap between later blocks", () => {
    const next = applyBlockTimeChange(chain(), "a", {
      start_time: "08:30",
      end_time: "09:30",
    });

    // b ended at 10:00 and c began at 11:00; that hour must survive the move.
    expect(timeToMinutesOf(next, "c", "start_time")).toBe(
      timeToMinutesOf(next, "b", "end_time") + 60
    );
  });

  it("pulls the day back up when a block is shortened", () => {
    const next = applyBlockTimeChange(chain(), "a", { end_time: "08:30" });

    expect(next[1]).toMatchObject({ start_time: "08:45", end_time: "09:30" });
    expect(next[2]).toMatchObject({ start_time: "10:30" });
  });

  it("leaves the blocks before the edited one alone", () => {
    const next = applyBlockTimeChange(chain(), "b", { end_time: "10:30" });

    expect(next[0]).toEqual(chain()[0]);
    expect(next[2]).toMatchObject({ start_time: "11:30", end_time: "12:15" });
  });

  it("never creates an overlap out of a clean schedule", () => {
    const next = applyBlockTimeChange(chain(), "b", {
      start_time: "09:45",
      end_time: "10:30",
    });

    expect(findTodayPlanBlockProblems(next).overlappingBlockIds).toEqual([]);
  });

  it("keeps the tail inside the day rather than compressing it", () => {
    const next = applyBlockTimeChange(chain(), "a", {
      start_time: "22:00",
      end_time: "23:00",
    });

    // c cannot be pushed past 23:59, so the whole tail shifts by the same
    // clamped amount and the gaps between b and c stay intact.
    expect(next[2].end_time).toBe("23:59");
    expect(
      timeToMinutesOf(next, "c", "start_time") -
        timeToMinutesOf(next, "b", "end_time")
    ).toBe(60);
  });

  it("applies a half-typed time without dragging the day with it", () => {
    const next = applyBlockTimeChange(chain(), "a", { end_time: "07:00" });

    expect(next[0].end_time).toBe("07:00");
    expect(next[1]).toEqual(chain()[1]);
    expect(next[2]).toEqual(chain()[2]);
  });

  it("returns the blocks untouched when the id is unknown", () => {
    const blocks = chain();
    expect(applyBlockTimeChange(blocks, "missing", { end_time: "12:00" })).toBe(
      blocks
    );
  });
});

describe("resolveOverlaps", () => {
  it("pushes a colliding block clear while keeping its duration", () => {
    const resolved = resolveOverlaps([
      {
        id: "a",
        start_time: "09:00",
        end_time: "10:30",
        title: "Deep work",
        category: "deep_work",
      },
      {
        id: "b",
        start_time: "10:00",
        end_time: "10:45",
        title: "Call",
        category: "meeting",
      },
    ]);

    expect(resolved[1]).toMatchObject({
      start_time: "10:45",
      end_time: "11:30",
    });
    expect(findTodayPlanBlockProblems(resolved).overlappingBlockIds).toEqual([]);
  });

  it("leaves a schedule that already fits completely alone", () => {
    const blocks: DayPlanBlock[] = [
      {
        id: "a",
        start_time: "09:00",
        end_time: "10:00",
        title: "Deep work",
        category: "deep_work",
      },
      {
        id: "b",
        start_time: "14:00",
        end_time: "15:00",
        title: "Call",
        category: "meeting",
      },
    ];

    expect(resolveOverlaps(blocks)).toEqual(blocks);
  });

  it("resolves a pile-up of three without reordering them", () => {
    const resolved = resolveOverlaps([
      {
        id: "a",
        start_time: "09:00",
        end_time: "10:00",
        title: "One",
        category: "deep_work",
      },
      {
        id: "b",
        start_time: "09:30",
        end_time: "10:00",
        title: "Two",
        category: "deep_work",
      },
      {
        id: "c",
        start_time: "09:45",
        end_time: "10:15",
        title: "Three",
        category: "deep_work",
      },
    ]);

    expect(resolved.map((block) => block.id)).toEqual(["a", "b", "c"]);
    expect(resolved[1].start_time).toBe("10:15");
    expect(resolved[2].start_time).toBe("11:00");
    expect(findTodayPlanBlockProblems(resolved).overlappingBlockIds).toEqual([]);
  });
});

/** Reads one time field off a block by id, in minutes. */
function timeToMinutesOf(
  blocks: DayPlanBlock[],
  id: string,
  field: "start_time" | "end_time"
) {
  const value = blocks.find((block) => block.id === id)?.[field] ?? "00:00";
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

describe("timelineWindow", () => {
  const block = (start: string, end: string): DayPlanBlock => ({
    id: `${start}-${end}`,
    start_time: start,
    end_time: end,
    title: "Block",
    category: "deep_work",
  });

  it("spans the planned day in whole hours", () => {
    const win = timelineWindow([block("09:00", "10:00")], "08:00", "18:00");
    expect(win.startMinutes).toBe(8 * 60);
    expect(win.endMinutes).toBe(18 * 60);
  });

  it("widens to reach a block that sits outside the planned day", () => {
    // A block at 22:00 inside an 08:00-18:00 day must still be visible, or it
    // cannot be dragged back in.
    const win = timelineWindow([block("21:40", "22:30")], "08:00", "18:00");
    expect(win.endMinutes).toBe(23 * 60);
  });

  it("widens backwards for an early block too", () => {
    const win = timelineWindow([block("06:20", "07:00")], "08:00", "18:00");
    expect(win.startMinutes).toBe(6 * 60);
  });

  it("falls back to a sane day when there is nothing to measure", () => {
    const win = timelineWindow([], "nonsense", "also nonsense");
    expect(win).toEqual({ startMinutes: 8 * 60, endMinutes: 18 * 60 });
  });

  it("always spans at least an hour", () => {
    const win = timelineWindow([], "09:00", "09:00");
    expect(win.endMinutes - win.startMinutes).toBeGreaterThanOrEqual(60);
  });
});

describe("snapToDragGrid", () => {
  it("resolves a drag to the nearest five minutes", () => {
    expect(snapToDragGrid(0)).toBe(0);
    expect(snapToDragGrid(2)).toBe(0);
    expect(snapToDragGrid(3)).toBe(5);
    expect(snapToDragGrid(-3)).toBe(-5);
    expect(snapToDragGrid(47)).toBe(45);
  });
});

describe("findTimelineGaps", () => {
  const at = (start: string, end: string): DayPlanBlock => ({
    id: `${start}-${end}`,
    start_time: start,
    end_time: end,
    title: "Block",
    category: "deep_work",
  });

  it("finds the free time before, between and after the blocks", () => {
    const gaps = findTimelineGaps(
      [at("09:00", "10:00"), at("12:00", "13:00")],
      8 * 60,
      18 * 60
    );

    expect(gaps).toEqual([
      { startMinutes: 8 * 60, endMinutes: 9 * 60 },
      { startMinutes: 10 * 60, endMinutes: 12 * 60 },
      { startMinutes: 13 * 60, endMinutes: 18 * 60 },
    ]);
  });

  it("ignores a gap too short to hold a block", () => {
    // Five minutes between two blocks cannot become anything valid, so
    // offering to fill it would be a dead end.
    const gaps = findTimelineGaps(
      [at("09:00", "10:00"), at("10:05", "11:00")],
      9 * 60,
      11 * 60
    );

    expect(gaps).toEqual([]);
  });

  it("treats overlapping blocks as one occupied run", () => {
    const gaps = findTimelineGaps(
      [at("09:00", "11:00"), at("10:00", "12:00")],
      9 * 60,
      13 * 60
    );

    expect(gaps).toEqual([{ startMinutes: 12 * 60, endMinutes: 13 * 60 }]);
  });

  it("skips blocks whose times cannot be read", () => {
    const gaps = findTimelineGaps(
      [at("nonsense", "10:00"), at("11:00", "10:00")],
      9 * 60,
      12 * 60
    );

    expect(gaps).toEqual([{ startMinutes: 9 * 60, endMinutes: 12 * 60 }]);
  });

  it("returns the whole window when nothing is planned", () => {
    const gaps = findTimelineGaps([], 8 * 60, 18 * 60);
    expect(gaps).toEqual([{ startMinutes: 8 * 60, endMinutes: 18 * 60 }]);
  });
});

describe("blockSpanForGap", () => {
  it("runs an hour from where the click landed, on the planning grid", () => {
    const gap = { startMinutes: 8 * 60, endMinutes: 18 * 60 };
    const span = blockSpanForGap(gap, 10 * 60 + 37);

    // 10:37 rounds to 10:30, and an hour is available.
    expect(span).toEqual({
      startMinutes: 10 * 60 + 30,
      endMinutes: 11 * 60 + 30,
    });
  });

  it("fills a gap shorter than an hour exactly", () => {
    const gap = { startMinutes: 9 * 60, endMinutes: 9 * 60 + 45 };
    const span = blockSpanForGap(gap, 9 * 60 + 20);

    expect(span).toEqual({
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 45,
    });
  });

  it("fills a gap of exactly an hour edge to edge", () => {
    const gap = { startMinutes: 9 * 60, endMinutes: 10 * 60 };
    expect(blockSpanForGap(gap, 9 * 60 + 30)).toEqual({
      startMinutes: 9 * 60,
      endMinutes: 10 * 60,
    });
  });

  it("never runs past the end of the gap", () => {
    const gap = { startMinutes: 8 * 60, endMinutes: 10 * 60 };
    const span = blockSpanForGap(gap, 9 * 60 + 50);

    expect(span.endMinutes).toBe(10 * 60);
    expect(span.startMinutes).toBe(9 * 60);
  });

  it("never starts before the gap does", () => {
    const gap = { startMinutes: 9 * 60 + 10, endMinutes: 12 * 60 };
    const span = blockSpanForGap(gap, 9 * 60);

    expect(span.startMinutes).toBe(9 * 60 + 10);
  });

  it("places a block that cannot overlap what is already there", () => {
    const blocks: DayPlanBlock[] = [
      {
        id: "a",
        start_time: "09:00",
        end_time: "10:00",
        title: "One",
        category: "deep_work",
      },
      {
        id: "b",
        start_time: "10:40",
        end_time: "11:30",
        title: "Two",
        category: "deep_work",
      },
    ];
    const [gap] = findTimelineGaps(blocks, 9 * 60, 11 * 60 + 30);
    const span = blockSpanForGap(gap, 10 * 60 + 35);

    const placed: DayPlanBlock = {
      id: "new",
      start_time: minutesToTimeLocal(span.startMinutes),
      end_time: minutesToTimeLocal(span.endMinutes),
      title: "New",
      category: "other",
    };

    expect(
      findTodayPlanBlockProblems([...blocks, placed]).overlappingBlockIds
    ).toEqual([]);
  });
});

/** Local mirror of minutesToTime, to keep this file's imports about behaviour. */
function minutesToTimeLocal(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

import { describe, expect, it } from "vitest";
import type { DayPlanBlock } from "@/lib/types";
import {
  buildTodayPlanSchedule,
  calculateTodayPlanCapacity,
  createDefaultTodayPlanMetadata,
  findTodayPlanBlockProblems,
  parseTodayPlanNotes,
  serializeTodayPlanNotes,
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
  it("creates mission-aligned blocks without duplicating scheduled commitments", () => {
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

    expect(scheduled).toHaveLength(3);
    expect(scheduled[0]).toMatchObject({
      start_time: "08:00",
      end_time: "09:00",
      mission_type: "main_quest",
      outcome_role: "must_win",
      source_type: "task",
    });
    expect(scheduled[1]).toMatchObject({
      start_time: "09:10",
      mission_type: "recovery",
      outcome_role: "health",
    });
    expect(scheduled[2]).toMatchObject({
      mission_type: "anchor",
      source_type: "journal",
    });
    expect(scheduledAgain).toEqual(scheduled);
  });

  it("keeps a transition buffer after an existing block", () => {
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

    expect(scheduled[1].start_time).toBe("10:10");
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

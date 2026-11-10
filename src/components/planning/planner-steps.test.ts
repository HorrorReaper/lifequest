import { describe, expect, it } from "vitest";
import {
  earlierStep,
  furthestStepFor,
  PLANNER_STEP_IDS,
  resolvePlannerStep,
} from "@/components/planning/planner-steps";
import { createDefaultTodayPlanMetadata } from "@/lib/today-plan";

describe("planner steps", () => {
  it("has five steps, without the anchors step", () => {
    expect(PLANNER_STEP_IDS).toEqual([
      "mood",
      "intention",
      "priorities",
      "timeline",
      "review",
    ]);
  });

  it("maps old step names and six-step indices onto the new steps", () => {
    expect(resolvePlannerStep("anchors")).toBe("timeline");
    expect(resolvePlannerStep(3)).toBe("timeline");
    expect(resolvePlannerStep(4)).toBe("timeline");
    expect(resolvePlannerStep(5)).toBe("review");
    expect(resolvePlannerStep(2)).toBe("priorities");
    expect(resolvePlannerStep("timeline")).toBe("timeline");
    expect(resolvePlannerStep(9)).toBeNull();
    expect(resolvePlannerStep(1.5)).toBeNull();
    expect(resolvePlannerStep(undefined)).toBeNull();
    expect(resolvePlannerStep("somewhere")).toBeNull();
  });

  it("never resumes past a missing answer", () => {
    const empty = createDefaultTodayPlanMetadata();
    expect(furthestStepFor(empty)).toBe("mood");
    expect(furthestStepFor({ ...empty, mood: "good" })).toBe("priorities");
    expect(
      furthestStepFor({
        ...empty,
        mood: "good",
        outcomes: [
          { id: "m", role: "must_win", title: "Ship", task_id: null, duration_minutes: 60 },
        ],
      })
    ).toBe("review");
    expect(earlierStep("review", "priorities")).toBe("priorities");
    expect(earlierStep("intention", "review")).toBe("intention");
  });
});

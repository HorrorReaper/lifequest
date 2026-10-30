import type { TodayPlanMetadata } from "@/lib/today-plan";

/**
 * The daily ritual's steps, in order.
 *
 * Daily anchors used to be a step of their own between priorities and the
 * timeline. Habits and reflections are now added from the timeline itself
 * ("Add to your day"), so the ritual has five steps.
 */
export const PLANNER_STEP_IDS = [
  "mood",
  "intention",
  "priorities",
  "timeline",
  "review",
] as const;

export type PlannerStepId = (typeof PLANNER_STEP_IDS)[number];

/** The six-step order drafts and links were written against before. */
const LEGACY_STEP_IDS = [
  "mood",
  "intention",
  "priorities",
  "anchors",
  "timeline",
  "review",
] as const;

/** Names other versions of the planner used for the same steps. */
const STEP_ALIASES: Record<string, PlannerStepId> = {
  anchors: "timeline",
  outcomes: "priorities",
  commit: "review",
};

/**
 * Reads a stored or requested step, old names and indices included.
 *
 * A number is taken as an index into the six-step order, the only order a
 * stored index can come from; anything pointing at the old anchors step
 * lands on the timeline, where its contents went. Unknown values give null.
 */
export function resolvePlannerStep(value: unknown): PlannerStepId | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) return null;
    const legacy = LEGACY_STEP_IDS[value];
    return legacy ? resolvePlannerStep(legacy) : null;
  }
  if (typeof value !== "string") return null;
  if ((PLANNER_STEP_IDS as readonly string[]).includes(value)) {
    return value as PlannerStepId;
  }
  return STEP_ALIASES[value] ?? null;
}

/**
 * The furthest step a plan may resume at.
 *
 * A restored draft reopens where it was left, but never past a step whose
 * required answer is missing: without a mood the ritual starts over, and
 * without a main focus it stops at the priorities.
 */
export function furthestStepFor(metadata: TodayPlanMetadata): PlannerStepId {
  if (!metadata.mood) return "mood";
  const main = metadata.outcomes.find((outcome) => outcome.role === "must_win");
  if (!main?.title.trim()) return "priorities";
  return "review";
}

/** The earlier of two steps. */
export function earlierStep(a: PlannerStepId, b: PlannerStepId): PlannerStepId {
  return PLANNER_STEP_IDS.indexOf(a) <= PLANNER_STEP_IDS.indexOf(b) ? a : b;
}

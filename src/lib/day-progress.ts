/**
 * How much of today's own list is done, for the dashboard's hero scene.
 *
 * The scene only ever grows with this: a sun, flowers, a tree in leaf. A day
 * with little done shows a quiet morning, never a wilting one -- LifeQuest
 * does not punish a slow day.
 */

export interface DayProgressInput {
  habitsDone: number
  habitsTotal: number
  /** Linked tasks planned into today's blocks, counted once each. */
  plannedTasksDone: number
  plannedTasks: number
  /** Reflections chosen for today in the planner. */
  reflectionsWritten: number
  reflectionsPlanned: number
  /**
   * Today's evening review: whether it is written, or null when the user has
   * it switched off or has no template for it, so it is not counted.
   */
  eveningReviewDone: boolean | null
}

/** 0 a quiet start, 1 under way, 2 a day well used. */
export type DayStage = 0 | 1 | 2

export interface DayProgress {
  done: number
  total: number
  stage: DayStage
}

/** The share of today's steps from which each stage begins. */
export const STAGE_THRESHOLDS = [1 / 3, 2 / 3] as const

/**
 * Counts every step the day was given -- each habit, each planned task, each
 * planned reflection, the evening review -- and how many are done.
 *
 * A day with nothing on it stays at the first stage: there is nothing to
 * show progress against, and that is not a shortfall.
 */
export function dayProgress(input: DayProgressInput): DayProgress {
  const review = input.eveningReviewDone
  const total =
    Math.max(0, input.habitsTotal) +
    Math.max(0, input.plannedTasks) +
    Math.max(0, input.reflectionsPlanned) +
    (review === null ? 0 : 1)
  const done =
    clamp(input.habitsDone, input.habitsTotal) +
    clamp(input.plannedTasksDone, input.plannedTasks) +
    clamp(input.reflectionsWritten, input.reflectionsPlanned) +
    (review ? 1 : 0)

  const share = total > 0 ? done / total : 0
  const stage: DayStage =
    share >= STAGE_THRESHOLDS[1] ? 2 : share >= STAGE_THRESHOLDS[0] ? 1 : 0
  return { done, total, stage }
}

function clamp(value: number, max: number) {
  return Math.min(Math.max(0, value), Math.max(0, max))
}

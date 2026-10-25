/**
 * What the dashboard says about today's plan, kept apart from the markup so
 * the rules can be tested on their own.
 *
 * Two facts are tracked separately on purpose. *Time* -- whether a block is
 * ahead, running or behind you -- comes from the clock. *Done* comes only from
 * the task a block is linked to. A block whose time has passed is not done;
 * the dashboard used to say "all done, that is the whole day done" as soon as
 * the last block ended, while the tasks in those blocks were still open.
 */

export interface PlanStatusBlock {
  id: string
  /** "HH:mm" in the user's own timezone. */
  startTime: string
  endTime: string
  title: string
  /** The linked task, when the block was planned from one. */
  taskId?: string | null
  /** Whether that task is completed. Undefined for a block with no task. */
  taskCompleted?: boolean
}

export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export interface PlanTimeSplit<T extends PlanStatusBlock> {
  ordered: T[]
  past: T[]
  current: T | null
  upcoming: T[]
}

/** Sorts the blocks and sorts them into behind / now / ahead by the clock. */
export function splitPlanByTime<T extends PlanStatusBlock>(
  blocks: readonly T[],
  nowMinutes: number
): PlanTimeSplit<T> {
  const ordered = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime))
  return {
    ordered,
    past: ordered.filter((block) => minutesFromTime(block.endTime) <= nowMinutes),
    current:
      ordered.find(
        (block) =>
          minutesFromTime(block.startTime) <= nowMinutes &&
          minutesFromTime(block.endTime) > nowMinutes
      ) ?? null,
    upcoming: ordered.filter((block) => minutesFromTime(block.startTime) > nowMinutes),
  }
}

/** Linked tasks of past blocks that are still open, one entry per task. */
export function openTasksBehind<T extends PlanStatusBlock>(past: readonly T[]): T[] {
  const seen = new Set<string>()
  return past.filter((block) => {
    if (!block.taskId || block.taskCompleted !== false) return false
    if (seen.has(block.taskId)) return false
    seen.add(block.taskId)
    return true
  })
}

export type NextUp<T extends PlanStatusBlock = PlanStatusBlock> =
  | { kind: 'first-task' }
  | { kind: 'plan-day' }
  | { kind: 'current'; block: T; minutesLeft: number }
  | { kind: 'next'; block: T; minutesUntil: number }
  | { kind: 'open-after-plan'; block: T; moreOpen: number }
  | { kind: 'plan-finished'; openHabits: number }

/**
 * The one thing the top of the dashboard points at.
 *
 * In order: the block running now, the next one ahead, a linked task the
 * day's blocks left open, and otherwise what is left of the day. Without a
 * plan it asks for one -- or, on an account with no tasks at all, for the
 * first task, since there is nothing to plan yet.
 */
export function nextUpFor<T extends PlanStatusBlock>({
  blocks,
  nowMinutes,
  openTaskCount,
  openHabits,
}: {
  blocks: readonly T[]
  nowMinutes: number
  openTaskCount: number
  openHabits: number
}): NextUp<T> {
  if (blocks.length === 0) {
    return openTaskCount === 0 ? { kind: 'first-task' } : { kind: 'plan-day' }
  }

  const { past, current, upcoming } = splitPlanByTime(blocks, nowMinutes)
  if (current) {
    return {
      kind: 'current',
      block: current,
      minutesLeft: minutesFromTime(current.endTime) - nowMinutes,
    }
  }
  if (upcoming[0]) {
    return {
      kind: 'next',
      block: upcoming[0],
      minutesUntil: minutesFromTime(upcoming[0].startTime) - nowMinutes,
    }
  }

  const open = openTasksBehind(past)
  if (open[0]) {
    return { kind: 'open-after-plan', block: open[0], moreOpen: open.length - 1 }
  }
  return { kind: 'plan-finished', openHabits }
}

/** "in 5 min", "in 1 h 20 min" -- how far away a time is, for a heading. */
export function formatRelativeMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return `${safe} min`
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

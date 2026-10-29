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
  /** The linked task's due date, "YYYY-MM-DD"; null when it has none. */
  taskDueDate?: string | null
  /** What the block was planned from, so the card can offer the right action. */
  source?: 'task' | 'habit' | 'journal' | 'other'
  /** The journal template a reflection block was reserved for. */
  templateId?: string | null
  /** "Main focus", "Second task" or "Recharge" for a priority's block. */
  priorityLabel?: string | null
}

/** A reflection chosen for today in the planner, and whether it is written. */
export interface PlannedReflection {
  templateId: string
  title: string
  written: boolean
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
  | { kind: 'tasks-due'; dueToday: number; overdue: number }
  | { kind: 'current'; block: T; minutesLeft: number; durationMinutes: number }
  | { kind: 'next'; block: T; minutesUntil: number }
  | {
      kind: 'open-after-plan'
      block: T
      moreOpen: number
      /** Distinct tasks planned into today's blocks, and how many are done. */
      plannedTasks: number
      plannedDone: number
    }
  | { kind: 'plan-finished'; openHabits: number }
  | {
      kind: 'journal-open'
      reflection: PlannedReflection
      planned: number
      written: number
    }
  | { kind: 'journal-done'; written: number }
  | {
      kind: 'evening-review'
      /** Planned tasks the day's blocks left open, for context on the card. */
      openTasks: number
      openHabits: number
    }

/** Linked tasks planned into the day, counted once each, and how many are done. */
export function plannedTaskProgress(blocks: readonly PlanStatusBlock[]): {
  planned: number
  done: number
} {
  const status = new Map<string, boolean>()
  for (const block of blocks) {
    if (!block.taskId || block.taskCompleted === undefined) continue
    status.set(block.taskId, block.taskCompleted)
  }
  return {
    planned: status.size,
    done: Array.from(status.values()).filter(Boolean).length,
  }
}

/**
 * The one thing the top of the dashboard points at.
 *
 * Once the evening review is due and no block is running or ahead, it is
 * the next step, before anything else left from the day: that is where the
 * day is looked back on, open tasks and habits included. Otherwise, in
 * order: the block running now, the next one ahead, a linked task the
 * day's blocks left open, open habits, and then the reflections chosen for
 * today -- the first one still unwritten, or that all are written. Without a
 * plan it asks for one, naming how many tasks are due today when there are
 * any -- or, on an account with no tasks at all, for the first task, since
 * there is nothing to plan yet.
 */
export function nextUpFor<T extends PlanStatusBlock>({
  blocks,
  nowMinutes,
  openTaskCount,
  openHabits,
  dueTodayCount = 0,
  overdueCount = 0,
  reflections = [],
  eveningReviewDue = false,
}: {
  blocks: readonly T[]
  nowMinutes: number
  openTaskCount: number
  openHabits: number
  /** Open tasks due today or earlier (overdue ones included). */
  dueTodayCount?: number
  /** The part of dueTodayCount that is past its due date. */
  overdueCount?: number
  /** Reflections chosen for today in the planner. */
  reflections?: readonly PlannedReflection[]
  /**
   * Whether today's evening review is due: its window is open, it has a
   * template, and no entry for it is complete yet.
   */
  eveningReviewDue?: boolean
}): NextUp<T> {
  if (blocks.length === 0) {
    if (eveningReviewDue) return { kind: 'evening-review', openTasks: 0, openHabits }
    if (openTaskCount === 0) return { kind: 'first-task' }
    return dueTodayCount > 0
      ? { kind: 'tasks-due', dueToday: dueTodayCount, overdue: overdueCount }
      : { kind: 'plan-day' }
  }

  const { past, current, upcoming } = splitPlanByTime(blocks, nowMinutes)
  if (current) {
    return {
      kind: 'current',
      block: current,
      minutesLeft: minutesFromTime(current.endTime) - nowMinutes,
      durationMinutes:
        minutesFromTime(current.endTime) - minutesFromTime(current.startTime),
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
  if (eveningReviewDue) {
    return { kind: 'evening-review', openTasks: open.length, openHabits }
  }
  if (open[0]) {
    const progress = plannedTaskProgress(blocks)
    return {
      kind: 'open-after-plan',
      block: open[0],
      moreOpen: open.length - 1,
      plannedTasks: progress.planned,
      plannedDone: progress.done,
    }
  }
  if (openHabits > 0) return { kind: 'plan-finished', openHabits }

  const written = reflections.filter((reflection) => reflection.written).length
  const unwritten = reflections.find((reflection) => !reflection.written)
  if (unwritten) {
    return {
      kind: 'journal-open',
      reflection: unwritten,
      planned: reflections.length,
      written,
    }
  }
  if (written > 0) return { kind: 'journal-done', written }
  return { kind: 'plan-finished', openHabits: 0 }
}

/**
 * A duration split for a large figure and its unit: 45 → "45" "min",
 * 80 → "1 h 20" "min", 120 → "2" "h".
 */
export function durationFigure(minutes: number): { value: string; unit: string } {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return { value: String(safe), unit: 'min' }
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  return rest === 0
    ? { value: String(hours), unit: 'h' }
    : { value: `${hours} h ${rest}`, unit: 'min' }
}

/** "in 5 min", "in 1 h 20 min" -- how far away a time is, for a heading. */
export function formatRelativeMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  if (safe < 60) return `${safe} min`
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

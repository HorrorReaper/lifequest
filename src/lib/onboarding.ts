import type { DayPlanBlock } from '@/lib/types'
import {
  createDefaultTodayPlanMetadata,
  minutesToTime,
  parseTodayPlanNotes,
  serializeTodayPlanNotes,
  timeToMinutes,
  type TodayPlanMetadata,
} from '@/lib/today-plan'

/**
 * The three-step activation flow at /onboarding: a focus, one small task,
 * and a time for it today. Pure helpers here; the screens are in
 * `src/components/onboarding/onboarding-flow.tsx`.
 */

export type OnboardingFocusId = 'work' | 'health' | 'home' | 'learning' | 'project'

/**
 * What someone wants more clarity on, and first tasks that fit it.
 *
 * The focus only steers the suggestions; it is not stored. Each suggestion
 * is small and concrete on purpose -- the point of the first task is that it
 * can actually be finished today.
 */
export const ONBOARDING_FOCUS: ReadonlyArray<{
  id: OnboardingFocusId
  label: string
  suggestions: readonly string[]
}> = [
  {
    id: 'work',
    label: 'Work or study',
    suggestions: [
      'Reply to the email I keep putting off',
      'Outline the next section of my project',
      "Prepare tomorrow's most important task",
    ],
  },
  {
    id: 'health',
    label: 'Health and energy',
    suggestions: [
      "Book the doctor's appointment",
      'Go for a 20-minute walk',
      'Plan three simple dinners',
    ],
  },
  {
    id: 'home',
    label: 'Home and life admin',
    suggestions: ['Pay the open bill', 'Clear the kitchen counter', "Sort this week's mail"],
  },
  {
    id: 'learning',
    label: 'Learning',
    suggestions: ['Read one chapter', 'Do one practice session', 'Watch one lesson and take notes'],
  },
  {
    id: 'project',
    label: 'A personal project',
    suggestions: [
      'Write down the next three steps',
      'Spend 25 minutes on the first step',
      'Collect what I need in one place',
    ],
  },
]

/** Block lengths offered on the scheduling step, in minutes. */
export const ONBOARDING_DURATIONS = [15, 25, 45, 60] as const
export const DEFAULT_ONBOARDING_DURATION = 25

const LAST_MINUTE = 23 * 60 + 59
/** The latest a suggested start may be, so even 15 minutes still fit. */
const LATEST_SUGGESTED_START = 23 * 60 + 30

/**
 * A start time a few minutes from now on the quarter hour: "now" is too
 * soon to have opened the task, and an odd minute like 14:07 is not a time
 * people plan with. Late at night it stops at 23:30.
 */
export function suggestedStartTime(nowMinutes: number): string {
  const earliest = nowMinutes + 5
  const quarter = Math.ceil(earliest / 15) * 15
  return minutesToTime(Math.min(quarter, LATEST_SUGGESTED_START))
}

/**
 * The end of a block of `duration` minutes from `start`, kept inside the day.
 * Returns null for a start that is not a valid time.
 */
export function onboardingEndTime(start: string, duration: number): string | null {
  const startMinutes = timeToMinutes(start)
  if (!Number.isFinite(startMinutes)) return null
  if (startMinutes >= LAST_MINUTE) return null
  return minutesToTime(Math.min(startMinutes + duration, LAST_MINUTE))
}

/**
 * The block's id is derived from the task, so finishing onboarding twice --
 * a double tap, the back button, a reload -- replaces the same block rather
 * than adding another one.
 */
export function onboardingBlockId(taskId: string): string {
  return `onboarding-${taskId}`
}

/**
 * Today's plan with the first task scheduled in it.
 *
 * Merges into whatever plan the day already has instead of replacing it,
 * marks the task as the day's main priority, widens the day window when the
 * block falls outside the default 08:00-18:00, and records the plan as made
 * so the morning planning prompt does not ask again today.
 */
export function buildOnboardingPlan({
  existingBlocks,
  existingNotes,
  taskId,
  title,
  start,
  end,
  now = new Date(),
}: {
  existingBlocks: readonly DayPlanBlock[]
  existingNotes: string | null
  taskId: string
  title: string
  start: string
  end: string
  now?: Date
}): { blocks: DayPlanBlock[]; notes: string } {
  const blockId = onboardingBlockId(taskId)
  const block: DayPlanBlock = {
    id: blockId,
    start_time: start,
    end_time: end,
    title,
    category: 'deep_work',
    mission_type: 'main_quest',
    source_type: 'task',
    source_id: taskId,
    outcome_role: 'must_win',
  }
  const blocks = [...existingBlocks.filter((item) => item.id !== blockId), block].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  )

  const parsed = parseTodayPlanNotes(existingNotes)
  const base: TodayPlanMetadata = parsed.metadata ?? createDefaultTodayPlanMetadata()
  const duration = timeToMinutes(end) - timeToMinutes(start)
  const metadata: TodayPlanMetadata = {
    ...base,
    outcomes: [
      ...base.outcomes.filter((outcome) => outcome.role !== 'must_win'),
      {
        id: 'outcome-must_win',
        role: 'must_win',
        title,
        task_id: taskId,
        duration_minutes: duration,
      },
    ],
    day_start: base.day_start <= start ? base.day_start : start,
    day_end: base.day_end >= end ? base.day_end : end,
    // '' is a reminder the user turned off; it stays off.
    shutdown_time:
      base.shutdown_time === '' || base.shutdown_time >= end ? base.shutdown_time : end,
    ritual_completed_at: base.ritual_completed_at ?? now.toISOString(),
  }

  return { blocks, notes: serializeTodayPlanNotes(metadata, parsed.legacyNotes) }
}

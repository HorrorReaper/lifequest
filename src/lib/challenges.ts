import { daysBetween } from '@/lib/dates'
import type { ChallengeProgram, ChallengeSyncState } from '@/lib/challenge-programs'
import { isAutomaticRule } from '@/lib/challenge-rules'
import type { ChallengeDayRow } from '@/lib/supabase/database.types'

// Derived state for the challenge surfaces (/challenges, the detail page and
// the dashboard card), for shared and personal challenges alike.
//
// The challenge RPCs resolve "today" from the profile timezone. Computing it
// from the browser clock instead once offered actions the server rejected,
// or reported a strict streak as broken while the server still accepted the
// day. These functions take the day as an argument so the caller passes the
// same date key the server will use.

export interface ProgramDayState {
  completedDays: number
  /** The day the user is working on, clamped to the program length. */
  currentDayNumber: number
  checkedToday: boolean
  /**
   * A strict program whose calendar has moved past the day the user is on.
   * The card offers a restart instead of a completion when this is true, so
   * it must agree with the server's idea of the current day.
   */
  strictMissed: boolean
  percent: number
  complete: boolean
}

export function getProgramDayState(
  program: ChallengeProgram,
  today: string
): ProgramDayState {
  const { template, enrollment, progress } = program
  const completedDays = new Set(progress.map((item) => item.day_number)).size
  const complete = enrollment?.status === 'completed'
  const currentDayNumber = Math.min(completedDays + 1, template.duration_days)

  return {
    completedDays,
    currentDayNumber,
    checkedToday: progress.some((item) => item.completed_on === today),
    strictMissed: Boolean(
      enrollment &&
        template.schedule_mode === 'strict' &&
        !complete &&
        daysBetween(enrollment.start_date, today) + 1 > currentDayNumber
    ),
    percent: Math.round((completedDays / template.duration_days) * 100),
    complete,
  }
}

export type ChallengeViewStatus = 'not_started' | 'active' | 'completed' | 'ended'

/**
 * Everything a challenge surface needs to render one program, derived once so
 * /challenges, the detail page and the dashboard card cannot disagree.
 *
 * `sync` is this enrollment's row from sync_challenge_progress, when there is
 * one; it is the server's word on an automatic day's progress.
 */
export interface ChallengeView {
  status: ChallengeViewStatus
  completedDays: number
  totalDays: number
  percent: number
  currentDayNumber: number
  currentDay: ChallengeDayRow | null
  /** A day was completed today; the next one opens tomorrow. */
  doneToday: boolean
  strictMissed: boolean
  automatic: boolean
  ruleProgress: number
  ruleTarget: number
  ruleMet: boolean
  /** Set when the sync completed a day while loading this page. */
  justCompleted: boolean
}

export function getChallengeView(
  program: ChallengeProgram,
  today: string,
  sync?: ChallengeSyncState | null
): ChallengeView {
  const { template, enrollment, days } = program
  const dayState = getProgramDayState(program, today)
  const status: ChallengeViewStatus = !enrollment
    ? 'not_started'
    : enrollment.status === 'active'
      ? 'active'
      : enrollment.status === 'completed'
        ? 'completed'
        : 'ended'
  const currentDay = days.find((day) => day.day_number === dayState.currentDayNumber) ?? null
  const automatic = isAutomaticRule(currentDay?.completion_type)
  const matchingSync =
    sync && enrollment && sync.enrollment_id === enrollment.id && sync.day_number === dayState.currentDayNumber
      ? sync
      : null

  return {
    status,
    completedDays: dayState.completedDays,
    totalDays: template.duration_days,
    percent: Math.min(100, dayState.percent),
    currentDayNumber: dayState.currentDayNumber,
    currentDay,
    doneToday: status === 'active' && dayState.checkedToday,
    strictMissed: status === 'active' && dayState.strictMissed,
    automatic,
    ruleProgress: matchingSync?.progress ?? 0,
    ruleTarget: matchingSync?.target ?? currentDay?.completion_target ?? 1,
    ruleMet: matchingSync?.met ?? false,
    justCompleted: Boolean(sync && enrollment && sync.enrollment_id === enrollment.id && sync.completed_now),
  }
}

/** Active first, then not started, then finished; stable otherwise. */
export function sortChallengePrograms(programs: ChallengeProgram[]): ChallengeProgram[] {
  const rank = (program: ChallengeProgram) =>
    program.enrollment?.status === 'active' ? 0 : !program.enrollment ? 1 : 2
  return programs
    .map((program, index) => ({ program, index }))
    .sort((a, b) => rank(a.program) - rank(b.program) || a.index - b.index)
    .map(({ program }) => program)
}

/**
 * The fallback the challenge RPCs use when a profile has no timezone. Pages
 * must resolve "today" with the same one, or a card offers a day the server
 * then refuses.
 */
export const CHALLENGE_FALLBACK_TIMEZONE = 'Europe/Berlin'

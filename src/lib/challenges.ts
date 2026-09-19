import { addDays, daysBetween } from '@/lib/dates'
import type { ChallengeProgram, CustomQuest } from '@/lib/quests'

// Derived state for the two challenge surfaces on /quests.
//
// Both used to compute "today" from the browser clock while the RPCs behind
// them — check_in_daily_challenge_quest and complete_challenge_program_day —
// resolve it from the profile timezone. A user whose device zone differs from
// their profile zone therefore saw a check-in button the server would reject,
// or a strict streak reported as broken while the server still accepted the
// day. These functions take the day as an argument so the caller passes the
// same date key the server will use.

export interface ChallengeProgress {
  today: string
  /** Last day of the challenge window, inclusive. */
  endDate: string
  completedDays: number
  percent: number
  checkedToday: boolean
  insideWindow: boolean
  /** Every required day has a log, so the challenge can be completed. */
  ready: boolean
}

export function getChallengeProgress(
  quest: CustomQuest,
  today: string
): ChallengeProgress | null {
  if (
    quest.quest_type !== 'daily_challenge' ||
    !quest.challenge_days ||
    !quest.challenge_start_date
  ) {
    return null
  }

  const startDate = quest.challenge_start_date
  const endDate = addDays(startDate, quest.challenge_days - 1)
  // Logs outside the window are ignored rather than counted: a restarted or
  // edited challenge can leave rows on either side of it.
  const logDates = new Set(
    (quest.daily_logs ?? [])
      .map((log) => log.log_date)
      .filter((logDate) => logDate >= startDate && logDate <= endDate)
  )
  const completedDays = logDates.size

  return {
    today,
    endDate,
    completedDays,
    percent: Math.min(100, Math.round((completedDays / quest.challenge_days) * 100)),
    checkedToday: logDates.has(today),
    insideWindow: today >= startDate && today <= endDate,
    ready: completedDays >= quest.challenge_days,
  }
}

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

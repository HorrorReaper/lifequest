import { addDays, daysBetween } from '@/lib/dates'

// The journaling streak transition, isolated from the submission pipeline that
// applies it. The pipeline is a long sequence of Supabase writes and cannot be
// exercised in a unit test; this decision can be, and it is the part that is
// easy to get wrong — it used to compare a wall-clock "yesterday" against a
// UTC-formatted date, which drifted apart at daylight-saving transitions and
// reset streaks that were still alive.

export interface StreakInput {
  /** The user's current calendar day, as a date key. */
  today: string
  /** Date key of the last completed entry, or null if there is none. */
  lastJournalDate: string | null
  currentStreak: number
  streakFreezes: number
}

export interface BrokenStreak {
  length: number
  startedOn: string
  endedOn: string
}

export interface StreakTransition {
  reason: 'same_day' | 'continued' | 'first_entry' | 'frozen' | 'reset'
  /** The streak value to persist. */
  streak: number
  /** True when a freeze was spent and the remaining count must be decremented. */
  usedFreeze: boolean
  /** Set when a streak ended and should be archived; null when nothing broke. */
  brokenStreak: BrokenStreak | null
}

const MILESTONE_BONUSES: ReadonlyArray<{ days: number; bonus: number }> = [
  { days: 7, bonus: 50 },
  { days: 14, bonus: 100 },
  { days: 30, bonus: 200 },
  { days: 100, bonus: 500 },
]

export function resolveStreak({
  today,
  lastJournalDate,
  currentStreak,
  streakFreezes,
}: StreakInput): StreakTransition {
  const unchanged = { usedFreeze: false, brokenStreak: null } as const

  if (lastJournalDate === today) {
    return { reason: 'same_day', streak: currentStreak, ...unchanged }
  }

  if (!lastJournalDate) {
    return { reason: 'first_entry', streak: 1, ...unchanged }
  }

  if (lastJournalDate === addDays(today, -1)) {
    return { reason: 'continued', streak: currentStreak + 1, ...unchanged }
  }

  // Exactly one missed day is what a freeze covers. A larger gap — or a last
  // entry dated ahead of today, which a timezone change can produce — falls
  // through to a reset.
  if (daysBetween(lastJournalDate, today) === 2 && streakFreezes > 0) {
    return {
      reason: 'frozen',
      streak: currentStreak + 1,
      usedFreeze: true,
      brokenStreak: null,
    }
  }

  return {
    reason: 'reset',
    streak: 1,
    usedFreeze: false,
    brokenStreak:
      currentStreak > 0
        ? {
            length: currentStreak,
            startedOn: addDays(lastJournalDate, -(currentStreak - 1)),
            endedOn: lastJournalDate,
          }
        : null,
  }
}

/** The one-off XP bonus for reaching `streak`, or 0 on a non-milestone day. */
export function streakMilestoneBonus(streak: number): number {
  return MILESTONE_BONUSES.find((milestone) => milestone.days === streak)?.bonus ?? 0
}

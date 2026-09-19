import { addDays } from '@/lib/dates'
import { calculateStreakEndingOn } from '@/lib/habit-analytics'
import type { SkillCategory } from '@/lib/skill-categories'

/**
 * How far back the dashboard reads habit logs to derive a streak.
 *
 * The dashboard needs the streak because it sets the check-in's XP, so this
 * replaces the old today-only query rather than adding to it. A streak longer
 * than this window is under-reported, which is preferred to paging history
 * onto the home screen.
 */
export const HABIT_STREAK_WINDOW_DAYS = 400

export interface HabitRow {
  id: string
  name: string
  emoji: string | null
  skill_category?: SkillCategory | null
}

export interface HabitLogRow {
  habit_id: string
  log_date: string
}

export interface DashboardHabit {
  id: string
  name: string
  emoji: string
  completed: boolean
  /**
   * Consecutive completed days up to and including yesterday.
   *
   * Checking today off therefore pays `calculateHabitCheckInXp(streak + 1)` --
   * the same amount /habits pays, which is the whole reason the dashboard
   * reads log history at all.
   */
  streakThroughYesterday: number
  skillCategory: SkillCategory | null
}

/** The earliest log date the dashboard needs in order to derive streaks. */
export function habitStreakWindowStart(today: string): string {
  return addDays(today, -HABIT_STREAK_WINDOW_DAYS)
}

/**
 * Shapes habit rows and a window of *completed* logs into what the Habits
 * section renders. Pure, so the streak and completion logic is testable
 * without React or Supabase.
 */
export function buildDashboardHabits(
  habits: HabitRow[],
  completedLogs: HabitLogRow[],
  today: string
): DashboardHabit[] {
  const datesByHabit = new Map<string, Set<string>>()
  for (const log of completedLogs) {
    const dates = datesByHabit.get(log.habit_id) ?? new Set<string>()
    dates.add(log.log_date)
    datesByHabit.set(log.habit_id, dates)
  }

  return habits.map((habit) => {
    const dates = datesByHabit.get(habit.id) ?? new Set<string>()

    return {
      id: habit.id,
      name: habit.name,
      emoji: habit.emoji ?? '✅',
      completed: dates.has(today),
      streakThroughYesterday: calculateStreakEndingOn(dates, addDays(today, -1)),
      skillCategory: habit.skill_category ?? null,
    }
  })
}

/** Habits completed today, which `RoutinesDashboardWidget` scores progress against. */
export function completedHabitIdsFor(
  completedLogs: HabitLogRow[],
  today: string
): Set<string> {
  return new Set(
    completedLogs.filter((log) => log.log_date === today).map((log) => log.habit_id)
  )
}

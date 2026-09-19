import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateHabitCheckInXp,
  checkInHabitReward,
  undoHabitCheckInReward,
} from '@/lib/habit-xp'
import type { SkillCategory } from '@/lib/skill-categories'

// The one place a habit check-in turns into XP and coins.
//
// The same user action had three implementations and two of them paid
// nothing: /habits rewarded through the RPCs, while the dashboard's habit
// widget and its quick-check both wrote a plain habit_logs row. Anything that
// checks a habit off should come through here, so a fourth surface cannot
// quietly go unrewarded again.
//
// The streak is a parameter rather than something this module derives,
// because callers legitimately know it different ways: /habits recomputes it
// from the logs it already holds, while the dashboard is handed it by the
// server. Both must pass the streak *including* the check-in being made.

export interface HabitRewardOutcome {
  /** XP this action added. Zero when undoing a check-in. */
  xpDelta: number
  /** The profile's XP total after the change. */
  totalXp: number
  /** The coin balance after the change. */
  coins: number
}

export interface ApplyHabitCheckInRewardParams {
  habitId: string
  date: string
  /** The state being saved. */
  completed: boolean
  /** The state before this action, so a no-op toggle pays nothing. */
  wasCompleted: boolean
  /** Streak including today when completing; ignored when undoing. */
  streak: number
  skillCategory: SkillCategory | null
}

/**
 * Grants or reverses the reward for a habit check-in.
 *
 * Returns null when the toggle did not actually change state, or when the
 * server reports the reward was already settled -- both cases mean the caller
 * has nothing to apply.
 */
export async function applyHabitCheckInReward(
  supabase: SupabaseClient,
  {
    habitId,
    date,
    completed,
    wasCompleted,
    streak,
    skillCategory,
  }: ApplyHabitCheckInRewardParams
): Promise<HabitRewardOutcome | null> {
  if (completed && !wasCompleted) {
    const { xp } = calculateHabitCheckInXp(streak)
    const result = await checkInHabitReward(supabase, {
      habitId,
      date,
      xp,
      skillCategory,
    })
    if (!result.awarded) return null
    return { xpDelta: xp, totalXp: result.totalXp, coins: result.coins }
  }

  if (!completed && wasCompleted) {
    const result = await undoHabitCheckInReward(supabase, { habitId, date })
    if (!result.reversed) return null
    return { xpDelta: 0, totalXp: result.totalXp, coins: result.coins }
  }

  return null
}

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveStreak,
  streakCelebration,
  streakMilestoneBonus,
  type StreakCelebration,
} from '@/lib/streak'
import { supabaseInsert, supabaseUpdateWhere } from '@/lib/supabase/helpers'

interface ProfileSnapshot {
  total_xp: number
  current_streak: number
  best_streak: number
  last_journal_date: string | null
  streak_freezes: number
}

export interface RecordStreakDayParams {
  userId: string
  /** The user's current calendar day, as a date key in their timezone. */
  today: string
  /** XP the action itself earned, added to the profile with any milestone bonus. */
  xp?: number
  /** What the milestone bonus's xp_events row points at (an entry or plan id). */
  sourceId?: string | null
}

export interface RecordStreakDayResult {
  streak: number
  /** `xp` plus any streak milestone bonus this day triggered. */
  xpEarned: number
  totalXp: number
  /** Set when this day grew the streak; null otherwise. */
  celebration: StreakCelebration | null
}

/**
 * Counts `today` for the streak and settles what follows from it: a spent
 * freeze, the archived streak that broke, a milestone bonus, and the
 * profile's streak, best streak, `last_journal_date` and XP.
 *
 * Shared by the Daily Reflection composer (`reflection-entry.ts`) and the
 * daily planner's final save, the two ways a day counts besides the general
 * journal form (`entry-form.tsx`, which keeps its own copy). Calling it
 * twice on one day changes nothing the second time: `resolveStreak` answers
 * `same_day`.
 */
export async function recordStreakDay(
  supabase: SupabaseClient,
  { userId, today, xp = 0, sourceId = null }: RecordStreakDayParams
): Promise<RecordStreakDayResult> {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('total_xp, current_streak, best_streak, last_journal_date, streak_freezes')
    .eq('id', userId)
    .single()
  if (profileError) throw profileError
  const profile = profileData as ProfileSnapshot

  const transition = resolveStreak({
    today,
    lastJournalDate: profile.last_journal_date,
    currentStreak: profile.current_streak,
    streakFreezes: profile.streak_freezes,
  })
  const newStreak = transition.streak

  if (transition.usedFreeze) {
    await supabaseUpdateWhere(
      supabase,
      'profiles',
      { streak_freezes: profile.streak_freezes - 1 },
      'id',
      userId
    )
  }

  if (transition.brokenStreak) {
    await supabaseInsert(supabase, 'streak_history', {
      user_id: userId,
      streak_length: transition.brokenStreak.length,
      started_on: transition.brokenStreak.startedOn,
      ended_on: transition.brokenStreak.endedOn,
      used_freeze: false,
    })
  }

  const streakBonus = streakMilestoneBonus(transition)
  if (streakBonus > 0) {
    await supabaseInsert(supabase, 'xp_events', {
      user_id: userId,
      source_type: 'streak_bonus',
      source_id: sourceId,
      xp_amount: streakBonus,
      description: `${newStreak}-day streak bonus!`,
    })
  }

  const xpEarned = xp + streakBonus
  const totalXp = profile.total_xp + xpEarned

  await supabaseUpdateWhere(
    supabase,
    'profiles',
    {
      total_xp: totalXp,
      current_streak: newStreak,
      best_streak: Math.max(profile.best_streak, newStreak),
      last_journal_date: today,
      updated_at: new Date().toISOString(),
    },
    'id',
    userId
  )

  return {
    streak: newStreak,
    xpEarned,
    totalXp,
    celebration: streakCelebration(transition, profile.current_streak),
  }
}

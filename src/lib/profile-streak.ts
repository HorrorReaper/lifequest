import type { SupabaseClient } from '@supabase/supabase-js'
import { streakFromProfile, type ProfileStreakRow } from '@/lib/streak'

export interface ProfileStreak {
  /** The streak as it stands today (`displayedStreak`). */
  current: number
  /** The longest streak ever reached, as stored on the profile. */
  best: number
}

/**
 * The journaling streak for screens that do not get it from the app shell.
 *
 * The profile is the one source of truth for the streak: the journal pipeline
 * writes it, with freezes and the profile timezone applied. Recounting it from
 * `journal_entries` gave a second, different number (browser timezone,
 * `created_at` instead of `entry_date`, no freezes).
 */
export async function fetchProfileStreak(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<ProfileStreak> {
  const { data, error } = await supabase
    .from('profiles')
    .select('current_streak, best_streak, last_journal_date, streak_freezes, timezone')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  const profile = data as (ProfileStreakRow & { best_streak: number | null }) | null
  if (!profile) return { current: 0, best: 0 }

  return {
    current: streakFromProfile(profile, now),
    best: profile.best_streak ?? 0,
  }
}

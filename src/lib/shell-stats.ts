import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAvatarState, getDefaultAvatarState, type AvatarSlot } from '@/lib/avatar'

/**
 * What the app shell shows on every page: the top bar's level, XP, coins and
 * streak, and the avatar head in the bottom nav.
 */
export interface ShellStats {
  totalXp: number
  streak: number
  coins: number
  equippedItems: Record<AvatarSlot, string | null>
}

export function getDefaultShellStats(): ShellStats {
  return {
    totalXp: 0,
    streak: 0,
    coins: 0,
    equippedItems: getDefaultAvatarState().equippedItems,
  }
}

/**
 * Loaded by the (app) layout on every request, so each part degrades to its
 * default on failure rather than taking every page down with it. The bar is
 * chrome; a missing number is better than a broken app.
 */
export async function fetchShellStats(
  supabase: SupabaseClient,
  userId: string
): Promise<ShellStats> {
  const defaults = getDefaultShellStats()

  const [profileRes, cityRes, equippedItems] = await Promise.all([
    supabase.from('profiles').select('total_xp, current_streak').eq('id', userId).maybeSingle(),
    supabase.from('city_states').select('coins').eq('user_id', userId).maybeSingle(),
    fetchAvatarState(supabase, userId)
      .then((state) => state.equippedItems)
      .catch((error) => {
        console.error('Failed to load avatar for the shell:', error)
        return defaults.equippedItems
      }),
  ])

  const profile = profileRes.data as { total_xp: number | null; current_streak: number | null } | null
  const city = cityRes.data as { coins: number | null } | null

  return {
    totalXp: profile?.total_xp ?? defaults.totalXp,
    streak: profile?.current_streak ?? defaults.streak,
    coins: city?.coins ?? defaults.coins,
    equippedItems,
  }
}

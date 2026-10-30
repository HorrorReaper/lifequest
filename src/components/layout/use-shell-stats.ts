'use client'

import { useEffect } from 'react'
import { useUserStore } from '@/lib/stores/user-store'
import type { ShellStats } from '@/lib/shell-stats'

/**
 * The shell's stats, live.
 *
 * Until the store is synced the props the server loaded are used as they are,
 * so server and client markup match and nothing leaks between requests
 * through the store (a module singleton, shared on the server). After mount
 * the props are written into `user-store` and read back from it, which is what
 * lets `addXp`, `setCoins`, `updateStreak` and `setEquippedItems` called
 * anywhere in the app move the top bar and the nav's avatar immediately. A
 * `router.refresh()` hands down fresh props, which re-sync the store.
 */
export function useShellStats(initial: ShellStats): ShellStats {
  const synced = useUserStore((s) => s.shellSynced)
  const totalXp = useUserStore((s) => s.totalXp)
  const streak = useUserStore((s) => s.currentStreak)
  const coins = useUserStore((s) => s.coins)
  const equippedItems = useUserStore((s) => s.equippedItems)

  useEffect(() => {
    useUserStore.getState().syncShell(initial)
  }, [initial])

  return synced ? { totalXp, streak, coins, equippedItems } : initial
}

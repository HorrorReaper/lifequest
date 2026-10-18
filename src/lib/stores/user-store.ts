
import { create } from 'zustand'
import { getLevel, getCityTier, xpToNextLevel } from '@/lib/gamification'
import { getDefaultAvatarState, type AvatarSlot } from '@/lib/avatar'
import type { ShellStats } from '@/lib/shell-stats'

/** A finished challenge day, waiting to be celebrated (ChallengeDayOverlay). */
export interface ChallengeDayCelebration {
  /** Identifies the run, so one day of one run is celebrated once. */
  enrollmentId: string
  challengeTitle: string
  dayNumber: number
  totalDays: number
  /** The day was the challenge's last. */
  challengeCompleted: boolean
  /** Shown on the last day when known. */
  xpReward?: number
  coinReward?: number
}
// Stores in Zustand halten den lokalen Anwendungszustand und
// bieten Aktionen zum Lesen/Ändern dieses Zustands.

interface UserState {
  totalXp: number
  currentStreak: number
  bestStreak: number
  streakFreezes: number
  lastJournalDate: string | null
  username: string | null
  avatarUrl: string | null
  timezone: string
  onboardingComplete: boolean

  // Computed
  level: number
  cityTier: string
  xpToNext: number

  // Coins (shared across nav, city page, dashboard)
  coins: number

  // Worn avatar items (the bottom nav's Avatar icon)
  equippedItems: Record<AvatarSlot, string | null>

  // True once the app shell has copied the server's stats in. Until then the
  // shell renders those props itself, so server and client markup agree.
  shellSynced: boolean

  // Level-up notification
  pendingLevelUp: number | null

  // Challenge-day celebration; shown before a pending level-up
  pendingChallengeDay: ChallengeDayCelebration | null

  // Actions
  setProfile: (profile: Partial<UserState>) => void
  addXp: (amount: number, previousTotalXp?: number) => void
  notifyLevelUp: (level: number) => void
  updateStreak: (streak: number) => void
  setCoins: (coins: number) => void
  setEquippedItems: (equippedItems: Record<AvatarSlot, string | null>) => void
  syncShell: (stats: ShellStats) => void
  clearLevelUp: () => void
  notifyChallengeDay: (celebration: ChallengeDayCelebration) => void
  clearChallengeDay: () => void
}

export const useUserStore = create<UserState>((set) => ({
  totalXp: 0,
  currentStreak: 0,
  bestStreak: 0,
  streakFreezes: 1,
  lastJournalDate: null,
  username: null,
  avatarUrl: null,
  timezone: 'UTC',
  onboardingComplete: false,

  level: 1,
  cityTier: 'village',
  xpToNext: 500,

  coins: 0,
  equippedItems: getDefaultAvatarState().equippedItems,
  shellSynced: false,
  pendingLevelUp: null,
  pendingChallengeDay: null,

  setProfile: (profile) =>
    set((state) => {
      const totalXp = profile.totalXp ?? state.totalXp
      return {
        ...state,
        ...profile,
        level: getLevel(totalXp),
        cityTier: getCityTier(getLevel(totalXp)),
        xpToNext: xpToNextLevel(totalXp),
      }
    }),

  addXp: (amount, previousTotalXp) =>
    set((state) => {
      const baseXp = typeof previousTotalXp === 'number' ? previousTotalXp : state.totalXp
      const previousLevel = getLevel(baseXp)
      const newXp = baseXp + amount
      const newLevel = getLevel(newXp)
      return {
        totalXp: newXp,
        level: newLevel,
        cityTier: getCityTier(newLevel),
        xpToNext: xpToNextLevel(newXp),
        pendingLevelUp: newLevel > previousLevel ? newLevel : state.pendingLevelUp,
      }
    }),

  updateStreak: (streak) =>
    set((state) => ({
      currentStreak: streak,
      bestStreak: Math.max(state.bestStreak, streak),
    })),

  notifyLevelUp: (level) => set({ pendingLevelUp: level }),
  setCoins: (coins) => set({ coins }),
  setEquippedItems: (equippedItems) => set({ equippedItems }),

  // The whole shell snapshot in one update, so the top bar never renders a
  // half-synced mix of old and new values.
  syncShell: (stats) =>
    set({
      totalXp: stats.totalXp,
      currentStreak: stats.streak,
      coins: stats.coins,
      equippedItems: stats.equippedItems,
      level: getLevel(stats.totalXp),
      cityTier: getCityTier(getLevel(stats.totalXp)),
      xpToNext: xpToNextLevel(stats.totalXp),
      shellSynced: true,
    }),
  clearLevelUp: () => set({ pendingLevelUp: null }),
  notifyChallengeDay: (celebration) => set({ pendingChallengeDay: celebration }),
  clearChallengeDay: () => set({ pendingChallengeDay: null }),
}))

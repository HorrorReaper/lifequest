
import { create } from 'zustand'
import { getLevel, getCityTier, xpToNextLevel } from '@/lib/gamification'
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

  // Level-up notification
  pendingLevelUp: number | null

  // Actions
  setProfile: (profile: Partial<UserState>) => void
  addXp: (amount: number) => void
  updateStreak: (streak: number) => void
  setCoins: (coins: number) => void
  clearLevelUp: () => void
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
  pendingLevelUp: null,

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

  addXp: (amount) =>
    set((state) => {
      const newXp = state.totalXp + amount
      const newLevel = getLevel(newXp)
      return {
        totalXp: newXp,
        level: newLevel,
        cityTier: getCityTier(newLevel),
        xpToNext: xpToNextLevel(newXp),
        pendingLevelUp: newLevel > state.level ? newLevel : state.pendingLevelUp,
      }
    }),

  updateStreak: (streak) =>
    set((state) => ({
      currentStreak: streak,
      bestStreak: Math.max(state.bestStreak, streak),
    })),

  setCoins: (coins) => set({ coins }),
  clearLevelUp: () => set({ pendingLevelUp: null }),
}))

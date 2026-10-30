'use client'

import { useUserStore } from '@/lib/stores/user-store'
import { CITY_TIER_LABELS } from '@/lib/gamification'
import { CelebrationOverlay } from '@/components/ui/celebration-overlay'

export function LevelUpOverlay() {
  const pendingLevelUp = useUserStore((s) => s.pendingLevelUp)
  const pendingChallengeDay = useUserStore((s) => s.pendingChallengeDay)
  const pendingStreak = useUserStore((s) => s.pendingStreak)
  const cityTier = useUserStore((s) => s.cityTier)
  const clearLevelUp = useUserStore((s) => s.clearLevelUp)

  // A challenge's last day, or a journal entry that extends the streak, can
  // award enough XP for a level-up. Their own celebrations go first; this one
  // waits until they are closed rather than stacking on top of them.
  const open = pendingLevelUp !== null && pendingChallengeDay === null && pendingStreak === null

  return (
    <CelebrationOverlay
      open={open}
      onClose={clearLevelUp}
      eyebrow="Level Up!"
      badge={pendingLevelUp}
      title={CITY_TIER_LABELS[cityTier]}
      subtitle="Your city is growing!"
    />
  )
}

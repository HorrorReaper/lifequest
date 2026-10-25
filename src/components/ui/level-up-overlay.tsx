'use client'

import { useUserStore } from '@/lib/stores/user-store'
import { CITY_TIER_LABELS } from '@/lib/gamification'
import { CelebrationOverlay } from '@/components/ui/celebration-overlay'

export function LevelUpOverlay() {
  const pendingLevelUp = useUserStore((s) => s.pendingLevelUp)
  const pendingChallengeDay = useUserStore((s) => s.pendingChallengeDay)
  const cityTier = useUserStore((s) => s.cityTier)
  const clearLevelUp = useUserStore((s) => s.clearLevelUp)

  // A challenge's last day can award enough XP for a level-up. Its own
  // celebration goes first; this one waits until that one is closed rather
  // than stacking on top of it.
  const open = pendingLevelUp !== null && pendingChallengeDay === null

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

'use client'

import { Trophy } from 'lucide-react'
import { useUserStore, type ChallengeDayCelebration } from '@/lib/stores/user-store'
import { CelebrationOverlay } from '@/components/ui/celebration-overlay'

/** The overlay's wording for one finished day; the last day reads differently. */
export function describeChallengeDay({
  challengeTitle,
  dayNumber,
  totalDays,
  challengeCompleted,
  xpReward,
  coinReward,
}: ChallengeDayCelebration) {
  if (!challengeCompleted) {
    return {
      eyebrow: 'Day complete!',
      title: challengeTitle,
      subtitle: `${dayNumber} of ${totalDays} days`,
    }
  }
  return {
    eyebrow: 'Challenge complete!',
    title: challengeTitle,
    subtitle:
      xpReward !== undefined && coinReward !== undefined
        ? `+${xpReward} XP · +${coinReward} coins`
        : `All ${totalDays} days done.`,
  }
}

/**
 * The level-up style moment for a finished challenge day: the day number in
 * the ring, the challenge and how far along it is. On the last day the ring
 * holds a trophy and the rewards are named when known.
 *
 * Fed by `notifyChallengeDay` in the user store, which every place that can
 * complete a day calls (see docs/features/gamification.md). Mounted once in
 * the (app) layout, next to the level-up overlay, which waits for this one.
 */
export function ChallengeDayOverlay() {
  const celebration = useUserStore((s) => s.pendingChallengeDay)
  const clear = useUserStore((s) => s.clearChallengeDay)
  const text = celebration ? describeChallengeDay(celebration) : null

  return (
    <CelebrationOverlay
      open={celebration !== null}
      onClose={clear}
      eyebrow={text?.eyebrow ?? ''}
      badge={
        celebration?.challengeCompleted ? (
          <Trophy className="size-12" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          celebration?.dayNumber
        )
      }
      title={text?.title}
      subtitle={text?.subtitle}
    />
  )
}

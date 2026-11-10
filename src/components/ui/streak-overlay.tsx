'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { useUserStore } from '@/lib/stores/user-store'
import { nextStreakMilestone, type StreakCelebration } from '@/lib/streak'
import { CelebrationOverlay } from '@/components/ui/celebration-overlay'

/** When the ring's number flips from the old streak to the new one. */
const COUNT_UP_DELAY_MS = 900

function days(count: number) {
  return `${count} ${count === 1 ? 'day' : 'days'}`
}

/** The overlay's wording for one extension. */
export function describeStreakExtension({ to, usedFreeze, bonusXp }: StreakCelebration) {
  const next = nextStreakMilestone(to)
  const progress =
    bonusXp > 0
      ? `+${bonusXp} XP streak bonus`
      : next
        ? `${days(next.days - to)} to your ${next.days}-day bonus`
        : 'Keep the flame alive.'

  return {
    eyebrow: 'Streak extended!',
    title: days(to),
    subtitle: usedFreeze ? `Streak freeze used · ${progress}` : progress,
  }
}

/**
 * The ring's content: a flame that grows and the streak flipping from its old
 * value to its new one. Mounted fresh each time the overlay opens, so the
 * count starts over for every celebration. With reduced motion it shows the
 * new value straight away.
 */
function StreakBadge({ from, to }: { from: number; to: number }) {
  const reduceMotion = useReducedMotion()
  const [count, setCount] = useState(reduceMotion ? to : from)

  useEffect(() => {
    if (reduceMotion) return
    const timer = setTimeout(() => setCount(to), COUNT_UP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [reduceMotion, to])

  return (
    // The title already says the new length; the flip is decoration.
    <span className="flex flex-col items-center leading-none" aria-hidden="true">
      <motion.span
        initial={reduceMotion ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.35 }}
      >
        <Flame className="size-9" strokeWidth={2.25} />
      </motion.span>
      <motion.span
        key={count}
        data-testid="streak-count"
        initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="text-4xl"
      >
        {count}
      </motion.span>
    </span>
  )
}

/**
 * The level-up style moment for a streak that just grew, in the flame's
 * orange. Fed by `notifyStreakExtended` in the user store, which both journal
 * save paths call (see docs/features/gamification.md). Mounted once in the
 * (app) layout; it waits for a challenge-day celebration, and a level-up
 * waits for it.
 */
export function StreakOverlay() {
  const celebration = useUserStore((s) => s.pendingStreak)
  const pendingChallengeDay = useUserStore((s) => s.pendingChallengeDay)
  const clear = useUserStore((s) => s.clearStreakExtended)
  const text = celebration ? describeStreakExtension(celebration) : null

  return (
    <CelebrationOverlay
      open={celebration !== null && pendingChallengeDay === null}
      onClose={clear}
      tone="streak"
      eyebrow={text?.eyebrow ?? ''}
      badge={celebration && <StreakBadge from={celebration.from} to={celebration.to} />}
      title={text?.title}
      subtitle={text?.subtitle}
    />
  )
}

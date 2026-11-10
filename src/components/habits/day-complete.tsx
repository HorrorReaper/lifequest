'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion, type MotionProps } from 'framer-motion'
import { Check } from 'lucide-react'
import {
  claimDayCompleteCelebration,
  releaseDayCompleteCelebration,
} from '@/lib/habit-day-complete'
import { cn } from '@/lib/utils'

// The "all habits done" moment, shared by the dashboard's Habits section and
// /habits: once the last habit of the day is ticked off, the check marks pop
// one after another and turn green, the progress bar turns green, and the
// count gives way to "All done today". The green stays for as long as the
// day is complete; the wave plays once per day (see habit-day-complete.ts).

/** A done check mark while the whole day is done. */
export const DAY_COMPLETE_CHECK_CLASS =
  'border-green-600 bg-green-600 text-white dark:border-green-500 dark:bg-green-500'

/** A done row's outline and tint while the whole day is done (dashboard). */
export const DAY_COMPLETE_ROW_CLASS = 'border-green-600/40 bg-green-600/5 dark:border-green-500/40'

/** The progress bar's fill while the whole day is done. */
export const DAY_COMPLETE_BAR_CLASS = 'bg-green-600 dark:bg-green-500'

const WAVE_START_S = 0.15
const WAVE_STEP_S = 0.09
/** Long enough for a full preview list's wave and the badge to settle. */
const CELEBRATION_MS = 2000

/**
 * Whether the wave is playing, plus the two calls a check-in makes: `celebrate`
 * when it completes the day (it plays at most once per user and day), and
 * `cancel` when that check-in then fails to save.
 */
export function useDayCompleteCelebration(userId: string, today: string) {
  const [celebrating, setCelebrating] = useState(false)
  // Whether this tab holds today's claim, so a failed save can give it back.
  const claimed = useRef(false)

  useEffect(() => {
    if (!celebrating) return
    const timer = setTimeout(() => setCelebrating(false), CELEBRATION_MS)
    return () => clearTimeout(timer)
  }, [celebrating])

  const celebrate = useCallback(() => {
    if (!claimDayCompleteCelebration(userId, today)) return
    claimed.current = true
    setCelebrating(true)
  }, [userId, today])

  const cancel = useCallback(() => {
    if (claimed.current) releaseDayCompleteCelebration(userId, today)
    claimed.current = false
    setCelebrating(false)
  }, [userId, today])

  return { celebrating, celebrate, cancel }
}

/**
 * Motion props for the check mark at `index` (top to bottom): a pop that
 * reaches each row a beat after the one above, with its colour change delayed
 * to match. Spread onto a `motion.span` that has `transition-colors`.
 */
export function dayCompleteWave(
  index: number,
  celebrating: boolean,
  reduceMotion: boolean | null
): MotionProps & { style?: CSSProperties } {
  if (!celebrating || reduceMotion) return { animate: { scale: 1 } }

  const delay = WAVE_START_S + index * WAVE_STEP_S
  return {
    animate: { scale: [1, 1.4, 1] },
    transition: { duration: 0.5, delay, ease: 'easeOut' },
    style: { transitionDelay: `${delay + 0.1}s` },
  }
}

/**
 * "All done today", standing in for the day's count. Pops in when it appears
 * because of a celebration; on a page that loads with the day already done it
 * is simply there.
 */
export function DayCompleteBadge({
  celebrating,
  className,
}: {
  celebrating: boolean
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.span
      initial={celebrating && !reduceMotion ? { scale: 0.3, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.6 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-green-600/10 px-2.5 py-0.5 align-middle text-sm font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400',
        className
      )}
    >
      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      All done today
    </motion.span>
  )
}

/**
 * Tells screen readers once that the day is done. Keep it mounted: a live
 * region only announces text that changes inside it.
 */
export function DayCompleteAnnouncer({ celebrating }: { celebrating: boolean }) {
  return (
    <span role="status" className="sr-only">
      {celebrating ? 'All habits done today' : ''}
    </span>
  )
}

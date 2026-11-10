'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Coins, Flame } from 'lucide-react'
import { getLevel, getXpProgress } from '@/lib/gamification'
import type { ShellStats } from '@/lib/shell-stats'
import { cn } from '@/lib/utils'
import { useGains, type Gain } from '@/components/layout/use-gains'

/**
 * Level, XP, coins and streak, on every page with the standard shell.
 *
 * Sticky rather than fixed, and offset by `--preview-banner-height` (set by
 * the (app) layout only while an admin previews as a user): the preview
 * banner is itself `sticky top-0`, and a bar pinned to the same edge would
 * slide out of sight behind it.
 *
 * Presentational on purpose -- `AppShell` feeds it live values -- and built
 * from theme tokens, so it follows White, System, Dark and Trail.
 *
 * Earning XP or coins anywhere in the app shows here: a small "+N" rises
 * from the value and fades, and the number gives a short pulse (see
 * `useGains`). Nothing animates on load, on a decrease, or under reduced
 * motion.
 */
export function AppTopBar({ stats }: { stats: ShellStats }) {
  const reduceMotion = Boolean(useReducedMotion())
  const xpGains = useGains(stats.totalXp, !reduceMotion)
  const coinGains = useGains(stats.coins, !reduceMotion)

  const level = getLevel(stats.totalXp)
  const progress = getXpProgress(stats.totalXp)
  // Below zero for a brand-new account: level 1 starts above 0 XP, so the
  // raw figure is negative until the first level-up threshold is crossed.
  const pct = Math.min(100, Math.max(0, progress.pct))

  return (
    <div
      role="group"
      aria-label="Your progress"
      className="sticky top-[var(--preview-banner-height,0px)] z-40 border-b border-border/50 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex h-12 max-w-2xl items-center gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 text-sm font-semibold tabular-nums">Lv {level}</span>
          <div className="relative min-w-0 flex-1">
            <div
              role="progressbar"
              aria-label={`XP progress to level ${level + 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-0.5 truncate text-[10px] leading-none tabular-nums text-muted-foreground">
              <Pulse gains={xpGains.gains}>{stats.totalXp}</Pulse> / {progress.next} XP
            </p>
            <GainFloats
              gains={xpGains.gains}
              onDone={xpGains.dismiss}
              unit=" XP"
              className="right-0 top-2 text-primary"
            />
          </div>
        </div>

        <span
          className="relative flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums"
          aria-label={`${stats.coins} coins`}
        >
          <Coins className="size-4 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
          <Pulse gains={coinGains.gains}>{stats.coins}</Pulse>
          <GainFloats
            gains={coinGains.gains}
            onDone={coinGains.dismiss}
            className="right-0 -top-3 text-yellow-600 dark:text-yellow-400"
          />
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums"
          aria-label={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'} streak`}
        >
          <Flame className="size-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
          {stats.streak}
        </span>
      </div>
    </div>
  )
}

/**
 * The value itself, with a short springy pulse each time a gain arrives:
 * keyed on the newest gain, so every one replays it and the first render
 * does not.
 */
function Pulse({ gains, children }: { gains: Gain[]; children: ReactNode }) {
  const latest = gains.at(-1)
  return (
    <motion.span
      key={latest?.id ?? 'resting'}
      className="inline-block origin-center"
      initial={latest ? { scale: 1.3 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
    >
      {children}
    </motion.span>
  )
}

/**
 * "+N" labels that rise from the value and fade out, one per gain. Purely
 * visual (aria-hidden): the value itself is what assistive tech reads.
 */
function GainFloats({
  gains,
  onDone,
  unit = '',
  className,
}: {
  gains: Gain[]
  onDone: (id: string) => void
  unit?: string
  className?: string
}) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute', className)}>
      <AnimatePresence>
        {gains.map((gain, index) => (
          <motion.span
            key={gain.id}
            data-testid="gain-float"
            className="absolute right-0 whitespace-nowrap text-[11px] font-bold tabular-nums"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: [0, 1, 1, 0], y: -12 }}
            // Several quick gains start a little apart instead of on top of
            // one another.
            transition={{ duration: 1.1, delay: index * 0.15, ease: 'easeOut' }}
            onAnimationComplete={() => onDone(gain.id)}
          >
            +{gain.amount}
            {unit}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  )
}

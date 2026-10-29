'use client'

import { Fraunces } from 'next/font/google'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '@/components/providers/theme-provider'
import { AvatarFigure } from '@/components/profile/AvatarFigure'
import { DashboardHeroScene } from '@/components/dashboard/DashboardHeroScene'
import type { AvatarSlot } from '@/lib/avatar'
import type { DayProgress, DayStage } from '@/lib/day-progress'

// Scoped to this component only -- must not touch the app's global
// font-sans/Inter setup in src/app/layout.tsx, the same isolation rule the
// Nightfall landing page redesign followed for its own fonts (see
// docs/superpowers/specs/2026-08-21-landing-page-nightfall-city-design.md).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['600'] })

interface DashboardGreetingProps {
  username: string | null
  /** Drives the avatar, hat and gear included. */
  equippedItems: Record<AvatarSlot, string | null>
  /** Today in words, e.g. "Saturday, October 25", in the user's timezone. */
  dateLabel?: string
  /**
   * Minutes past midnight in the profile timezone, measured on the server.
   * Picks "Good morning / afternoon / evening"; without it the greeting is
   * "Welcome back".
   */
  nowMinutes?: number
  /** How much of today is done; picks the scene's stage. */
  progress?: DayProgress
}

/**
 * The opening words for the time of day: morning from 05:00, afternoon from
 * 12:00, evening from 18:00 and through the night.
 */
export function greetingFor(nowMinutes: number | undefined): string {
  if (nowMinutes === undefined || !Number.isFinite(nowMinutes)) return 'Welcome back'
  const hour = Math.floor(nowMinutes / 60)
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** How long the avatar takes to walk onto the path, in seconds. */
export const WALK_SECONDS = 1.6

/** How far apart the scene's stages arrive while it walks, in milliseconds. */
export const STAGE_STEP_MS = 600

/** Four strides: a bob up and a slight lean each, ending upright. */
const STRIDE_Y = [0, -5, 0, -5, 0, -5, 0, -5, 0]
const STRIDE_ROTATE = [0, -4, 0, 4, 0, -4, 0, 4, 0]

/**
 * The top of the dashboard: a welcome over a small landscape the avatar
 * stands in, which fills in as the day's steps get done (see
 * `DashboardHeroScene` and `dayProgress`). Level, XP, coins and streak used
 * to live in a hero card here; they are in the top bar on every page now
 * (see `AppTopBar`).
 *
 * Kept short on purpose (160px on a phone): the greeting is orientation, and
 * the next step below it is the part of the page that asks for attention.
 *
 * On load the avatar walks in from the left, bobbing with each stride, and
 * the world grows stage by stage up to today's while it walks -- about a
 * second and a half, then everything holds still. Anyone who asked for less
 * motion gets the finished scene straight away.
 */
export function DashboardGreeting({
  username,
  equippedItems,
  dateLabel,
  nowMinutes,
  progress,
}: DashboardGreetingProps) {
  const { theme } = useTheme()
  const name = username ?? 'Adventurer'
  const opening = greetingFor(nowMinutes)
  const stage = progress?.stage ?? 0
  const reduceMotion = useReducedMotion()
  // How far the walk has grown the scene so far; it climbs to `stage` one
  // step at a time, and never past it.
  const [reached, setReached] = useState<DayStage>(0)

  useEffect(() => {
    if (reduceMotion) return
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let next = 1; next <= stage; next += 1) {
      timers.push(
        setTimeout(
          () => setReached((current) => Math.max(current, next) as DayStage),
          STAGE_STEP_MS * next
        )
      )
    }
    return () => timers.forEach(clearTimeout)
  }, [stage, reduceMotion])

  const shownStage = reduceMotion ? stage : (Math.min(reached, stage) as DayStage)

  return (
    <motion.section
      aria-labelledby="dashboard-greeting"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative h-40 overflow-hidden rounded-2xl border shadow-sm sm:h-44"
    >
      <DashboardHeroScene stage={shownStage} className="absolute inset-0" />

      <div className="relative z-10 max-w-[56%] p-4 sm:p-5">
        {theme === 'trail' ? (
          <h1
            id="dashboard-greeting"
            className={`${fraunces.className} text-xl leading-snug text-foreground sm:text-2xl`}
          >
            {opening}, {name}.
          </h1>
        ) : (
          <h1 id="dashboard-greeting" className="font-heading text-xl font-semibold sm:text-2xl">
            {opening}, {name} 👋
          </h1>
        )}
        {dateLabel && <p className="text-sm text-muted-foreground">{dateLabel}</p>}
        {progress && progress.total > 0 && (
          <p className="sr-only">
            Your day so far: {progress.done} of {progress.total} steps done.
          </p>
        )}
      </div>

      {/* Ends standing on the path, right of the words so it never sits on
          them. The outer layer walks it in; the inner one is the stride. */}
      <motion.div
        data-slot="hero-walker"
        className="absolute bottom-1 z-10"
        initial={reduceMotion ? false : { left: '-20%' }}
        animate={{ left: '58%' }}
        transition={{ duration: WALK_SECONDS, ease: 'easeOut' }}
      >
        <motion.div
          initial={false}
          animate={reduceMotion ? undefined : { y: STRIDE_Y, rotate: STRIDE_ROTATE }}
          transition={{ duration: WALK_SECONDS, ease: 'linear' }}
          style={{ transformOrigin: '50% 100%' }}
        >
          <AvatarFigure equippedItems={equippedItems} className="h-24 w-auto sm:h-28" />
        </motion.div>
      </motion.div>
    </motion.section>
  )
}

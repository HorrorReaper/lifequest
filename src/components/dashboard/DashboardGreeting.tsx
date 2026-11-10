'use client'

import { Fraunces } from 'next/font/google'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Pause, Play } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTheme } from '@/components/providers/theme-provider'
import { AvatarFigure } from '@/components/profile/AvatarFigure'
import { Button } from '@/components/ui/button'
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

/** How far each leg swings to either side of straight down, in degrees. */
export const STRIDE_DEGREES = 13

/**
 * How long one stride (a step with each leg) takes, in seconds. Timed so a
 * planted foot swings back exactly as fast as the path drifts past, which is
 * what keeps it from sliding: in half a stride a foot covers
 * 2 x AVATAR_LEG_UNITS x sin(STRIDE_DEGREES) of the figure's own units, and
 * on a phone (158px of scene inside the 160px hero's border, showing the
 * scene's 140 units; a 96px avatar drawn in 160) the path drifts
 * TILE / NEAR_SCROLL_SECONDS scene units a second. Other widths scale the
 * scene by up to about 6% more or less than the avatar, too little to see.
 * Change it together with NEAR_SCROLL_SECONDS.
 */
export const STRIDE_SECONDS = 1.47

/** How far apart the scene's stages arrive while it walks, in milliseconds. */
export const STAGE_STEP_MS = 600

/** Where the viewer's choice to pause the scene is remembered, per browser. */
export const HERO_PAUSE_KEY = 'lifequest:hero-scene-paused'
const PAUSE_EVENT = 'lifequest-hero-pause'

/**
 * Whether the viewer paused the scene, read from localStorage. A store
 * rather than state, so the server render (never paused) and the browser's
 * remembered choice do not disagree during hydration.
 */
const pausePreference = {
  subscribe(onChange: () => void) {
    window.addEventListener('storage', onChange)
    window.addEventListener(PAUSE_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(PAUSE_EVENT, onChange)
    }
  },
  get(): boolean {
    try {
      return window.localStorage.getItem(HERO_PAUSE_KEY) === 'true'
    } catch {
      return false
    }
  },
  set(paused: boolean) {
    try {
      window.localStorage.setItem(HERO_PAUSE_KEY, String(paused))
    } catch {
      // A private window may refuse storage; the button still works for
      // this page, it just is not remembered.
    }
    window.dispatchEvent(new Event(PAUSE_EVENT))
  },
}

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
 * On load the avatar walks in from the left and the world grows stage by
 * stage up to today's while it walks. After that it keeps walking slowly on
 * the spot while the landscape drifts past, for as long as the page is open.
 * The movement stops while the hero is scrolled out of view, and a button in
 * the corner pauses it for good (remembered per browser) -- moving content
 * beside other content needs a way to stop it. Anyone who asked for less
 * motion gets the finished scene, standing still, straight away.
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

  const pausedByViewer = useSyncExternalStore(
    pausePreference.subscribe,
    pausePreference.get,
    () => false
  )
  // No point moving a landscape nobody can see.
  const heroRef = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const node = heroRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.section
      ref={heroRef}
      data-hero-paused={pausedByViewer || !inView ? 'true' : 'false'}
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

      {/* Ends on the path, right of the words so it never sits on them. The
          outer layer walks it in once; the inner one carries the walk cycle,
          CSS loops on the avatar's legs, arms and body that keep going
          (`.hero-stride` in globals.css). */}
      <motion.div
        data-slot="hero-walker"
        className="absolute bottom-1 z-10"
        initial={reduceMotion ? false : { left: '-20%' }}
        animate={{ left: '58%' }}
        transition={{ duration: WALK_SECONDS, ease: 'easeOut' }}
      >
        <div
          className="hero-stride"
          style={
            {
              '--hero-stride': `${STRIDE_SECONDS}s`,
              '--hero-stride-angle': `${STRIDE_DEGREES}deg`,
            } as CSSProperties
          }
        >
          <AvatarFigure equippedItems={equippedItems} className="h-24 w-auto sm:h-28" />
        </div>
      </motion.div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-pressed={pausedByViewer}
        aria-label={pausedByViewer ? 'Play the scene' : 'Pause the scene'}
        onClick={() => pausePreference.set(!pausedByViewer)}
        className="absolute top-1 right-1 z-20 text-foreground/60 hover:text-foreground motion-reduce:hidden"
      >
        {pausedByViewer ? <Play className="size-4" /> : <Pause className="size-4" />}
      </Button>
    </motion.section>
  )
}

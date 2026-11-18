'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { DashboardHeroScene, SCENE_HEIGHT } from '@/components/dashboard/DashboardHeroScene'
import { AvatarFigure } from '@/components/profile/AvatarFigure'
import { getDefaultAvatarState } from '@/lib/avatar'
import type { DayStage } from '@/lib/day-progress'
import { cn } from '@/lib/utils'

/** Where the path runs, in scene units up from the scene's bottom edge. */
const PATH_FROM_BOTTOM = 12

const noSubscription = () => () => {}

interface OnboardingSceneProps {
  /** How far the landscape has grown: see `sceneStageFor`. */
  stage: DayStage
  /** The scene's height in px; it eases between steps. */
  height: number
  /** The avatar's height in px. */
  avatarHeight: number
  /** What the traveller says, or null for nothing. */
  greeting: string | null
  /** Back button and progress, laid over the sky. */
  children?: ReactNode
}

/**
 * The trail scene at the top of onboarding: the dashboard's landscape
 * (`DashboardHeroScene`, without the veil it keeps for the greeting text)
 * with the default avatar walking on the path, the same walk cycle as on the
 * dashboard. It grows with the answers and says hello once there is a name.
 *
 * Decorative: the scene and the avatar are hidden from assistive technology;
 * the greeting is repeated nowhere else, so it is a polite live region.
 */
export function OnboardingScene({
  stage,
  height,
  avatarHeight,
  greeting,
  children,
}: OnboardingSceneProps) {
  const reduceMotion = useReducedMotion()
  // The walk starts once the page is live, as on the dashboard.
  const live = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  )
  const scale = height / SCENE_HEIGHT
  const feet = Math.max(0, Math.round(PATH_FROM_BOTTOM * scale - 4))
  const { equippedItems } = getDefaultAvatarState()

  return (
    <div
      data-slot="onboarding-scene"
      className="relative shrink-0 overflow-hidden transition-[height] duration-700 ease-out motion-reduce:transition-none"
      style={{ height }}
    >
      <DashboardHeroScene stage={stage} veil={false} className="absolute inset-0" />

      <div
        aria-hidden="true"
        className={cn(
          'absolute left-[28%] z-10 transition-[bottom] duration-700 ease-out motion-reduce:transition-none',
          live && 'hero-walker'
        )}
        // `.hero-walker` in globals.css carries the walk's timings, the
        // same values DashboardGreeting sets.
        style={{ bottom: feet }}
      >
        <div
          className={cn(
            'transition-[height] duration-700 ease-out motion-reduce:transition-none',
            live && 'hero-stride'
          )}
          style={{ height: avatarHeight }}
        >
          <AvatarFigure equippedItems={equippedItems} className="h-full w-auto" />
        </div>
      </div>

      <div
        aria-live="polite"
        className="absolute z-20 transition-[bottom] duration-700 ease-out motion-reduce:transition-none"
        style={{ left: `calc(28% + ${Math.round(avatarHeight * 0.42)}px)`, bottom: feet + avatarHeight - 4 }}
      >
        <AnimatePresence>
          {greeting && (
            <motion.p
              key="greeting"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              style={{ transformOrigin: '14px 100%' }}
              className="relative m-0 whitespace-nowrap rounded-2xl bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-md"
            >
              {greeting}
              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 left-3 size-3 rotate-45 rounded-[2px] bg-card"
              />
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {children}
    </div>
  )
}

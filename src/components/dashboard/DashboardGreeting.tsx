'use client'

import { Fraunces } from 'next/font/google'
import { motion } from 'framer-motion'
import { useTheme } from '@/components/providers/theme-provider'
import { AvatarHead } from '@/components/profile/AvatarFigure'
import type { AvatarSlot } from '@/lib/avatar'

// Scoped to this component only -- must not touch the app's global
// font-sans/Inter setup in src/app/layout.tsx, the same isolation rule the
// Nightfall landing page redesign followed for its own fonts (see
// docs/superpowers/specs/2026-08-21-landing-page-nightfall-city-design.md).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['600'] })

interface DashboardGreetingProps {
  username: string | null
  /** Drives the avatar head, hat included. */
  equippedItems: Record<AvatarSlot, string | null>
}

/**
 * The top of the dashboard: the avatar and a welcome. Level, XP, coins and
 * streak used to live in a hero card here; they are in the top bar on every
 * page now (see `AppTopBar`).
 */
export function DashboardGreeting({ username, equippedItems }: DashboardGreetingProps) {
  const { theme } = useTheme()
  const name = username ?? 'Adventurer'

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center gap-4"
    >
      <AvatarHead equippedItems={equippedItems} className="size-20 shrink-0 sm:size-24" />
      {theme === 'trail' ? (
        <h1 className={`${fraunces.className} text-2xl leading-snug text-foreground sm:text-3xl`}>
          Welcome back, {name}.
        </h1>
      ) : (
        <h1 className="font-heading text-xl font-bold sm:text-2xl">Welcome back, {name} 👋</h1>
      )}
    </motion.div>
  )
}

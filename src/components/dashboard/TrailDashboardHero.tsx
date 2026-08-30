'use client'

import { Fraunces } from 'next/font/google'
import { motion } from 'framer-motion'
import { Coins, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { XpRing } from './XpRing'

// Scoped to this component only -- must not touch the app's global
// font-sans/Inter setup in src/app/layout.tsx, the same isolation rule the
// Nightfall landing page redesign followed for its own fonts (see
// docs/superpowers/specs/2026-08-21-landing-page-nightfall-city-design.md).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['600'] })

interface TrailDashboardHeroProps {
  username: string | null
  level: number
  cityTierLabel: string
  xpNext: number
  totalXp: number
  pct: number
  coins: number
  streak: number
}

// Fixed positions, not generated from Math.random(): the trail direction's
// illustrated scene must render identically on the server and the client,
// the same hydration-safety rule the Nightfall skyline/star field follow
// (see src/lib/nightfall-scene.ts). Three trees is little enough content
// that a separate generator module would add a layer of indirection this
// scene doesn't need -- these are just fixed decorative coordinates.
const TRAIL_TREES: ReadonlyArray<{ x: number; height: number }> = [
  { x: 26, height: 30 },
  { x: 48, height: 40 },
  { x: 70, height: 26 },
]

// Colors are literal (not theme CSS variables): this component only ever
// renders while the Trail theme is active (see ThemedDashboardHero), so
// there is nothing for them to react to.
function TrailScene() {
  return (
    <svg
      viewBox="0 0 400 130"
      className="h-28 w-full sm:h-32"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax slice"
    >
      <polygon points="185,112 255,18 330,112" fill="hsl(32 45% 88%)" stroke="hsl(152 38% 24%)" strokeOpacity="0.35" strokeWidth="1.5" />
      <polygon points="245,112 300,48 385,112" fill="hsl(28 42% 80%)" stroke="hsl(152 38% 24%)" strokeOpacity="0.35" strokeWidth="1.5" />

      <path
        d="M 8 118 Q 100 100 190 110 T 392 96"
        fill="none"
        stroke="hsl(30 14% 40%)"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />
      <circle cx="190" cy="109" r="4.5" fill="hsl(152 38% 24%)" />
      <circle cx="190" cy="109" r="8" fill="none" stroke="hsl(152 38% 24%)" strokeOpacity="0.35" strokeWidth="1.5" />

      {TRAIL_TREES.map((tree) => (
        <g key={tree.x}>
          <polygon
            points={`${tree.x - 12},118 ${tree.x + 12},118 ${tree.x},${118 - tree.height}`}
            fill="hsl(152 38% 24%)"
            fillOpacity="0.55"
          />
          <rect x={tree.x - 2} y={118} width={4} height={8} fill="hsl(152 38% 24%)" fillOpacity="0.4" />
        </g>
      ))}
    </svg>
  )
}

export function TrailDashboardHero({
  username,
  level,
  cityTierLabel,
  xpNext,
  totalXp,
  pct,
  coins,
  streak,
}: TrailDashboardHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-2xl border border-border/60 bg-card ring-1 ring-foreground/5"
    >
      <TrailScene />
      <div className="space-y-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Level {level} &middot; {cityTierLabel}
        </p>
        <h1 className={`${fraunces.className} text-2xl leading-snug text-foreground sm:text-3xl`}>
          Welcome back, {username ?? 'Adventurer'}.
        </h1>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary" className="gap-1">
            <Coins className="size-3.5 text-yellow-600 dark:text-yellow-400" />
            {coins} coins
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Flame className="size-3.5 text-orange-600 dark:text-orange-400" />
            {streak} {streak === 1 ? 'day' : 'days'} streak
          </Badge>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <XpRing pct={pct} level={level} size={56} />
          <p className="text-xs text-muted-foreground">
            {Math.max(0, xpNext - totalXp)} XP to Level {level + 1}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

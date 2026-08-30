'use client'

import { useTheme } from '@/components/providers/theme-provider'
import { DashboardHero } from './DashboardHero'
import { TrailDashboardHero } from './TrailDashboardHero'

interface ThemedDashboardHeroProps {
  username: string | null
  level: number
  cityTierLabel: string
  xpNext: number
  totalXp: number
  pct: number
  coins: number
  streak: number
}

/**
 * Picks the illustrated Trail hero when that theme is active, otherwise the
 * existing plain hero. DashboardHero itself is left untouched so White,
 * System, and Dark carry zero risk from this.
 */
export function ThemedDashboardHero(props: ThemedDashboardHeroProps) {
  const { theme } = useTheme()
  if (theme === 'trail') return <TrailDashboardHero {...props} />
  return <DashboardHero {...props} />
}

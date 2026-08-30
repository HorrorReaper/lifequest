'use client'

import { useTheme } from '@/components/providers/theme-provider'
import type { AvatarSlot } from '@/lib/avatar'
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
  equippedItems: Record<AvatarSlot, string | null>
}

/**
 * Picks the illustrated Trail hero when that theme is active, otherwise the
 * existing plain hero. DashboardHero itself is left untouched so White,
 * System, and Dark carry zero risk from this.
 *
 * Props are passed explicitly rather than spread: the two heroes genuinely
 * differ now. Trail dropped the level/tier line and gained the avatar head,
 * so a spread would quietly hand each one props it has no use for.
 */
export function ThemedDashboardHero({
  username,
  level,
  cityTierLabel,
  xpNext,
  totalXp,
  pct,
  coins,
  streak,
  equippedItems,
}: ThemedDashboardHeroProps) {
  const { theme } = useTheme()

  if (theme === 'trail') {
    return (
      <TrailDashboardHero
        username={username}
        level={level}
        xpNext={xpNext}
        totalXp={totalXp}
        pct={pct}
        coins={coins}
        streak={streak}
        equippedItems={equippedItems}
      />
    )
  }

  return (
    <DashboardHero
      username={username}
      level={level}
      cityTierLabel={cityTierLabel}
      xpNext={xpNext}
      totalXp={totalXp}
      pct={pct}
      coins={coins}
      streak={streak}
    />
  )
}

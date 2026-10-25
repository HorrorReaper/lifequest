'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Library, NotebookPen } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useUserStore } from '@/lib/stores/user-store'
import { createClient } from '@/lib/supabase/client'
import { getLevel } from '@/lib/gamification'
import type { AvatarSlot } from '@/lib/avatar'
import { AvatarHead } from '@/components/profile/AvatarFigure'
import { QuickActionButton } from '@/components/layout/quick-action-button'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  /** Omitted for the avatar tab, which draws the player's own head instead. */
  icon?: typeof Home
  /** Other routes reached from this tab, which keep it highlighted. */
  alsoActiveOn?: readonly string[]
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/journal', label: 'Journal', icon: NotebookPen },
  // { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { href: '/learn', label: 'Library', icon: Library },
  // City itself is retired as a reachable feature; this slot is its
  // replacement rather than a new one. See
  // docs/superpowers/specs/2026-08-30-avatar-nature-redesign-design.md.
  // Settings has no tab of its own: it opens from the button on /profile.
  { href: '/profile', label: 'Profile', alsoActiveOn: ['/settings'] },
]

const LEFT_NAV_ITEMS = NAV_ITEMS.slice(0, 2)
const RIGHT_NAV_ITEMS = NAV_ITEMS.slice(2)

interface BottomNavProps {
  isAdmin?: boolean
  /** What the avatar tab's head is wearing. */
  equippedItems: Record<AvatarSlot, string | null>
}

export function BottomNav({ isAdmin = false, equippedItems }: BottomNavProps) {
  const pathname = usePathname()
  const totalXp = useUserStore((s) => s.totalXp)
  const setProfile = useUserStore((s) => s.setProfile)
  const setCoins = useUserStore((s) => s.setCoins)
  const notifyLevelUp = useUserStore((s) => s.notifyLevelUp)
  const totalXpRef = useRef(totalXp)

  useEffect(() => {
    totalXpRef.current = totalXp
  }, [totalXp])

  useEffect(() => {
    // Fetch authoritative values from Supabase
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()
        const user = userData.user
        if (!user) return

        const { data: cityRowData } = await supabase
          .from('city_states')
          .select('coins')
          .eq('user_id', user.id)
          .single()

        const cityRow = cityRowData as unknown as { coins: number } | null

        if (cityRow && typeof cityRow.coins === 'number') {
          setCoins(cityRow.coins)
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('total_xp')
          .eq('id', user.id)
          .single()

        const profile = profileData as unknown as { total_xp: number } | null

        if (profile && typeof profile.total_xp === 'number') {
          const previousTotalXp = totalXpRef.current
          const previousLevel = getLevel(previousTotalXp)
          const profileLevel = getLevel(profile.total_xp)

          if (previousTotalXp > 0 && profileLevel > previousLevel) {
            notifyLevelUp(profileLevel)
          }

          setProfile({ totalXp: profile.total_xp })
        }
      } catch {
        // ignore fetch errors; keep the current in-memory values
      }
    })()
  }, [notifyLevelUp, setCoins, setProfile])

  function renderNavItem(item: NavItem) {
    const isActive = [item.href, ...(item.alsoActiveOn ?? [])].some(
      (href) => pathname === href || pathname.startsWith(href + '/')
    )
    const Icon = item.icon

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] transition-colors sm:min-h-10 sm:text-xs',
          isActive
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {Icon ? (
          <Icon className="size-5.5" />
        ) : (
          // A ring, not a colour change, marks the active tab: the head keeps
          // its own colours, so text-primary would not reach it.
          <span
            className={cn(
              'flex size-5.5 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 transition-colors',
              isActive ? 'ring-primary' : 'ring-transparent'
            )}
          >
            <AvatarHead equippedItems={equippedItems} className="size-full" />
          </span>
        )}
        <span className="max-w-full truncate">{item.label}</span>
      </Link>
    )
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="relative mx-auto max-w-2xl px-2 pb-[calc(0.5rem+var(--safe-area-bottom))] pt-3">
        <div className="grid grid-cols-[1fr_4.5rem_1fr] items-end gap-1">
          <div className="grid grid-cols-2 items-end gap-1">
            {LEFT_NAV_ITEMS.map(renderNavItem)}
          </div>
          <QuickActionButton isAdmin={isAdmin} />
          <div className="grid grid-cols-2 items-end gap-1">
            {RIGHT_NAV_ITEMS.map(renderNavItem)}
          </div>
        </div>
      </div>
    </nav>
  )
}

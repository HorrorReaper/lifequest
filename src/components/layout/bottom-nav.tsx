'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, NotebookPen, Trophy, Building2, BookOpen, Settings } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useUserStore } from '@/lib/stores/user-store'
import { createClient } from '@/lib/supabase/client'
import { getLevel } from '@/lib/gamification'
import { QuickActionButton } from '@/components/layout/quick-action-button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/journal', label: 'Journal', icon: NotebookPen },
  { href: '/quests', label: 'Quests', icon: Trophy },
  { href: '/learn', label: 'Learn', icon: BookOpen },
  // { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { href: '/city', label: 'City', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const LEFT_NAV_ITEMS = NAV_ITEMS.slice(0, 3)
const RIGHT_NAV_ITEMS = NAV_ITEMS.slice(3)

export function BottomNav() {
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

  function renderNavItem(item: (typeof NAV_ITEMS)[number]) {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + '/')
    const Icon = item.icon

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] transition-colors sm:text-xs',
          isActive
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className="size-5" />
        <span className="max-w-full truncate">{item.label}</span>
      </Link>
    )
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="relative mx-auto max-w-2xl px-2 pb-[calc(0.5rem+var(--safe-area-bottom))] pt-3">
        <div className="grid grid-cols-[1fr_4.5rem_1fr] items-end gap-1">
          <div className="grid grid-cols-3 items-end gap-1">
            {LEFT_NAV_ITEMS.map(renderNavItem)}
          </div>
          <QuickActionButton />
          <div className="grid grid-cols-3 items-end gap-1">
            {RIGHT_NAV_ITEMS.map(renderNavItem)}
          </div>
        </div>
      </div>
    </nav>
  )
}

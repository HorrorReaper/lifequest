'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Coins, Home, NotebookPen, LayoutTemplate, Building2, Settings } from "lucide-react";
import { useEffect, useState } from 'react'
import { useUserStore } from '@/lib/stores/user-store'
import { loadCityState } from '@/lib/city'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/journal', label: 'Journal', icon: NotebookPen },
  { href: '/journal/templates', label: 'Templates', icon: LayoutTemplate },
  // { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { href: '/city', label: 'City', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  const level = useUserStore((s) => s.level)
  const setProfile = useUserStore((s) => s.setProfile)
  const [coins, setCoins] = useState(0)

  useEffect(() => {

    // Start with local cached coins/xp for instant UI
    setCoins(loadCityState().coins ?? 0)
    setProfile({ totalXp: loadCityState().xp ?? 0 })

    // Attempt to fetch authoritative coins from the server for the logged-in user
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: userData } = await supabase.auth.getUser()
        const user = (userData as any)?.user
        if (!user) return

        const { data: cityRowData } = await supabase
          .from('city_states')
          .select('coins')
          .eq('user_id', user.id)
          .single()

        const cityRow = cityRowData as any

        if (cityRow && typeof cityRow.coins === 'number') {
          setCoins(cityRow.coins)
          // keep local cache in sync
          try {
            const cached = loadCityState()
            if (cached.coins !== cityRow.coins) {
              cached.coins = cityRow.coins
              localStorage.setItem('city-state', JSON.stringify(cached))
            }
          } catch {}
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('total_xp')
          .eq('id', user.id)
          .single()

        const profile = profileData as any

        if (profile && typeof profile.total_xp === 'number') {
          setProfile({ totalXp: profile.total_xp })
          // keep local cache in sync
          try {
            const cached = loadCityState()
            if (cached.xp !== profile.total_xp) {
              cached.xp = profile.total_xp
              localStorage.setItem('city-state', JSON.stringify(cached))
            }
          } catch {}
        }
      } catch (e) {
        // ignore fetch errors; continue using cached coins
      }
    })()

    // Update when other tabs write to localStorage
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === undefined) return
      if (e.key === 'city-state') {
        const updated = loadCityState()
        setCoins(updated.coins ?? 0)
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-2 py-2">
        <div className="flex items-center gap-3 px-2">
          <span className="text-sm text-muted-foreground flex gap-1"><Coins className="h-4 w-4 text-yellow-500" /> {coins}</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
          })}
        </div>

        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
              {level}
            </div>
      </div>
    </nav>
  )
}

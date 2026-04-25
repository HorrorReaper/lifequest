'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3 } from "lucide-react";

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/journal', label: 'Journal', icon: '📝' },
  { href: '/journal/templates', label: 'Templates', icon: '🧱' },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { href: '/city', label: 'City', icon: '🏙️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon as any;

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
              <span className="text-lg">
                {typeof Icon === 'string' ? (
                  Icon
                ) : (
                  <Icon />
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

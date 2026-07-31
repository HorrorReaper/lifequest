'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, Flame, ListChecks, X } from 'lucide-react'

// Set once the card is dismissed so a bookmarked or re-shared ?welcome=1 URL
// does not keep resurfacing it for a returning user.
const DISMISS_KEY = 'lifequest-first-run-welcome-dismissed'

function subscribeToDismissal(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

function readDismissed() {
  return window.localStorage.getItem(DISMISS_KEY) === '1'
}

// Server and the pre-hydration client paint agree on "dismissed" so the card
// never flashes in and out; useSyncExternalStore reconciles the real value
// right after mount without a setState-in-effect render cascade.
function readDismissedOnServer() {
  return true
}

const POINTS = [
  {
    icon: ListChecks,
    title: 'Tasks & habits',
    description: 'Add the ones worth repeating from the briefing below.',
  },
  {
    icon: Flame,
    title: 'Streaks',
    description: 'Journaling again tomorrow keeps yours alive.',
  },
  {
    icon: Building2,
    title: 'Your city',
    description: "Open City to spend today's XP and coins.",
  },
]

export function FirstRunWelcome({ show }: { show: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    readDismissed,
    readDismissedOnServer
  )

  useEffect(() => {
    if (!show) return
    // The query param did its job getting us here; drop it so refreshing or
    // sharing this URL later doesn't replay the welcome card.
    router.replace(pathname)
  }, [show, pathname, router])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, '1')
    // localStorage's native "storage" event only fires in other tabs; dispatch
    // one manually so this tab's useSyncExternalStore re-reads immediately.
    window.dispatchEvent(new Event('storage'))
  }

  if (!show || dismissed) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome"
        className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <p className="pr-8 text-sm font-semibold">
        This is your dashboard. Here&apos;s what the rest of LifeQuest is for.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex items-start gap-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

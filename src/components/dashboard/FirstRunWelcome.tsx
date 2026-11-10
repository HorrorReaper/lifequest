'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Flame, NotebookPen, X } from 'lucide-react'

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

// What comes after the first planned task, each with the place to do it.
// Reflection is offered here, after the productive first step, and stays
// optional -- onboarding no longer asks anyone to pick a journal first.
const POINTS = [
  {
    icon: Flame,
    title: 'Add a daily habit',
    description: 'One small action to check off each day.',
    href: '/habits?new=1',
  },
  {
    icon: NotebookPen,
    title: 'Reflect, if you like',
    description: 'A short check-in at the end of the day. Optional.',
    href: '/journal',
  },
]

export function FirstRunWelcome({ show: requested }: { show: boolean }) {
  // Latched on mount. Dropping ?welcome=1 below re-renders the page with
  // show=false, and reading the prop directly made the card vanish about a
  // second after it appeared -- before anyone could read its next steps.
  const [show] = useState(requested)
  const router = useRouter()
  const pathname = usePathname()
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    readDismissed,
    readDismissedOnServer
  )

  useEffect(() => {
    if (!requested) return
    // The query param did its job getting us here; drop it so refreshing or
    // sharing this URL later doesn't replay the welcome card.
    router.replace(pathname)
  }, [requested, pathname, router])


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
        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"

      >
        <X className="size-4" />
      </button>

      <p className="pr-8 text-base font-semibold">
        Your first task is saved and planned for today.
      </p>
      <p className="mt-1 pr-8 text-sm text-muted-foreground">
        It is shown under Next up and in Today&apos;s Plan below. Check it off
        when it is done. When you are ready:
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {POINTS.map(({ icon: Icon, title, description, href }) => (
          <Link
            key={title}
            href={href}
            className="flex min-h-12 items-start gap-2 rounded-xl border bg-background/70 p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

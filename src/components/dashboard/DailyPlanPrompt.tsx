'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CalendarClock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DailyPlanPromptProps {
  /** The user's local date key (YYYY-MM-DD), so the dismissal resets every day. */
  today: string
  planCommitted: boolean
  /** Matches the DashboardHero fallback so the greeting reads the same across the page. */
  username: string | null
}

function dismissKey(today: string) {
  return `lifequest-plan-prompt-dismissed-${today}`
}

function subscribeToDismissal(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

// Server and the pre-hydration client paint agree the prompt is dismissed so
// it never flashes open before hydration; see auth-loading-overlay.tsx for
// the same reasoning applied to a different widget.
function readDismissedOnServer() {
  return true
}

export function DailyPlanPrompt({ today, planCommitted, username }: DailyPlanPromptProps) {
  const reduceMotion = useReducedMotion()
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    () => window.localStorage.getItem(dismissKey(today)) === '1',
    readDismissedOnServer
  )

  function dismiss() {
    window.localStorage.setItem(dismissKey(today), '1')
    // localStorage's native "storage" event only fires in other tabs; dispatch
    // one manually so this tab's useSyncExternalStore re-reads immediately.
    window.dispatchEvent(new Event('storage'))
  }

  const open = !planCommitted && !dismissed

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <motion.span
            className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, 1.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CalendarClock className="size-6" />
          </motion.span>
          <motion.div
            className="space-y-2"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <DialogTitle>Welcome back, {username ?? 'Adventurer'} 👋</DialogTitle>
            <DialogDescription>
              Want to start with your daily briefing? A few minutes now to set your Top
              Three makes the rest of the day easier to navigate.
            </DialogDescription>
          </motion.div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Not now
          </Button>
          <Button asChild onClick={dismiss}>
            <Link href="/plan">Start briefing</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

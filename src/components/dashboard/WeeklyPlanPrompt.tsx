'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CalendarRange } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePromptDismissal } from '@/components/dashboard/prompt-dismissal'
import {
  WEEKLY_PLAN_TEMPLATE_ID,
  weeklyPlanDismissKey,
} from '@/lib/weekly-rituals'

interface WeeklyPlanPromptProps {
  /** The Monday of the current week (YYYY-MM-DD), so the dismissal resets weekly. */
  weekStart: string
  /** Whether it is Monday in the user's own timezone. */
  isWindow: boolean
  /** Whether a Weekly Plan entry already exists for this week. */
  planDone: boolean
  /** Matches the DashboardHero fallback so the greeting reads the same across the page. */
  username: string | null
  openTaskCount: number
}

/**
 * The weekly counterpart of DailyPlanPrompt: on Monday, set the week's theme
 * and top outcomes before the days start deciding for you. Writes into a
 * journal template rather than its own planner, so it stays a few minutes.
 */
export function WeeklyPlanPrompt({
  weekStart,
  isWindow,
  planDone,
  username,
  openTaskCount,
}: WeeklyPlanPromptProps) {
  const reduceMotion = useReducedMotion()
  const { dismissed, dismiss } = usePromptDismissal(weeklyPlanDismissKey(weekStart))

  const open = isWindow && !planDone && !dismissed

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="overflow-hidden border-2 border-primary/20 shadow-2xl sm:max-w-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-linear-to-br from-primary/30 to-purple-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-linear-to-tr from-purple-500/20 to-primary/20 blur-3xl" />
        <DialogHeader className="relative">
          <motion.span
            className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-500 text-primary-foreground"
            animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, 1.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CalendarRange className="size-7" />
          </motion.span>
          <motion.div
            className="space-y-2"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <DialogTitle className="text-2xl font-bold tracking-tight">
              New week, {username ?? 'Adventurer'} 🗓️
            </DialogTitle>
            <DialogDescription>
              Give the week a theme and three outcomes before the days start
              deciding for you. Each morning&apos;s briefing gets easier with them set.
            </DialogDescription>
          </motion.div>
        </DialogHeader>
        <div className="relative rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          {openTaskCount} open {openTaskCount === 1 ? 'task' : 'tasks'}
        </div>
        <DialogFooter className="relative">
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          <Button asChild onClick={dismiss} className="group">
            <Link href={`/journal/new/${WEEKLY_PLAN_TEMPLATE_ID}`}>
              Plan the week
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { CalendarCheck } from 'lucide-react'
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
  WEEKLY_REVIEW_TEMPLATE_ID,
  weeklyReviewDismissKey,
} from '@/lib/weekly-rituals'

interface WeeklyReviewPromptProps {
  /** The Monday of the current week (YYYY-MM-DD), so the dismissal resets weekly. */
  weekStart: string
  /** Whether it is Sunday at or past 6pm in the user's own timezone. */
  isWindow: boolean
  /** Whether a Weekly Review entry already exists for this week. */
  reviewDone: boolean
  /** Matches the DashboardHero fallback so the greeting reads the same across the page. */
  username: string | null
  habitsCompletedThisWeek: number
  tasksCompletedThisWeek: number
}

/**
 * The weekly counterpart of EveningReviewPrompt: Sunday evening, close the
 * week the way the evening prompt closes the day. Same dialog, same
 * dismissal, one week wide instead of one day.
 */
export function WeeklyReviewPrompt({
  weekStart,
  isWindow,
  reviewDone,
  username,
  habitsCompletedThisWeek,
  tasksCompletedThisWeek,
}: WeeklyReviewPromptProps) {
  const reduceMotion = useReducedMotion()
  const { dismissed, dismiss } = usePromptDismissal(weeklyReviewDismissKey(weekStart))

  const open = isWindow && !reviewDone && !dismissed

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <motion.span
            className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, -1.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CalendarCheck className="size-6" />
          </motion.span>
          <motion.div
            className="space-y-2"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <DialogTitle>How was your week, {username ?? 'Adventurer'}?</DialogTitle>
            <DialogDescription>
              Step back before the next one starts. A few minutes on what worked,
              what did not, and what you want to change.
            </DialogDescription>
          </motion.div>
        </DialogHeader>
        <div className="flex gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          <span>{habitsCompletedThisWeek} habit check-ins</span>
          <span aria-hidden>·</span>
          <span>{tasksCompletedThisWeek} tasks completed</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Not now
          </Button>
          <Button asChild onClick={dismiss}>
            <Link href={`/journal/new/${WEEKLY_REVIEW_TEMPLATE_ID}`}>Start weekly review</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

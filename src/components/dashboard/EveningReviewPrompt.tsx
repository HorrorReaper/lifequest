'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Moon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePromptDismissal, usePromptHeldBack } from '@/components/dashboard/prompt-dismissal'

interface EveningReviewPromptProps {
  /** The user's local date key (YYYY-MM-DD), so the dismissal resets every day. */
  today: string
  /** Whether it is currently at or past 8pm in the user's own timezone. */
  isEvening: boolean
  /** Whether an Evening Review journal entry already exists for today. */
  reviewDone: boolean
  /** The Evening Review system template's id, or null if it could not be found. */
  templateId: string | null
  /** Matches the DashboardHero fallback so the greeting reads the same across the page. */
  username: string | null
  habitsCompleted: number
  habitsTotal: number
  tasksCompletedToday: number
  /**
   * The dismissal key of a weekly prompt that takes precedence today, or
   * null. See usePromptHeldBack.
   */
  heldBackBy?: string | null
}

/**
 * Exported so the admin testing tools can clear dismissals without repeating
 * the string. The date suffix makes the key self-expiring: a new day means a
 * new key, so nothing has to be cleaned up.
 */
export const EVENING_REVIEW_DISMISS_PREFIX = 'lifequest-evening-review-dismissed-'

function dismissKey(today: string) {
  return `${EVENING_REVIEW_DISMISS_PREFIX}${today}`
}

export function EveningReviewPrompt({
  today,
  isEvening,
  reviewDone,
  templateId,
  username,
  habitsCompleted,
  habitsTotal,
  tasksCompletedToday,
  heldBackBy = null,
}: EveningReviewPromptProps) {
  const reduceMotion = useReducedMotion()
  const { dismissed, dismiss } = usePromptDismissal(dismissKey(today))

  const heldBack = usePromptHeldBack(heldBackBy)

  const open = isEvening && !reviewDone && !dismissed && !heldBack && templateId !== null

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <motion.span
            className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, -1.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Moon className="size-6" />
          </motion.span>
          <motion.div
            className="space-y-2"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <DialogTitle>How was your day, {username ?? 'Adventurer'}?</DialogTitle>
            <DialogDescription>
              Close the loop before you switch off. A couple of minutes to reflect on
              today and set tomorrow&apos;s focus.
            </DialogDescription>
          </motion.div>
        </DialogHeader>
        <div className="flex gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          <span>
            {habitsCompleted}/{habitsTotal} habits
          </span>
          <span aria-hidden>·</span>
          <span>{tasksCompletedToday} tasks completed</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Not now
          </Button>
          <Button asChild onClick={dismiss}>
            <Link href={`/journal/new/${templateId}`}>Start evening review</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

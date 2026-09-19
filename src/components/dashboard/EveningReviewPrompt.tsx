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
import {
  usePromptDismissal,
  usePromptHeldBack,
  type PromptCopy,
} from '@/components/dashboard/prompt-dismissal'
import { ritualDismissKey } from '@/lib/rituals'

interface EveningReviewPromptProps {
  /** The user's local date key (YYYY-MM-DD), so the dismissal resets every day. */
  today: string
  /** Whether the ritual's window is open right now (see isRitualWindow). */
  isEvening: boolean
  /** Whether an entry of the target template already exists for today. */
  reviewDone: boolean
  /** Where the call to action leads, or null when the ritual has no target -- then the prompt stays closed. */
  href: string | null
  copy: PromptCopy
  habitsCompleted: number
  habitsTotal: number
  tasksCompletedToday: number
  /**
   * The dismissal key of a weekly prompt that takes precedence today, or
   * null. See usePromptHeldBack.
   */
  heldBackBy?: string | null
  /**
   * When set, the dialog is a preview: it opens regardless of window, entry
   * and dismissal, and closing calls this instead of remembering a
   * dismissal. Used by the admin rituals hub to show what the prompt will
   * look like; nothing on the dashboard passes it.
   */
  onPreviewClose?: () => void
}

export function EveningReviewPrompt({
  today,
  isEvening,
  reviewDone,
  href,
  copy,
  habitsCompleted,
  habitsTotal,
  tasksCompletedToday,
  heldBackBy = null,
  onPreviewClose,
}: EveningReviewPromptProps) {
  const reduceMotion = useReducedMotion()
  const { dismissed, dismiss } = usePromptDismissal(ritualDismissKey('evening_review', today))
  const heldBack = usePromptHeldBack(heldBackBy)

  // Preview mode is "an admin is looking at this", so it must not touch the
  // dismissal the real prompt reads -- closing here calls the handler
  // instead, and the call to action goes nowhere.
  const preview = onPreviewClose !== undefined
  function close() {
    if (onPreviewClose) onPreviewClose()
    else dismiss()
  }

  const open = preview || (isEvening && !reviewDone && !dismissed && !heldBack && href !== null)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
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
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
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
          <Button variant="outline" onClick={close}>
            Not now
          </Button>
          <Button asChild onClick={close}>
            <Link href={href ?? '#'} onClick={(event) => { if (preview) event.preventDefault() }}>{copy.ctaLabel}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

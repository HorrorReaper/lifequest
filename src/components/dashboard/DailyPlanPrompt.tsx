'use client'

import Link from 'next/link'
import { ArrowRight, CalendarClock } from 'lucide-react'
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

interface DailyPlanPromptProps {
  /** The user's local date key (YYYY-MM-DD), so the dismissal resets every day. */
  today: string
  planCommitted: boolean
  copy: PromptCopy
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

export function DailyPlanPrompt({
  today,
  planCommitted,
  copy,
  heldBackBy = null,
  onPreviewClose,
}: DailyPlanPromptProps) {
  const { dismissed, dismiss } = usePromptDismissal(ritualDismissKey('daily_plan', today))
  const heldBack = usePromptHeldBack(heldBackBy)

  // Preview mode is "an admin is looking at this", so it must not touch the
  // dismissal the real prompt reads -- closing here calls the handler
  // instead, and the call to action goes nowhere.
  const preview = onPreviewClose !== undefined
  function close() {
    if (onPreviewClose) onPreviewClose()
    else dismiss()
  }

  const open = preview || (!planCommitted && !dismissed && !heldBack)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="overflow-hidden border-2 border-primary/20 shadow-2xl sm:max-w-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-linear-to-br from-primary/30 to-purple-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-linear-to-tr from-purple-500/20 to-primary/20 blur-3xl" />
        <DialogHeader className="relative">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-500 text-primary-foreground">
            <CalendarClock className="size-7" />
          </span>
          <div className="space-y-2">
            <DialogTitle className="text-2xl font-bold tracking-tight">{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="relative">
          <Button variant="ghost" onClick={close}>
            Not now
          </Button>
          <Button asChild onClick={close} className="group">
            <Link href="/plan" onClick={(event) => { if (preview) event.preventDefault() }}>
              {copy.ctaLabel}
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

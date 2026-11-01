'use client'

import { Button } from '@/components/ui/button'

interface MetricCreatedHintProps {
  onSetTarget: () => void
  onAskInJournal: () => void
  onDismiss: () => void
}

/**
 * Shown once on a metric's page right after it was created: the two things
 * worth setting up next, each opening the settings at the right section.
 */
export function MetricCreatedHint({
  onSetTarget,
  onAskInJournal,
  onDismiss,
}: MetricCreatedHintProps) {
  return (
    <section className="space-y-3 rounded-2xl border bg-primary/5 p-4">
      <div className="space-y-1">
        <p className="font-semibold">Almost there.</p>
        <p className="text-sm text-muted-foreground">
          Want the app to tell you when you&apos;re on track, or ask for this number in your
          journal?
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onSetTarget}>
          Set a target
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAskInJournal}>
          Ask in journal
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          Later
        </Button>
      </div>
    </section>
  )
}

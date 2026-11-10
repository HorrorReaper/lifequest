'use client'

import { BookOpenCheck, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface JournalNavigationProps {
  activeStep: number
  stepCount: number
  submitting: boolean
  onBack: () => void
  onNext: () => void
}

export function JournalNavigation({
  activeStep,
  stepCount,
  submitting,
  onBack,
  onNext,
}: JournalNavigationProps) {
  const isFinalStep = activeStep >= Math.max(stepCount - 1, 0)

  return (
    <div className="flex gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        className="min-h-14 flex-1 rounded-xl"
        disabled={activeStep === 0 || submitting}
      >
        <ChevronLeft className="size-5" />
        Back
      </Button>
      {/* Separate keys, so these are two elements, never one <button> whose
          type flips. With one, tapping Next on the second-to-last step
          re-rendered it as type="submit" before the browser ran the tap's
          default action, and that same tap saved the entry instead of
          showing the last step. */}
      {isFinalStep ? (
        <Button
          key="save"
          type="submit"
          className="min-h-14 flex-[1.35] rounded-xl"
          disabled={submitting}
        >
          <BookOpenCheck className="size-5" />
          {submitting ? 'Saving...' : 'Save Reflection'}
        </Button>
      ) : (
        <Button
          key="next"
          type="button"
          onClick={onNext}
          className="min-h-14 flex-[1.35] rounded-xl"
          disabled={submitting}
        >
          Next
          <ChevronRight className="size-5" />
        </Button>
      )}
    </div>
  )
}

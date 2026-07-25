'use client'

import { BookOpenCheck, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface MobileJournalNavigationProps {
  activeStep: number
  stepCount: number
  submitting: boolean
  onBack: () => void
  onNext: () => void
}

export function MobileJournalNavigation({
  activeStep,
  stepCount,
  submitting,
  onBack,
  onNext,
}: MobileJournalNavigationProps) {
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
      {isFinalStep ? (
        <Button
          type="submit"
          className="min-h-14 flex-[1.35] rounded-xl"
          disabled={submitting}
        >
          <BookOpenCheck className="size-5" />
          {submitting ? 'Saving...' : 'Save Reflection'}
        </Button>
      ) : (
        <Button
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

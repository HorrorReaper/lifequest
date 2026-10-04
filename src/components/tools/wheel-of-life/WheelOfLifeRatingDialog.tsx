'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LifeAreaGuide } from './LifeAreaGuide'
import { LIFE_AREAS, MAX_RATING, type LifeAreaId, type WheelOfLifePayload } from './wheel-of-life'

const RATINGS = Array.from({ length: MAX_RATING }, (_, index) => index + 1)

interface WheelOfLifeRatingDialogProps {
  open: boolean
  /** Where the ratings start: the last snapshot, or the middle of the scale. */
  initialRatings: Record<LifeAreaId, number>
  busy?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (value: WheelOfLifePayload) => void | Promise<void>
}

/** Rating all five areas, in a dialog so the tool page keeps showing the overview. */
export function WheelOfLifeRatingDialog({
  open,
  initialRatings,
  busy = false,
  error,
  onOpenChange,
  onSubmit,
}: WheelOfLifeRatingDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="bottom-0 left-0 top-auto h-[min(48rem,calc(100svh-var(--safe-area-bottom)))] max-h-none max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-b-none rounded-t-3xl p-5 pb-[calc(1.25rem+var(--safe-area-bottom))] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90svh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">Rate your life areas</DialogTitle>
          <DialogDescription>
            Rate each area as it is today, not as it should be. 1 is “this is hurting”, 10 is “nothing to change”.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <RatingForm
            initialRatings={initialRatings}
            busy={busy}
            error={error}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RatingForm({
  initialRatings,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  initialRatings: Record<LifeAreaId, number>
  busy: boolean
  error?: string | null
  onCancel: () => void
  onSubmit: (value: WheelOfLifePayload) => void | Promise<void>
}) {
  const [ratings, setRatings] = useState(initialRatings)
  const [note, setNote] = useState('')

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({ ratings, note: note.trim() })
      }}
    >
      {LIFE_AREAS.map((area) => (
        <fieldset key={area.id} className="space-y-2">
          <legend className="text-sm font-semibold">
            {area.label} <span className="font-normal text-muted-foreground">· {area.hint}</span>
          </legend>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${area.label} rating`}>
            {RATINGS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={ratings[area.id] === value}
                aria-label={`${area.label}: ${value}`}
                onClick={() => setRatings((current) => ({ ...current, [area.id]: value }))}
                disabled={busy}
                className={cn(
                  'grid size-9 place-items-center rounded-lg border text-sm transition-colors',
                  ratings[area.id] === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <LifeAreaGuide area={area} />
        </fieldset>
      ))}

      <div className="space-y-2">
        <label htmlFor="wheel-note" className="text-sm font-semibold">
          What stands out? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="wheel-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          disabled={busy}
          placeholder="The area that would change the most if it moved one point..."
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter className="sticky bottom-0 mt-auto bg-popover">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? 'Saving…' : 'Save ratings'}
        </Button>
      </DialogFooter>
    </form>
  )
}

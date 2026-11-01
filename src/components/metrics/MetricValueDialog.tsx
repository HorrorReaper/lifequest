'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  deleteMetricValue,
  formatMetricDay,
  stepFor,
  updateMetricValue,
  type Metric,
  type MetricValue,
} from '@/lib/metrics'
import { parseDecimal } from '@/lib/decimal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MetricStepper } from '@/components/metrics/MetricStepper'

interface MetricValueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metric: Pick<Metric, 'id' | 'name' | 'unit'>
  /** The past value being corrected or removed. */
  value: MetricValue
}

/**
 * Corrects or deletes one past value from the history. The day is fixed (a
 * value can be changed, not moved or added), and only the number is written:
 * the journal entry a value came from is never touched, and an edited value
 * keeps pointing at it.
 */
export function MetricValueDialog({ open, onOpenChange, metric, value }: MetricValueDialogProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const [draft, setDraft] = useState(() => String(value.value))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  // Blocks a second submit in the same frame, before `busy` re-renders.
  const busyRef = useRef(false)

  // Every opening starts from the stored value again, dropping what an
  // earlier, dismissed opening left behind.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(String(value.value))
      setConfirmingDelete(false)
      setError(null)
    }
  }

  const parsed = parseDecimal(draft)

  /** Runs one write, then refreshes and closes; a failure keeps the dialog open with `failure`. */
  async function run(write: () => Promise<void>, failure: string) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await write()
      router.refresh()
      onOpenChange(false)
    } catch {
      setError(failure)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (parsed === null) return
    void run(
      () => updateMetricValue(supabase, metric.id, value.date, parsed),
      'Could not save this value. Please try again.'
    )
  }

  function handleDelete() {
    void run(
      () => deleteMetricValue(supabase, metric.id, value.date),
      'Could not delete this value. Please try again.'
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">{formatMetricDay(value.date)}</DialogTitle>
          <DialogDescription>
            {metric.name} · <span>{value.sourceLabel ?? 'Entered'}</span>
          </DialogDescription>
        </DialogHeader>

        {confirmingDelete ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="font-medium">Delete this value?</p>
              {value.sourceLabel && (
                <p className="text-muted-foreground">
                  The journal entry stays as it is; only the number is removed from {metric.name}.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setConfirmingDelete(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={handleDelete}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <MetricStepper
              value={draft}
              onChange={setDraft}
              step={stepFor(value.value)}
              unit={metric.unit}
              label={metric.name}
              disabled={busy}
            />

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={busy || parsed === null} className="w-full">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? 'Saving…' : 'Save'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
              className="w-full text-destructive hover:text-destructive"
            >
              Delete value
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  METRIC_NAME_MAX,
  METRIC_UNIT_MAX,
  createMetric,
  validateMetricInput,
} from '@/lib/metrics'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MetricCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

/**
 * Creates a metric from a name and an optional unit, then opens its page,
 * where targets and journal links are offered once there is something to
 * attach them to.
 */
export function MetricCreateDialog({ open, onOpenChange, userId }: MetricCreateDialogProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  // Blocks a second submit in the same frame, before `busy` re-renders.
  const submittingRef = useRef(false)

  // Every opening starts with an empty form.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName('')
      setUnit('')
      setError(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || busy || submittingRef.current) return

    const invalid = validateMetricInput({ name, unit })
    if (invalid) {
      setError(invalid)
      return
    }

    submittingRef.current = true
    setBusy(true)
    setError(null)
    try {
      const metric = await createMetric(supabase, userId, { name, unit })
      router.push(`/journal/metrics/${metric.id}?created=1`)
      onOpenChange(false)
    } catch {
      setError('Could not create this metric. Please try again.')
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
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
          <DialogTitle className="text-xl">Create a metric</DialogTitle>
          <DialogDescription>
            Track a number over time — weight, steps, sleep…
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metric-name">Name</Label>
            <Input
              id="metric-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Weight"
              maxLength={METRIC_NAME_MAX}
              autoFocus
              disabled={busy}
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metric-unit">
              Unit <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="metric-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="e.g. kg"
              maxLength={METRIC_UNIT_MAX}
              disabled={busy}
              className="h-12 text-base"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

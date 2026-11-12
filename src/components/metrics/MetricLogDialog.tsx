'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import {
  alreadyLoggedText,
  formatMetricDay,
  formatMetricValue,
  stepFor,
  type LatestValue,
  type Metric,
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
import { useLogMetricValue } from '@/components/metrics/use-log-metric-value'

interface MetricLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  metric: Pick<Metric, 'id' | 'name' | 'unit'>
  latest: LatestValue | null
  /** The user's local day, computed on the server from their time zone. */
  today: string
}

function startingValue(latest: LatestValue | null) {
  return latest ? String(latest.value) : ''
}

/**
 * Logs today's value of one metric: the stepper starts from the latest value,
 * since a number that moves a little each day is mostly "the same, plus a bit".
 *
 * A second value on the same day replaces the first (latest wins), so the
 * dialog says so when today already has one.
 */
export function MetricLogDialog({
  open,
  onOpenChange,
  userId,
  metric,
  latest,
  today,
}: MetricLogDialogProps) {
  const { log, busy, error, clearError } = useLogMetricValue(userId)

  const [value, setValue] = useState(() => startingValue(latest))
  const [wasOpen, setWasOpen] = useState(open)

  // Every opening starts from the latest value again, dropping what an
  // earlier, dismissed opening left behind.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValue(startingValue(latest))
      clearError()
    }
  }

  const parsed = parseDecimal(value)
  const loggedToday = latest?.date === today

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (parsed === null || busy) return
    const saved = await log({ metricId: metric.id, date: today, value: parsed })
    if (saved) onOpenChange(false)
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
          <DialogTitle className="text-xl">{metric.name}</DialogTitle>
          <DialogDescription>
            {latest
              ? loggedToday
                ? alreadyLoggedText(latest.value, metric.unit)
                : `Last: ${formatMetricValue(latest.value, metric.unit)} · ${formatMetricDay(latest.date)}`
              : 'Last: nothing yet'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <MetricStepper
            value={value}
            onChange={setValue}
            step={stepFor(latest?.value ?? null)}
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
            {busy ? 'Saving…' : 'Save for today'}
          </Button>
        </form>

        <Link
          href={`/journal/metrics/${metric.id}?from=home`}
          // Client navigation keeps this component mounted (on the dashboard
          // it lives in the page), so close it or it would linger open.
          onClick={() => onOpenChange(false)}
          className="justify-self-center rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Open {metric.name} ›
        </Link>
      </DialogContent>
    </Dialog>
  )
}

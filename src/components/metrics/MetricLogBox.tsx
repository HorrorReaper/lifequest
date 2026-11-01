'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { stepFor, type LatestValue, type Metric } from '@/lib/metrics'
import { parseDecimal } from '@/lib/decimal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { MetricStepper } from '@/components/metrics/MetricStepper'
import { useLogMetricValue } from '@/components/metrics/use-log-metric-value'

interface MetricLogBoxProps {
  userId: string
  metric: Pick<Metric, 'id' | 'name' | 'unit'>
  latest: LatestValue | null
  /** The user's local day, computed on the server from their time zone. */
  today: string
}

/**
 * Logs today's value on the metric page itself: the same stepper and save as
 * `MetricLogDialog`, in place on the page. Starts from the latest value; a
 * second save on the same day replaces the first, which the heading reflects.
 */
export function MetricLogBox({ userId, metric, latest, today }: MetricLogBoxProps) {
  const { log, busy, error } = useLogMetricValue(userId)
  const [value, setValue] = useState(() => (latest ? String(latest.value) : ''))

  const parsed = parseDecimal(value)
  const loggedToday = latest?.date === today

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (parsed === null || busy) return
    await log({ metricId: metric.id, date: today, value: parsed })
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-medium">
          {loggedToday ? 'Update today' : 'Log today'}
        </h2>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}

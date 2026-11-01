'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isDecimalDraft } from '@/lib/decimal'
import { formatMetricDay, formatMetricValue, type Metric } from '@/lib/metrics'

interface JournalMetricsBlockProps {
  /** The metrics this entry asks for, each with the entry date's value (null when there is none). */
  metrics: { metric: Metric; value: number | null }[]
  /** What is typed per metric id, as text: "81,6" stays "81,6" until submit parses it. */
  values: Record<string, string>
  onChange: (metricId: string, value: string) => void
  /** The day the values are saved for. */
  entryDate: string
  /** The user's local day, computed on the server from their time zone. */
  today: string
}

/**
 * The "Metrics" block at the end of a journal entry: one number input per
 * metric linked to the template. The values are written to the metric, not
 * to the entry's responses, so an empty input leaves the day's value alone.
 */
export function JournalMetricsBlock({
  metrics,
  values,
  onChange,
  entryDate,
  today,
}: JournalMetricsBlockProps) {
  if (metrics.length === 0) return null

  return (
    <section
      aria-labelledby="journal-metrics-heading"
      className="space-y-3 rounded-2xl border bg-card p-4"
    >
      <div>
        <h2 id="journal-metrics-heading" className="font-heading text-base font-medium">
          Metrics
        </h2>
        {entryDate !== today && (
          <p className="mt-1 text-xs text-muted-foreground">
            Saved for {formatMetricDay(entryDate)}
          </p>
        )}
      </div>

      {metrics.map(({ metric, value }) => (
        <div key={metric.id} className="space-y-1.5">
          <Label htmlFor={`journal-metric-${metric.id}`}>{metric.name}</Label>
          <div className="relative">
            <Input
              id={`journal-metric-${metric.id}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={values[metric.id] ?? ''}
              onChange={(event) => {
                if (isDecimalDraft(event.target.value)) onChange(metric.id, event.target.value)
              }}
              className={metric.unit ? 'pr-14' : undefined}
            />
            {metric.unit && (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                {metric.unit}
              </span>
            )}
          </div>
          {value !== null && (
            <p className="text-xs text-muted-foreground">
              {`Already logged for this day (${formatMetricValue(value, metric.unit)}). Changing it replaces it.`}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}

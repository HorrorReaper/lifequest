'use client'

import { formatMetricValue, type Metric, type MetricValue } from '@/lib/metrics'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface MetricHistoryListProps {
  metric: Pick<Metric, 'id' | 'name' | 'unit'>
  values: MetricValue[]
  /** Called with the value of the row that was pressed (opens it for editing). */
  onSelect?: (value: MetricValue) => void
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** The logged values, newest first, each with where it came from. */
export function MetricHistoryList({ metric, values, onSelect }: MetricHistoryListProps) {
  const newestFirst = [...values].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base font-medium">History</h2>
      </CardHeader>
      <CardContent>
        {newestFirst.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="-mx-2 divide-y">
            {newestFirst.map((value) => (
              <li key={value.date}>
                <button
                  type="button"
                  onClick={() => onSelect?.(value)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{formatDay(value.date)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {value.sourceLabel ?? 'Entered'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMetricValue(value.value, metric.unit)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

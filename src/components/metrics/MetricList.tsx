import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import {
  formatMetricDay,
  formatMetricValue,
  type LatestValue,
  type Metric,
} from '@/lib/metrics'

interface MetricListProps {
  metrics: Metric[]
  latest: Record<string, LatestValue>
  /** The second-newest value per metric, for the trend arrow. */
  previous: Record<string, number | null>
}

function trendArrow(latest: number, previous: number): string {
  if (latest > previous) return '↗'
  if (latest < previous) return '↘'
  return '→'
}

/** One compact row per metric: name, latest value with its day, a trend arrow and the linked journal template. */
export function MetricList({ metrics, latest, previous }: MetricListProps) {
  return (
    <ul className="space-y-2">
      {metrics.map((metric) => {
        const value = latest[metric.id]
        const before = previous[metric.id] ?? null

        return (
          <li key={metric.id}>
            <Link
              href={`/journal/metrics/${metric.id}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{metric.name}</span>
                {metric.templateName && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    📓 {metric.templateName}
                  </span>
                )}
              </span>

              {value ? (
                <span className="flex shrink-0 items-center gap-2 text-right">
                  <span>
                    <span className="block text-sm font-semibold">
                      {formatMetricValue(value.value, metric.unit)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatMetricDay(value.date)}
                    </span>
                  </span>
                  {before !== null && (
                    <span aria-hidden="true" className="text-base text-muted-foreground">
                      {trendArrow(value.value, before)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="shrink-0 text-sm text-muted-foreground">No value yet</span>
              )}

              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

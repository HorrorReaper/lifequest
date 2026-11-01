import type { ReactNode } from 'react'
import Link from 'next/link'
import { formatMetricValue, type Metric } from '@/lib/metrics'

interface MetricPageHeaderProps {
  metric: Metric
  backHref: '/dashboard' | '/journal/metrics'
  /** Where the settings control goes, at the right of the title. */
  settingsSlot?: ReactNode
}

function targetText(metric: Metric) {
  if (metric.targetValue === null || metric.targetDirection === null) return 'No target'
  const direction = metric.targetDirection === 'at_least' ? 'at least' : 'at most'
  return `${direction} ${formatMetricValue(metric.targetValue, metric.unit)}`
}

export function MetricPageHeader({ metric, backHref, settingsSlot }: MetricPageHeaderProps) {
  return (
    <header>
      <Link
        href={backHref}
        className="mb-4 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {backHref === '/dashboard' ? '‹ Home' : '‹ Metrics'}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{metric.name}</h1>
          <p className="text-sm text-muted-foreground">{targetText(metric)}</p>
        </div>
        {settingsSlot}
      </div>
    </header>
  )
}

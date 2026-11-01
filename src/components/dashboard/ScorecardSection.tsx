'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Target } from 'lucide-react'
import {
  formatMetricDay,
  formatMetricValue,
  type ScorecardRow,
} from '@/lib/metrics'
import { cn } from '@/lib/utils'
import { SectionHeadingLink } from '@/components/dashboard/ClickableSection'
import { SectionAddButton } from '@/components/dashboard/SectionAddButton'
import { MetricCreateLauncher } from '@/components/metrics/MetricCreateLauncher'
import { MetricLogDialog } from '@/components/metrics/MetricLogDialog'

interface ScorecardSectionProps {
  rows: ScorecardRow[]
  userId: string
  /** The user's local day, computed on the server from their time zone. */
  today: string
}

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100)
}

function describeRow(row: ScorecardRow) {
  if (row.targetValue === null) {
    return row.latestValue === null
      ? 'No value yet'
      : formatMetricValue(row.latestValue, row.unit)
  }

  const target =
    row.direction === 'at_most'
      ? `at most ${formatNumber(row.targetValue)}`
      : formatNumber(row.targetValue)
  const suffix = row.unit ? ` ${row.unit}` : ''

  if (row.latestValue === null) return `No value yet · ${target}${suffix}`
  return `${formatNumber(row.latestValue)} of ${target}${suffix}`
}

function ScorecardRowItem({
  row,
  userId,
  today,
}: {
  row: ScorecardRow
  userId: string
  today: string
}) {
  const [logging, setLogging] = useState(false)

  // Fill means closeness to the target in both directions. Only the
  // colour flips: for a limit, full is bad and beyond it worse.
  // A target of 0 can only be met via `at_most` (`at_least 0` is met
  // by everything), so a met zero-target draws a full bar and a
  // missed one stays empty rather than painting a destructive full
  // bar for values that overshot a limit of zero.
  const fill =
    row.targetValue === null || row.latestValue === null
      ? 0
      : row.targetValue === 0
        ? row.met
          ? 100
          : 0
        : Math.max(0, Math.min((row.latestValue / row.targetValue) * 100, 100))

  return (
    <li className="flex items-start gap-3">
      <Link
        href={`/journal/metrics/${row.metricId}?from=home`}
        className="block min-w-0 flex-1 space-y-1.5 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-base sm:text-sm">{row.name}</span>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-xs">
            {describeRow(row)}
          </span>
        </span>

        {row.targetValue !== null && (
          <span
            role="progressbar"
            aria-label={`${row.name} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fill)}
            className="block h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={cn(
                'block h-full rounded-full transition-all',
                row.latestValue === null
                  ? 'bg-transparent'
                  : row.met
                    ? 'bg-primary'
                    : 'bg-destructive'
              )}
              style={{ width: `${fill}%` }}
            />
          </span>
        )}

        {row.latestDate && (
          <span className="block text-xs text-muted-foreground">
            Last recorded {formatMetricDay(row.latestDate)}
          </span>
        )}
      </Link>

      <SectionAddButton label={`Log ${row.name}`} onClick={() => setLogging(true)} />

      <MetricLogDialog
        open={logging}
        onOpenChange={setLogging}
        userId={userId}
        metric={{ id: row.metricId, name: row.name, unit: row.unit }}
        latest={
          row.latestValue !== null && row.latestDate !== null
            ? { value: row.latestValue, date: row.latestDate }
            : null
        }
        today={today}
      />
    </li>
  )
}

/**
 * Every metric with its latest value, and a "+" to log today's.
 *
 * A row's name and value open the metric page; the "+" opens the log dialog
 * (which writes from the client and refreshes the page). A metric with a
 * target also gets a progress bar and counts towards the "N of M met" total.
 * Without metrics the section shows the create-metric empty state, so new
 * users can find the feature.
 *
 * Not a `ClickableSection`: a whole-section link cannot contain row links and
 * buttons. The heading is the link to the metrics list.
 */
export function ScorecardSection({ rows, userId, today }: ScorecardSectionProps) {
  const withTarget = rows.filter((row) => row.targetValue !== null)

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">
            <SectionHeadingLink href="/journal/metrics">Scorecard</SectionHeadingLink>
          </h2>
        </div>
        {withTarget.length > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground sm:text-xs">
            {withTarget.filter((row) => row.met).length} of {withTarget.length} met
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <MetricCreateLauncher userId={userId} initiallyOpen={false} variant="empty" />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <ScorecardRowItem key={row.metricId} row={row} userId={userId} today={today} />
          ))}
        </ul>
      )}
    </section>
  )
}

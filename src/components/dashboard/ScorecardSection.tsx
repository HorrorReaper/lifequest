import Link from 'next/link'
import { Target } from 'lucide-react'
import type { ScorecardRow } from '@/lib/metric-targets'
import { cn } from '@/lib/utils'

interface ScorecardSectionProps {
  rows: ScorecardRow[]
}

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100)
}

function describeRow(row: ScorecardRow) {
  const target =
    row.direction === 'at_most'
      ? `at most ${formatNumber(row.targetValue)}`
      : formatNumber(row.targetValue)
  const suffix = row.unit ? ` ${row.unit}` : ''

  if (row.latestValue === null) return `No value yet · ${target}${suffix}`
  return `${formatNumber(row.latestValue)} of ${target}${suffix}`
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * The latest number for each metric that has a target.
 *
 * Read-only and fed entirely by server props. Renders nothing without
 * targets: the section is opt-in by construction, so an empty one would be
 * clutter on every dashboard that never asked for it.
 */
export function ScorecardSection({ rows }: ScorecardSectionProps) {
  if (rows.length === 0) return null

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">Scorecard</h2>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground sm:text-xs">
          {rows.filter((row) => row.met).length} of {rows.length} met
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          // Fill means closeness to the target in both directions. Only the
          // colour flips: for a limit, full is bad and beyond it worse.
          const fill =
            row.latestValue === null || row.targetValue === 0
              ? 0
              : Math.min((row.latestValue / row.targetValue) * 100, 100)

          return (
            <li key={row.fieldId} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-base sm:text-sm">
                  {row.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-xs">
                  {describeRow(row)}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    row.latestValue === null
                      ? 'bg-transparent'
                      : row.met
                        ? 'bg-primary'
                        : 'bg-destructive'
                  )}
                  style={{ width: `${fill}%` }}
                />
              </div>

              {row.latestDate && (
                <p className="text-xs text-muted-foreground">
                  Last recorded {formatDate(row.latestDate)}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-4 border-t pt-3">
        <Link
          href="/journal/metrics"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
        >
          All metrics →
        </Link>
      </div>
    </section>
  )
}

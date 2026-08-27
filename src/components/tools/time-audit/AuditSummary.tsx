'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  categoryColor,
  daysInWindow,
  formatDuration,
  summarize,
  type TimeAuditPayload,
} from './time-audit'

export interface AuditSummaryProps {
  days: TimeAuditPayload[]
  today: string
}

const WINDOWS: { label: string; days: number | null }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All time', days: null },
]

const VALUE_LABELS: Record<string, string> = {
  worth_it: 'Worth it',
  neutral: 'Neutral',
  wasted: 'Wasted',
}

export function AuditSummary({ days, today }: AuditSummaryProps) {
  const [windowIndex, setWindowIndex] = useState(0)
  const active = WINDOWS[windowIndex]
  const scoped = daysInWindow(days, active.days, today)
  const summary = summarize(scoped)
  const percent = Math.round(summary.wastedShare * 100)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Summary range">
        {WINDOWS.map((option, index) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setWindowIndex(index)}
            aria-pressed={index === windowIndex}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              index === windowIndex
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {summary.loggedMinutes === 0 ? (
        <p className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
          {days.length === 0
            ? 'Nothing logged yet. Paint a day above to see where your time goes.'
            : `Nothing logged in the ${active.label.toLowerCase()}. Older days are still there — widen the range.`}
        </p>
      ) : (
        <>
          <div
            data-testid="wasted-headline"
            className="rounded-2xl border bg-card p-4"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Wasted across {summary.dayCount} logged {summary.dayCount === 1 ? 'day' : 'days'}
            </p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
              {formatDuration(summary.wastedMinutes)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {percent}% of the {formatDuration(summary.loggedMinutes)} you logged.
            </p>
          </div>

          <div className="space-y-2">
            {summary.totals.map((total) => (
              <div
                key={total.id}
                data-testid="category-row"
                className="rounded-xl border bg-card p-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <span
                      className={cn('size-2.5 shrink-0 rounded-full', categoryColor(total.color).swatch)}
                    />
                    <span className="truncate">{total.label}</span>
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      {VALUE_LABELS[total.value]}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">
                    {formatDuration(total.minutes)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', categoryColor(total.color).swatch)}
                    style={{ width: `${Math.max(2, total.share * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {summary.unloggedMinutes > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatDuration(summary.unloggedMinutes)} of those days is still unlogged and is
              left out of the percentages above.
            </p>
          )}
        </>
      )}
    </section>
  )
}

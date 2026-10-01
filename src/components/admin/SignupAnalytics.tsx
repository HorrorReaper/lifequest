'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SIGNUP_RANGES,
  cumulativeSignupSeries,
  sumSignups,
  type SignupPoint,
  type SignupRange,
  type SignupTotals,
} from '@/lib/signup-analytics'
import { cn } from '@/lib/utils'

interface SignupAnalyticsProps {
  range: SignupRange
  /** One point per day of the range, zero-filled (buildSignupSeries). */
  daily: SignupPoint[]
  /** What existed before the range, so cumulative ends on the real total. */
  baseline: SignupTotals
  /** Why there are no numbers to show, or null when there are. */
  unavailable: 'untrusted' | 'error' | null
}

type Mode = 'daily' | 'cumulative'

const RANGE_LABELS: Record<SignupRange, string> = {
  30: '30 days',
  90: '90 days',
  365: '1 year',
}

/**
 * The two series, in the order and colours of the dataviz reference palette
 * (slots 1 and 2), validated against the light card surfaces and, with their
 * dark steps, against the dark one. On the trail theme's card the orange sits
 * just under 3:1, which is why the totals and the table carry the numbers in
 * text as well.
 */
const SERIES = [
  { key: 'waitlist', label: 'Waitlist', color: 'var(--series-waitlist)' },
  { key: 'users', label: 'Registered', color: 'var(--series-users)' },
] as const

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Names a line at its last point, in text ink rather than the line's colour. */
function endLabel(name: string, lastIndex: number) {
  return function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
    if (props.index !== lastIndex) return null
    return (
      <text
        x={Number(props.x) + 8}
        y={Number(props.y)}
        dy={4}
        fontSize={12}
        className="fill-muted-foreground"
      >
        {name}
      </text>
    )
  }
}

export function SignupAnalytics({ range, daily, baseline, unavailable }: SignupAnalyticsProps) {
  const [mode, setMode] = useState<Mode>('daily')

  const inRange = sumSignups(daily)
  const points = mode === 'daily' ? daily : cumulativeSignupSeries(daily, baseline)
  const chartData = points.map((point) => ({ ...point, dayLabel: formatDay(point.date) }))
  const lastIndex = chartData.length - 1
  const empty = inRange.waitlist === 0 && inRange.users === 0

  return (
    <Card className="[--series-users:#eb6834] [--series-waitlist:#2a78d6] dark:[--series-users:#d95926] dark:[--series-waitlist:#3987e5]">
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Signups</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            New waitlist entries and registered accounts per day (UTC).
          </p>
        </div>
        <nav aria-label="Signup range" className="flex shrink-0 rounded-full bg-muted p-1 text-xs font-medium">
          {SIGNUP_RANGES.map((days) => {
            const active = days === range
            return (
              <Link
                key={days}
                href={`/admin/tools?range=${days}`}
                aria-current={active ? 'page' : undefined}
                scroll={false}
                className={cn(
                  'rounded-full px-3 py-1.5 transition-colors',
                  active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {RANGE_LABELS[days]}
              </Link>
            )
          })}
        </nav>
      </CardHeader>

      <CardContent className="space-y-5">
        {unavailable === 'untrusted' ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Signup numbers need <code>app_metadata.role = admin</code> on your Supabase account. The
            route allowlist opens this page, but the database only counts for a trusted admin.
          </p>
        ) : unavailable === 'error' ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Could not load signup numbers. If this is a new environment, apply{' '}
            <code>supabase/migrations/20260930120000_add_admin_signup_analytics.sql</code> in the
            Supabase SQL editor.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex gap-6">
                {SERIES.map((series) => (
                  <div key={series.key} role="group" aria-label={series.label}>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: series.color }} />
                      {series.label}
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">+{inRange[series.key]}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {baseline[series.key] + inRange[series.key]} total
                    </p>
                  </div>
                ))}
              </div>
              <div role="group" aria-label="Chart values" className="flex rounded-full bg-muted p-1 text-xs font-medium">
                {(['daily', 'cumulative'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mode === option}
                    onClick={() => setMode(option)}
                    className={cn(
                      'rounded-full px-3 py-1.5 transition-colors',
                      mode === option ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {option === 'daily' ? 'Per day' : 'Cumulative'}
                  </button>
                ))}
              </div>
            </div>

            {empty ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No signups in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 8, right: 80, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="opacity-30" />
                  <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fontSize: 12 }} width={36} allowDecimals={false} />
                  <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''} />
                  {SERIES.map((series) => (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      name={series.label}
                      stroke={series.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                      label={endLabel(series.label, lastIndex)}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
              <div className="mt-3 max-h-72 overflow-auto rounded-xl ring-1 ring-border">
                <table className="w-full text-left tabular-nums">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Day (UTC)</th>
                      <th scope="col" className="px-3 py-2 font-medium">Waitlist</th>
                      <th scope="col" className="px-3 py-2 font-medium">Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.date} className="border-t border-border">
                        <td className="px-3 py-1.5">{point.date}</td>
                        <td className="px-3 py-1.5">{point.waitlist}</td>
                        <td className="px-3 py-1.5">{point.users}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}

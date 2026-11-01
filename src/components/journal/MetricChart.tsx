'use client'

import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { addDays } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { formatMetricDay } from '@/lib/metrics'
import type { MetricPoint } from '@/lib/legacy-metrics'

interface MetricChartProps {
  label: string
  unit: string | null
  subtitle?: string
  /** Drawn as a dashed line across the chart. */
  targetValue?: number | null
  /** The user's local day; the ranges count back from it. */
  today: string
  data: MetricPoint[]
}

const RANGES = [30, 90, 180] as const
type Range = (typeof RANGES)[number]

function formatValue(value: number, unit: string | null) {
  const rounded = Math.round(value * 100) / 100
  return unit ? `${rounded} ${unit}` : `${rounded}`
}

export function MetricChart({
  label,
  unit,
  subtitle,
  targetValue = null,
  today,
  data,
}: MetricChartProps) {
  const [range, setRange] = useState<Range>(30)

  const since = addDays(today, -range)
  const chartData = data
    .filter((point) => point.date >= since)
    .map((point) => ({ ...point, dateLabel: formatMetricDay(point.date) }))
  // The newest value overall, not only within the range.
  const latest = data.at(-1)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{label}</CardTitle>
          {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {latest && (
          <p className="shrink-0 text-lg font-semibold tabular-nums">
            {formatValue(latest.value, unit)}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div role="group" aria-label="Range" className="flex gap-1">
          {RANGES.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={range === days}
              onClick={() => setRange(days)}
              className={cn(
                'min-h-8 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                range === days
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {days}d
            </button>
          ))}
        </div>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nothing logged in the last {range} days.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 12 }}
                width={unit ? 48 : 36}
                tickFormatter={(value: number) => (unit ? `${value}${unit.length <= 3 ? unit : ''}` : `${value}`)}
              />
              <Tooltip
                formatter={(value) => formatValue(Number(value), unit)}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
              />
              {targetValue !== null && (
                <ReferenceLine
                  y={targetValue}
                  strokeDasharray="6 4"
                  stroke="currentColor"
                  className="text-muted-foreground"
                  ifOverflow="extendDomain"
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

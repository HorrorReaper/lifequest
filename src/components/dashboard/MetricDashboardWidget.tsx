'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LineChart as LineChartIcon } from 'lucide-react'
import type { MetricPoint } from '@/lib/metrics'
import { ClickableSection, SectionHeadingLink } from '@/components/dashboard/ClickableSection'

interface MetricDashboardWidgetProps {
  label: string
  unit: string | null
  data: MetricPoint[]
}

function formatValue(value: number, unit: string | null) {
  const rounded = Math.round(value * 100) / 100
  return unit ? `${rounded} ${unit}` : `${rounded}`
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function MetricDashboardWidget({
  label,
  unit,
  data,
}: MetricDashboardWidgetProps) {
  const chartData = data.map((point) => ({ ...point, dateLabel: formatDate(point.date) }))
  const latest = data.at(-1)

  return (
    <ClickableSection href="/journal/metrics" className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LineChartIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              <SectionHeadingLink href="/journal/metrics">{label}</SectionHeadingLink>
            </h2>
            <p className="text-xs text-muted-foreground">Tracked metric</p>
          </div>
        </div>
        {latest && (
          <p className="shrink-0 text-lg font-semibold tabular-nums">
            {formatValue(latest.value, unit)}
          </p>
        )}
      </div>

      {chartData.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No entries yet for this metric.
        </p>
      ) : (
        <div className="mt-3 -ml-2">
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip formatter={(value) => formatValue(Number(value), unit)} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </ClickableSection>
  )
}

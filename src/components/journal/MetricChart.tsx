'use client'

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
import type { MetricPoint } from '@/lib/metrics'

interface MetricChartProps {
  label: string
  unit: string | null
  templateName: string
  data: MetricPoint[]
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatValue(value: number, unit: string | null) {
  const rounded = Math.round(value * 100) / 100
  return unit ? `${rounded} ${unit}` : `${rounded}`
}

export function MetricChart({ label, unit, templateName, data }: MetricChartProps) {
  const chartData = data.map((point) => ({ ...point, dateLabel: formatDate(point.date) }))
  const latest = data.at(-1)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{label}</CardTitle>
          <p className="mt-1 truncate text-xs text-muted-foreground">{templateName}</p>
        </div>
        {latest && (
          <p className="shrink-0 text-lg font-semibold tabular-nums">
            {formatValue(latest.value, unit)}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No entries yet for this field.
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

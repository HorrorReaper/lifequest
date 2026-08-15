import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, LineChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchMetricSeries, fetchTrackedMetrics } from '@/lib/metrics'
import { MetricChart } from '@/components/journal/MetricChart'

export default async function JournalMetricsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const metrics = await fetchTrackedMetrics(supabase, user.id)
  const series = await Promise.all(
    metrics.map((metric) => fetchMetricSeries(supabase, user.id, metric.fieldId))
  )

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Link
            href="/journal"
            className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Journal
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LineChart className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
              <p className="text-sm text-muted-foreground">
                Numbers you&apos;ve chosen to track over time, sourced from your journal entries.
              </p>
            </div>
          </div>
        </header>

        {metrics.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
            <LineChart className="mx-auto size-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium">No metrics yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a journal template, add a Number field, and turn on &quot;Track as
              metric&quot; to see it here.
            </p>
            <Link
              href="/journal/templates"
              className="mt-4 inline-flex min-h-11 items-center rounded-full border bg-background px-4 text-sm font-medium transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              Open templates
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {metrics.map((metric, index) => (
              <MetricChart
                key={metric.fieldId}
                label={metric.label}
                unit={metric.unit}
                templateName={metric.templateName}
                data={series[index]}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, LineChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchLatestValues, fetchMetrics, fetchPreviousValues } from '@/lib/metrics'
import { MetricCreateLauncher } from '@/components/metrics/MetricCreateLauncher'
import { MetricList } from '@/components/metrics/MetricList'

export default async function JournalMetricsPage({
  searchParams,
}: {
  /** `new=1` opens the create dialog straight away (the + menu's "Metric"). */
  searchParams?: Promise<{ new?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const metrics = await fetchMetrics(supabase, user.id)
  const metricIds = metrics.map((metric) => metric.id)
  const [latest, previous] = await Promise.all([
    fetchLatestValues(supabase, metricIds),
    fetchPreviousValues(supabase, metricIds),
  ])
  const initiallyOpen = params.new === '1'
  // Remounts when ?new=1 arrives again, so the + menu opens the dialog even
  // when you are already on this page.
  const launcherKey = initiallyOpen ? 'new' : 'list'

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
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
              <p className="text-sm text-muted-foreground">
                Numbers you track over time, one value a day.
              </p>
            </div>
            {metrics.length > 0 && (
              <MetricCreateLauncher
                key={launcherKey}
                userId={user.id}
                initiallyOpen={initiallyOpen}
                variant="button"
              />
            )}
          </div>
        </header>

        {metrics.length === 0 ? (
          <MetricCreateLauncher
            key={launcherKey}
            userId={user.id}
            initiallyOpen={initiallyOpen}
            variant="empty"
          />
        ) : (
          <MetricList metrics={metrics} latest={latest} previous={previous} />
        )}
      </div>
    </main>
  )
}

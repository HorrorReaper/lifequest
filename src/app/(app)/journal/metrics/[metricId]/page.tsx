import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addDays, dateInTimezone } from '@/lib/dates'
import { fetchLatestValues, fetchMetric, fetchMetricValues } from '@/lib/metrics'
import { MetricChart } from '@/components/journal/MetricChart'
import { MetricHistoryList } from '@/components/metrics/MetricHistoryList'
import { MetricLogBox } from '@/components/metrics/MetricLogBox'
import { MetricPageHeader } from '@/components/metrics/MetricPageHeader'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The longest range the chart offers, and so how far back values are read. */
const HISTORY_DAYS = 180

export default async function MetricPage({
  params,
  searchParams,
}: {
  params: Promise<{ metricId: string }>
  /** `from=home` comes from the dashboard's log dialog; `created` is read by a later task. */
  searchParams?: Promise<{ from?: string; created?: string }>
}) {
  const { metricId } = await params
  const query = searchParams ? await searchParams : {}
  if (!UUID_PATTERN.test(metricId)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const metric = await fetchMetric(supabase, user.id, metricId)
  if (!metric) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const timezone = (profile as { timezone?: string } | null)?.timezone ?? 'UTC'
  const today = dateInTimezone(new Date(), timezone)

  // The latest value is read on its own: the last log may be older than the
  // history window, and the log box should still start from it.
  const [values, latestByMetric] = await Promise.all([
    fetchMetricValues(supabase, metric.id, addDays(today, -HISTORY_DAYS)),
    fetchLatestValues(supabase, [metric.id]),
  ])

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <MetricPageHeader
          metric={metric}
          backHref={query.from === 'home' ? '/dashboard' : '/journal/metrics'}
        />
        <MetricLogBox
          userId={user.id}
          metric={metric}
          latest={latestByMetric[metric.id] ?? null}
          today={today}
        />
        <MetricChart
          label={metric.name}
          unit={metric.unit}
          targetValue={metric.targetValue}
          today={today}
          data={values}
        />
        <MetricHistoryList metric={metric} values={values} />
      </div>
    </main>
  )
}

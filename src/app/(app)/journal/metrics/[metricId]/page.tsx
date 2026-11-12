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
  /** `from=home` comes from the dashboard's log dialog; `created=1` from the create dialog. */
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
  const [values, latestByMetric, templateRows] = await Promise.all([
    fetchMetricValues(supabase, metric.id, addDays(today, -HISTORY_DAYS)),
    fetchLatestValues(supabase, [metric.id]),
    // The user's own active templates and the active system ones.
    supabase
      .from('journal_templates')
      .select('id, name')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .eq('is_active', true)
      .order('name'),
  ])

  // A failed read must reach the error boundary: an empty list would make the
  // settings say "Create a journal template first…" to a user who has some.
  if (templateRows.error) throw templateRows.error

  const templateList = (templateRows.data ?? []) as { id: string; name: string }[]
  // Each template's number fields in field order, in one query, so changing
  // the journal link can re-point a legacy source field to its namesake.
  const numberFieldsByTemplate = new Map<string, { id: string; label: string }[]>()
  const linkedTemplateIds = [
    ...templateList.map((template) => template.id),
    ...(metric.templateId ? [metric.templateId] : []),
  ]
  if (linkedTemplateIds.length > 0) {
    const { data: fieldRows, error: fieldsError } = await supabase
      .from('template_fields')
      .select('id, template_id, label')
      .in('template_id', linkedTemplateIds)
      .eq('field_type', 'number')
      .order('sort_order', { ascending: true })

    if (fieldsError) throw fieldsError

    for (const row of (fieldRows ?? []) as { id: string; template_id: string; label: string }[]) {
      const fields = numberFieldsByTemplate.get(row.template_id) ?? []
      fields.push({ id: row.id, label: row.label })
      numberFieldsByTemplate.set(row.template_id, fields)
    }
  }

  const templates = templateList.map((template) => ({
    id: template.id,
    name: template.name,
    archived: false,
    numberFields: numberFieldsByTemplate.get(template.id) ?? [],
  }))
  // A template archived after the metric was linked is still shown, so the
  // settings can say where the metric is asked and offer to change it.
  if (metric.templateId && !templates.some((template) => template.id === metric.templateId)) {
    templates.push({
      id: metric.templateId,
      name: metric.templateName ?? 'Archived template',
      archived: metric.templateArchived,
      numberFields: numberFieldsByTemplate.get(metric.templateId) ?? [],
    })
  }

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <MetricPageHeader
          metric={metric}
          backHref={query.from === 'home' ? '/dashboard' : '/journal/metrics'}
          templates={templates}
          latest={latestByMetric[metric.id] ?? null}
          created={query.created === '1'}
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

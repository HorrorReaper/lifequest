import type { SupabaseClient } from '@supabase/supabase-js'

// A "metric" is a free-range `number` journal field whose config carries
// track_as_metric: true (set in the template builder). No dedicated table:
// config is already a free-form Json column on template_fields, and the
// underlying values already live in journal_responses.value_number — this
// only changes what gets queried and displayed, not what gets written.

export interface TrackedMetric {
  fieldId: string
  templateId: string
  templateName: string
  label: string
  unit: string | null
}

export interface MetricPoint {
  date: string
  value: number
}

interface TemplateFieldConfigRow {
  id: string
  template_id: string
  label: string
  config: unknown
}

function metricUnit(config: unknown): { tracked: boolean; unit: string | null } {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { tracked: false, unit: null }
  }

  const record = config as Record<string, unknown>
  const tracked = record.track_as_metric === true
  const unit =
    typeof record.metric_unit === 'string' && record.metric_unit.trim()
      ? record.metric_unit.trim()
      : null

  return { tracked, unit }
}

export async function fetchTrackedMetrics(
  supabase: SupabaseClient,
  userId: string
): Promise<TrackedMetric[]> {
  const { data: templateRows } = await supabase
    .from('journal_templates')
    .select('id, name')
    .or(`user_id.eq.${userId},is_system.eq.true`)
    .eq('is_active', true)

  const templates = (templateRows ?? []) as { id: string; name: string }[]
  if (templates.length === 0) return []

  const templateNameById = new Map(templates.map((t) => [t.id, t.name]))

  const { data: fieldRows } = await supabase
    .from('template_fields')
    .select('id, template_id, label, config')
    .eq('field_type', 'number')
    .in(
      'template_id',
      templates.map((t) => t.id)
    )

  return ((fieldRows ?? []) as TemplateFieldConfigRow[])
    .map((field) => {
      const { tracked, unit } = metricUnit(field.config)
      if (!tracked) return null

      const templateName = templateNameById.get(field.template_id)
      if (!templateName) return null

      return {
        fieldId: field.id,
        templateId: field.template_id,
        templateName,
        label: field.label,
        unit,
      } satisfies TrackedMetric
    })
    .filter((metric): metric is TrackedMetric => metric !== null)
}

export async function fetchMetricSeries(
  supabase: SupabaseClient,
  userId: string,
  fieldId: string,
  days = 180
): Promise<MetricPoint[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: entryRows } = await supabase
    .from('journal_entries')
    .select('id, entry_date')
    .eq('user_id', userId)
    .gte('entry_date', sinceDate)

  const entries = (entryRows ?? []) as { id: string; entry_date: string }[]
  if (entries.length === 0) return []

  const entryDateById = new Map(entries.map((entry) => [entry.id, entry.entry_date]))

  const { data: responseRows } = await supabase
    .from('journal_responses')
    .select('entry_id, value_number')
    .eq('field_id', fieldId)
    .in(
      'entry_id',
      entries.map((entry) => entry.id)
    )
    .not('value_number', 'is', null)

  return shapeMetricSeries(
    (responseRows ?? []) as { entry_id: string; value_number: number | null }[],
    entryDateById
  )
}

/**
 * Pure so it can be unit-tested without a Supabase client. One point per
 * journal entry (not aggregated per day) — a metric like daily revenue could
 * legitimately have more than one entry on the same date, and averaging or
 * summing them would be a modeling choice this feature doesn't make yet.
 */
export function shapeMetricSeries(
  responses: { entry_id: string; value_number: number | null }[],
  entryDateById: Map<string, string>
): MetricPoint[] {
  const points = responses
    .map((response) => {
      const date = entryDateById.get(response.entry_id)
      if (!date || response.value_number === null) return null
      return { date, value: response.value_number }
    })
    .filter((point): point is MetricPoint => point !== null)

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

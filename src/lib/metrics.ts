import type { SupabaseClient } from '@supabase/supabase-js'
import { parseDecimal } from '@/lib/decimal'
import type { MetricRow } from '@/lib/supabase/database.types'

// A metric is a number the user tracks over time (public.metrics), with one
// value per local day (public.metric_values). It optionally links to a
// journal template, or to one of that template's fields, which then feeds it
// on entry submit.

export type MetricTargetDirection = 'at_least' | 'at_most'

export interface Metric {
  id: string
  name: string
  unit: string | null
  targetValue: number | null
  targetDirection: MetricTargetDirection | null
  templateId: string | null
  templateName: string | null
  templateArchived: boolean
  sourceFieldId: string | null
  createdAt: string
}

export interface MetricValue {
  date: string
  value: number
  sourceEntryId: string | null
  sourceLabel: string | null
}

export interface LatestValue {
  value: number
  date: string
}

export interface ScorecardRow {
  metricId: string
  name: string
  unit: string | null
  targetValue: number | null
  direction: MetricTargetDirection | null
  latestValue: number | null
  latestDate: string | null
  met: boolean | null
}

export const METRIC_NAME_MAX = 60
export const METRIC_UNIT_MAX = 12

/** How many recent values per metric the assistant is shown. */
const ASSISTANT_RECENT_VALUES = 14

export function validateMetricInput(input: { name: string; unit: string }): string | null {
  const name = input.name.trim()
  if (!name) return 'Give the metric a name.'
  if (name.length > METRIC_NAME_MAX) {
    return `The name can be at most ${METRIC_NAME_MAX} characters.`
  }
  if (input.unit.trim().length > METRIC_UNIT_MAX) {
    return `The unit can be at most ${METRIC_UNIT_MAX} characters.`
  }
  return null
}

/**
 * Whether a value satisfies its target.
 *
 * Equality counts as met in both directions: exactly two coffees against
 * "at most two" is the target, not a miss.
 */
export function metTarget(
  value: number,
  target: number,
  direction: MetricTargetDirection
): boolean {
  return direction === 'at_least' ? value >= target : value <= target
}

/**
 * The stepper increment for a metric, from the magnitude of its latest value:
 * below 10 steps by 0.1, below 100 by 0.5, below 1,000 by 1, below 10,000 by
 * 10, otherwise by 100. With no value yet it steps by 1.
 */
export function stepFor(latest: number | null): number {
  if (latest === null) return 1
  const magnitude = Math.abs(latest)
  if (magnitude < 10) return 0.1
  if (magnitude < 100) return 0.5
  if (magnitude < 1000) return 1
  if (magnitude < 10000) return 10
  return 100
}

function decimalPlaces(step: number): number {
  const text = String(step)
  const point = text.indexOf('.')
  return point === -1 ? 0 : text.length - point - 1
}

/** Moves `value` one step up or down, rounded to the step's decimals (81.6 - 0.1 is 81.5, not 81.5000001). */
export function applyStep(value: number, step: number, sign: 1 | -1): number {
  return Number((value + sign * step).toFixed(decimalPlaces(step)))
}

/** A local day as `Oct 29`. Read at noon so no time zone moves it to a neighbouring day. */
export function formatMetricDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatMetricValue(value: number, unit: string | null): string {
  const rounded = Math.round(value * 100) / 100
  return unit ? `${rounded} ${unit}` : `${rounded}`
}

/** The warning shown where a value is logged and today already has one. */
export function alreadyLoggedText(value: number, unit: string | null): string {
  return `You already logged ${formatMetricValue(value, unit)} today. Saving replaces it.`
}

/**
 * The scorecard rows, in the order the metrics come in. `met` is null when
 * there is nothing to judge: no target, or no value yet.
 */
export function buildScorecardRows(
  metrics: Metric[],
  latest: Record<string, LatestValue>
): ScorecardRow[] {
  return metrics.map((metric) => {
    const value = latest[metric.id] ?? null
    const judged =
      value && metric.targetValue !== null && metric.targetDirection !== null
        ? metTarget(value.value, metric.targetValue, metric.targetDirection)
        : null

    return {
      metricId: metric.id,
      name: metric.name,
      unit: metric.unit,
      targetValue: metric.targetValue,
      direction: metric.targetDirection,
      latestValue: value ? value.value : null,
      latestDate: value ? value.date : null,
      met: judged,
    }
  })
}

/**
 * Pairs each old template field with the new field of the same label, for the
 * save that re-creates a template's fields. Duplicate labels pair in order;
 * an old field with no counterpart left maps to null.
 */
export function matchFieldsByLabel(
  oldFields: { id: string; label: string }[],
  newFields: { id: string; label: string }[]
): Map<string, string | null> {
  const unclaimed = new Map<string, string[]>()
  for (const field of newFields) {
    unclaimed.set(field.label, [...(unclaimed.get(field.label) ?? []), field.id])
  }

  const result = new Map<string, string | null>()
  for (const field of oldFields) {
    result.set(field.id, unclaimed.get(field.label)?.shift() ?? null)
  }
  return result
}

/**
 * The metric values an entry submit should write. A metric fed by one of the
 * template's own fields takes that field's value; any other linked metric
 * takes its text input in the "Metrics" block. An empty or unparsable value
 * means "not answered" and is left out, never written as zero.
 */
export function entryMetricWrites(input: {
  linked: Metric[]
  fieldValues: Record<string, number | null>
  blockValues: Record<string, string>
}): { metricId: string; value: number }[] {
  const writes: { metricId: string; value: number }[] = []

  for (const metric of input.linked) {
    const value = metric.sourceFieldId
      ? (input.fieldValues[metric.sourceFieldId] ?? null)
      : parseDecimal(input.blockValues[metric.id] ?? '')

    if (value !== null) writes.push({ metricId: metric.id, value })
  }

  return writes
}

/** What the assistant sees of each metric: its target as a sentence and the latest values, newest last. */
export function buildMetricAssistantContext(
  metrics: Metric[],
  values: Record<string, MetricValue[]>
): {
  name: string
  unit: string | null
  target: string | null
  recent: { date: string; value: number }[]
}[] {
  return metrics.map((metric) => {
    const recent = [...(values[metric.id] ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-ASSISTANT_RECENT_VALUES)
      .map((point) => ({ date: point.date, value: point.value }))

    const target =
      metric.targetValue !== null && metric.targetDirection !== null
        ? `${metric.targetDirection === 'at_least' ? 'at least' : 'at most'} ${
            metric.unit ? `${metric.targetValue} ${metric.unit}` : metric.targetValue
          }`
        : null

    return { name: metric.name, unit: metric.unit, target, recent }
  })
}

type TemplateInfo = { name: string; archived: boolean }

function toMetric(row: MetricRow, templates: Map<string, TemplateInfo>): Metric {
  const template = row.template_id ? templates.get(row.template_id) : undefined

  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    targetValue: row.target_value === null ? null : Number(row.target_value),
    targetDirection: row.target_direction,
    templateId: row.template_id,
    templateName: template?.name ?? null,
    templateArchived: template?.archived ?? false,
    sourceFieldId: row.source_field_id,
    createdAt: row.created_at,
  }
}

/**
 * Joins template names onto metric rows with a second query rather than
 * PostgREST embedding, which appears nowhere else here. Row-level security
 * decides which templates are visible, so a metric pointing at a template the
 * user can no longer see simply shows no template name.
 */
async function withTemplates(supabase: SupabaseClient, rows: MetricRow[]): Promise<Metric[]> {
  const templateIds = [...new Set(rows.flatMap((row) => (row.template_id ? [row.template_id] : [])))]
  const templates = new Map<string, TemplateInfo>()

  if (templateIds.length > 0) {
    const { data, error } = await supabase
      .from('journal_templates')
      .select('id, name, is_active')
      .in('id', templateIds)

    if (error) throw error

    for (const row of (data ?? []) as { id: string; name: string; is_active: boolean }[]) {
      templates.set(row.id, { name: row.name, archived: !row.is_active })
    }
  }

  return rows.map((row) => toMetric(row, templates))
}

export async function fetchMetrics(supabase: SupabaseClient, userId: string): Promise<Metric[]> {
  const { data, error } = await supabase
    .from('metrics')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return withTemplates(supabase, (data ?? []) as MetricRow[])
}

export async function fetchMetric(
  supabase: SupabaseClient,
  userId: string,
  metricId: string
): Promise<Metric | null> {
  const { data, error } = await supabase
    .from('metrics')
    .select('*')
    .eq('id', metricId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const [metric] = await withTemplates(supabase, [data as MetricRow])
  return metric
}

/**
 * A metric's values in ascending date order. `sourceLabel` is the template
 * name of the entry a value came from (two lookups, entry then template), or
 * null for a value entered directly or whose entry is gone.
 */
export async function fetchMetricValues(
  supabase: SupabaseClient,
  metricId: string,
  sinceDate?: string
): Promise<MetricValue[]> {
  let query = supabase
    .from('metric_values')
    .select('value_date, value, source_entry_id')
    .eq('metric_id', metricId)
    .order('value_date', { ascending: true })

  if (sinceDate) query = query.gte('value_date', sinceDate)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as {
    value_date: string
    value: number
    source_entry_id: string | null
  }[]

  const entryIds = [
    ...new Set(rows.flatMap((row) => (row.source_entry_id ? [row.source_entry_id] : []))),
  ]
  const labelByEntryId = new Map<string, string>()

  if (entryIds.length > 0) {
    const { data: entryRows, error: entryError } = await supabase
      .from('journal_entries')
      .select('id, template_id')
      .in('id', entryIds)

    if (entryError) throw entryError

    const entries = (entryRows ?? []) as { id: string; template_id: string }[]
    const templateIds = [...new Set(entries.map((entry) => entry.template_id))]

    if (templateIds.length > 0) {
      const { data: templateRows, error: templateError } = await supabase
        .from('journal_templates')
        .select('id, name')
        .in('id', templateIds)

      if (templateError) throw templateError

      const nameByTemplateId = new Map(
        ((templateRows ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name])
      )

      for (const entry of entries) {
        const name = nameByTemplateId.get(entry.template_id)
        if (name) labelByEntryId.set(entry.id, name)
      }
    }
  }

  return rows.map((row) => ({
    date: row.value_date,
    value: Number(row.value),
    sourceEntryId: row.source_entry_id,
    sourceLabel: row.source_entry_id ? (labelByEntryId.get(row.source_entry_id) ?? null) : null,
  }))
}

/**
 * The newest value of every given metric. One limit-1 query per metric rather
 * than one query over all of them: PostgREST caps a response at 1000 rows, so
 * a single query would silently drop values once the history outgrows that.
 */
export async function fetchLatestValues(
  supabase: SupabaseClient,
  metricIds: string[]
): Promise<Record<string, LatestValue>> {
  if (metricIds.length === 0) return {}

  const results = await Promise.all(
    metricIds.map(async (metricId) => {
      const { data, error } = await supabase
        .from('metric_values')
        .select('metric_id, value_date, value')
        .eq('metric_id', metricId)
        .order('value_date', { ascending: false })
        .limit(1)

      if (error) throw error

      return ((data ?? []) as { metric_id: string; value_date: string; value: number }[])[0]
    })
  )

  const latest: Record<string, LatestValue> = {}
  for (const row of results) {
    if (row) latest[row.metric_id] = { value: Number(row.value), date: row.value_date }
  }

  return latest
}

/**
 * The second-newest value of every given metric (null when there is none),
 * for the trend arrow beside the latest one. Per-metric `range(1, 1)` queries
 * for the same reason as `fetchLatestValues`: never read the whole history.
 */
export async function fetchPreviousValues(
  supabase: SupabaseClient,
  metricIds: string[]
): Promise<Record<string, number | null>> {
  const results = await Promise.all(
    metricIds.map(async (metricId) => {
      const { data, error } = await supabase
        .from('metric_values')
        .select('value')
        .eq('metric_id', metricId)
        .order('value_date', { ascending: false })
        .range(1, 1)

      if (error) throw error

      const row = ((data ?? []) as { value: number }[])[0]
      return [metricId, row ? Number(row.value) : null] as const
    })
  )

  return Object.fromEntries(results)
}

/**
 * The value each given metric has on one day (metrics with none are absent),
 * in a single query: one day holds at most one value per metric, so the
 * 1000-row cap cannot be reached.
 */
export async function fetchValuesForDate(
  supabase: SupabaseClient,
  metricIds: string[],
  date: string
): Promise<Record<string, number>> {
  if (metricIds.length === 0) return {}

  const { data, error } = await supabase
    .from('metric_values')
    .select('metric_id, value')
    .in('metric_id', metricIds)
    .eq('value_date', date)

  if (error) throw error

  const values: Record<string, number> = {}
  for (const row of (data ?? []) as { metric_id: string; value: number }[]) {
    values[row.metric_id] = Number(row.value)
  }

  return values
}

/**
 * The user's metrics an entry of this template feeds: linked to the template
 * itself, or sourced from one of its fields (which can outlive a link change).
 */
export async function fetchLinkedMetrics(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
  fieldIds: string[]
): Promise<Metric[]> {
  const conditions = [`template_id.eq.${templateId}`]
  if (fieldIds.length > 0) conditions.push(`source_field_id.in.(${fieldIds.join(',')})`)

  const { data, error } = await supabase
    .from('metrics')
    .select('*')
    .eq('user_id', userId)
    .or(conditions.join(','))
    .order('created_at', { ascending: true })

  if (error) throw error

  return withTemplates(supabase, (data ?? []) as MetricRow[])
}

/** The metrics an entry of this template asks for, each with the value it already has on `date`. */
export async function fetchJournalMetrics(
  supabase: SupabaseClient,
  userId: string,
  templateId: string,
  fieldIds: string[],
  date: string
): Promise<{ metric: Metric; value: number | null }[]> {
  const linked = await fetchLinkedMetrics(supabase, userId, templateId, fieldIds)
  const values = await fetchValuesForDate(
    supabase,
    linked.map((metric) => metric.id),
    date
  )

  return linked.map((metric) => ({ metric, value: values[metric.id] ?? null }))
}

export interface DashboardMetrics {
  metrics: Metric[]
  latest: Record<string, LatestValue>
  /** One series per metric, in `metrics` order; empty unless `withSeries`. */
  series: MetricValue[][]
}

/**
 * Everything the dashboard's scorecard and metric chart read.
 *
 * A failed read leaves both sections empty rather than taking the whole
 * dashboard down with it, like the goals section. That also covers a
 * deployment whose database does not have the metrics tables yet.
 */
export async function loadDashboardMetrics(
  supabase: SupabaseClient,
  userId: string,
  options: { withSeries: boolean; sinceDate: string }
): Promise<DashboardMetrics> {
  try {
    const metrics = await fetchMetrics(supabase, userId)
    const ids = metrics.map((metric) => metric.id)
    const [latest, series] = await Promise.all([
      fetchLatestValues(supabase, ids),
      options.withSeries
        ? Promise.all(ids.map((id) => fetchMetricValues(supabase, id, options.sinceDate)))
        : Promise.resolve([]),
    ])
    return { metrics, latest, series }
  } catch (error) {
    console.error('Failed to load metrics:', error)
    return { metrics: [], latest: {}, series: [] }
  }
}

/**
 * The assistant's view of every metric with its values since `sinceDate`.
 *
 * One query for all values. A failed read gives the assistant no metrics
 * instead of failing the whole chat request.
 */
export async function fetchAssistantMetrics(
  supabase: SupabaseClient,
  userId: string,
  sinceDate: string
): Promise<ReturnType<typeof buildMetricAssistantContext>> {
  try {
    const metrics = await fetchMetrics(supabase, userId)
    if (metrics.length === 0) return []

    const { data, error } = await supabase
      .from('metric_values')
      .select('metric_id, value_date, value, source_entry_id')
      .in(
        'metric_id',
        metrics.map((metric) => metric.id)
      )
      .gte('value_date', sinceDate)
      .order('value_date', { ascending: true })

    if (error) throw error

    const rows = (data ?? []) as {
      metric_id: string
      value_date: string
      value: number
      source_entry_id: string | null
    }[]
    const values: Record<string, MetricValue[]> = {}
    for (const row of rows) {
      ;(values[row.metric_id] ??= []).push({
        date: row.value_date,
        value: row.value,
        sourceEntryId: row.source_entry_id,
        sourceLabel: null,
      })
    }

    return buildMetricAssistantContext(metrics, values)
  } catch (error) {
    console.error('Failed to load metrics for the assistant:', error)
    return []
  }
}

export async function createMetric(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; unit: string }
): Promise<Metric> {
  const { data, error } = await supabase
    .from('metrics')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      unit: input.unit.trim() || null,
    })
    .select('*')
    .single()

  if (error) throw error

  return toMetric(data as MetricRow, new Map())
}

export async function updateMetric(
  supabase: SupabaseClient,
  metricId: string,
  patch: {
    name?: string
    unit?: string | null
    targetValue?: number | null
    targetDirection?: MetricTargetDirection | null
    templateId?: string | null
    sourceFieldId?: string | null
  }
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.unit !== undefined) update.unit = patch.unit
  if (patch.targetValue !== undefined) update.target_value = patch.targetValue
  if (patch.targetDirection !== undefined) update.target_direction = patch.targetDirection
  if (patch.templateId !== undefined) update.template_id = patch.templateId
  if (patch.sourceFieldId !== undefined) update.source_field_id = patch.sourceFieldId

  const { error } = await supabase.from('metrics').update(update).eq('id', metricId)

  if (error) throw error
}

export interface TemplateMetricLink {
  id: string
  name: string
  templateId: string | null
  sourceFieldId: string | null
}

/**
 * The metrics tied to a template: those whose `template_id` is the template
 * and those fed by one of `fieldIds` (normally the template's own fields).
 * The template builder reads this to list them and, before it replaces the
 * fields, to know which links must be re-pointed.
 */
export async function fetchTemplateMetricLinks(
  supabase: SupabaseClient,
  templateId: string,
  fieldIds: string[]
): Promise<TemplateMetricLink[]> {
  const query = supabase.from('metrics').select('id, name, template_id, source_field_id')
  const { data, error } = await (fieldIds.length > 0
    ? query.or(`template_id.eq.${templateId},source_field_id.in.(${fieldIds.join(',')})`)
    : query.eq('template_id', templateId)
  ).order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as Pick<MetricRow, 'id' | 'name' | 'template_id' | 'source_field_id'>[]).map(
    (row) => ({
      id: row.id,
      name: row.name,
      templateId: row.template_id,
      sourceFieldId: row.source_field_id,
    })
  )
}

export async function deleteMetric(supabase: SupabaseClient, metricId: string): Promise<void> {
  const { error } = await supabase.from('metrics').delete().eq('id', metricId)

  if (error) throw error
}

/** Records the value of a day; a second value on the same day replaces the first. */
export async function logMetricValue(
  supabase: SupabaseClient,
  userId: string,
  input: { metricId: string; date: string; value: number; sourceEntryId?: string | null }
): Promise<void> {
  const { error } = await supabase.from('metric_values').upsert(
    {
      metric_id: input.metricId,
      user_id: userId,
      value_date: input.date,
      value: input.value,
      source_entry_id: input.sourceEntryId ?? null,
    },
    { onConflict: 'metric_id,value_date' }
  )

  if (error) throw error
}

/** Changes the value of an existing day, keeping where it came from. */
export async function updateMetricValue(
  supabase: SupabaseClient,
  metricId: string,
  date: string,
  value: number
): Promise<void> {
  const { error } = await supabase
    .from('metric_values')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('metric_id', metricId)
    .eq('value_date', date)

  if (error) throw error
}

export async function deleteMetricValue(
  supabase: SupabaseClient,
  metricId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from('metric_values')
    .delete()
    .eq('metric_id', metricId)
    .eq('value_date', date)

  if (error) throw error
}

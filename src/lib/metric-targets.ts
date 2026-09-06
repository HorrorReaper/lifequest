import type { SupabaseClient } from '@supabase/supabase-js'
import type { TrackedMetric } from '@/lib/metrics'

export type MetricTargetDirection = 'at_least' | 'at_most'

export interface MetricTarget {
  fieldId: string
  targetValue: number
  direction: MetricTargetDirection
}

export interface LatestValue {
  value: number
  date: string
}

export interface ScorecardRow {
  fieldId: string
  label: string
  unit: string | null
  targetValue: number
  direction: MetricTargetDirection
  latestValue: number | null
  latestDate: string | null
  met: boolean
}

/**
 * How far back a value still counts as the current one.
 *
 * Outside this the row reads "no value yet" rather than showing a
 * two-year-old number against a target as though it were today's.
 */
export const LATEST_VALUE_WINDOW_DAYS = 365

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
 * The most recent recorded value per field.
 *
 * A response whose entry is outside the fetched window has no date here and
 * is dropped, which is what makes the window the definition of "current".
 */
export function latestByFieldId(
  responses: { field_id: string; entry_id: string; value_number: number | null }[],
  entryDateById: Map<string, string>
): Record<string, LatestValue> {
  const latest: Record<string, LatestValue> = {}

  for (const response of responses) {
    if (response.value_number === null) continue
    const date = entryDateById.get(response.entry_id)
    if (!date) continue

    const current = latest[response.field_id]
    if (!current || date > current.date) {
      latest[response.field_id] = { value: response.value_number, date }
    }
  }

  return latest
}

/**
 * Joins the three sources into the rows the scorecard renders.
 *
 * Driven by the metrics, so rows inherit their order, and so a target whose
 * field stopped being a tracked metric simply does not appear -- without
 * being deleted, which means turning tracking back on restores it.
 */
export function buildScorecardRows({
  metrics,
  targets,
  latest,
}: {
  metrics: TrackedMetric[]
  targets: MetricTarget[]
  latest: Record<string, LatestValue>
}): ScorecardRow[] {
  const targetByFieldId = new Map(targets.map((target) => [target.fieldId, target]))

  return metrics
    .map((metric) => {
      const target = targetByFieldId.get(metric.fieldId)
      if (!target) return null

      const value = latest[metric.fieldId] ?? null

      return {
        fieldId: metric.fieldId,
        label: metric.label,
        unit: metric.unit,
        targetValue: target.targetValue,
        direction: target.direction,
        latestValue: value ? value.value : null,
        latestDate: value ? value.date : null,
        met: value ? metTarget(value.value, target.targetValue, target.direction) : false,
      } satisfies ScorecardRow
    })
    .filter((row): row is ScorecardRow => row !== null)
}

export async function fetchMetricTargets(
  supabase: SupabaseClient,
  userId: string
): Promise<MetricTarget[]> {
  const { data, error } = await supabase
    .from('metric_targets')
    .select('field_id, target_value, direction')
    .eq('user_id', userId)

  if (error) throw error

  const rows = (data ?? []) as {
    field_id: string
    target_value: number
    direction: MetricTargetDirection
  }[]

  return rows.map((row) => ({
    fieldId: row.field_id,
    targetValue: row.target_value,
    direction: row.direction,
  }))
}

/**
 * The latest value for every targeted field, in one pair of queries.
 *
 * Mirrors fetchMetricSeries' two-step shape rather than introducing
 * PostgREST embedding, which appears nowhere else here. Unlike that
 * function it runs once for the whole scorecard, not once per metric.
 */
export async function fetchLatestMetricValues(
  supabase: SupabaseClient,
  userId: string,
  fieldIds: string[]
): Promise<Record<string, LatestValue>> {
  if (fieldIds.length === 0) return {}

  const since = new Date()
  since.setDate(since.getDate() - LATEST_VALUE_WINDOW_DAYS)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: entryRows, error: entryError } = await supabase
    .from('journal_entries')
    .select('id, entry_date')
    .eq('user_id', userId)
    .gte('entry_date', sinceDate)

  if (entryError) throw entryError

  const entries = (entryRows ?? []) as { id: string; entry_date: string }[]
  if (entries.length === 0) return {}

  const entryDateById = new Map(entries.map((entry) => [entry.id, entry.entry_date]))

  const { data: responseRows, error: responseError } = await supabase
    .from('journal_responses')
    .select('field_id, entry_id, value_number')
    .in('field_id', fieldIds)
    .in(
      'entry_id',
      entries.map((entry) => entry.id)
    )
    .not('value_number', 'is', null)

  if (responseError) throw responseError

  return latestByFieldId(
    (responseRows ?? []) as {
      field_id: string
      entry_id: string
      value_number: number | null
    }[],
    entryDateById
  )
}

export async function upsertMetricTarget(
  supabase: SupabaseClient,
  userId: string,
  input: { fieldId: string; targetValue: number; direction: MetricTargetDirection }
): Promise<void> {
  const { error } = await supabase.from('metric_targets').upsert(
    {
      user_id: userId,
      field_id: input.fieldId,
      target_value: input.targetValue,
      direction: input.direction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,field_id' }
  )

  if (error) throw error
}

export async function deleteMetricTarget(
  supabase: SupabaseClient,
  userId: string,
  fieldId: string
): Promise<void> {
  const { error } = await supabase
    .from('metric_targets')
    .delete()
    .eq('user_id', userId)
    .eq('field_id', fieldId)

  if (error) throw error
}

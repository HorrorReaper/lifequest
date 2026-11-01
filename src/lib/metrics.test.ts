import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  applyStep,
  buildMetricAssistantContext,
  buildScorecardRows,
  createMetric,
  deleteMetric,
  deleteMetricValue,
  entryMetricWrites,
  fetchLatestValues,
  fetchJournalMetrics,
  fetchLinkedMetrics,
  fetchMetric,
  fetchMetricValues,
  fetchMetrics,
  fetchPreviousValues,
  fetchValuesForDate,
  formatMetricValue,
  logMetricValue,
  matchFieldsByLabel,
  metTarget,
  stepFor,
  updateMetric,
  fetchTemplateMetricLinks,
  updateMetricValue,
  validateMetricInput,
  type LatestValue,
  type Metric,
  type MetricValue,
} from './metrics'

function metric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'm-1',
    name: 'Weight',
    unit: 'kg',
    targetValue: null,
    targetDirection: null,
    templateId: null,
    templateName: null,
    templateArchived: false,
    sourceFieldId: null,
    createdAt: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

interface Call {
  table: string
  method: string
  args: unknown[]
}

/**
 * A thenable stand-in for a PostgREST query builder. Every chained call is
 * recorded; awaiting it resolves to whatever `results[table]` holds (a queue
 * when given an array, so a function can read the same table twice).
 */
function fakeClient(results: Record<string, unknown> = {}) {
  const calls: Call[] = []

  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {}
      for (const method of [
        'select',
        'insert',
        'upsert',
        'update',
        'delete',
        'eq',
        'in',
        'or',
        'gte',
        'order',
        'limit',
        'range',
        'single',
        'maybeSingle',
      ]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args })
          return builder
        }
      }
      builder.then = (resolve: (value: unknown) => unknown) => {
        const configured = results[table]
        const next = Array.isArray(configured) ? configured.shift() : configured
        return Promise.resolve(next ?? { data: null, error: null }).then(resolve)
      }
      return builder
    },
  }

  return { client: client as unknown as SupabaseClient, calls }
}

const metricRow = {
  id: 'm-1',
  user_id: 'u-1',
  name: 'Weight',
  unit: 'kg',
  target_value: 80,
  target_direction: 'at_most',
  template_id: 'tpl-1',
  source_field_id: 'field-1',
  created_at: '2026-10-01T08:00:00Z',
  updated_at: '2026-10-01T08:00:00Z',
}

describe('stepFor', () => {
  it.each([
    [null, 1],
    [0, 0.1],
    [9.9, 0.1],
    [10, 0.5],
    [99, 0.5],
    [100, 1],
    [999, 1],
    [1000, 10],
    [9999, 10],
    [10000, 100],
  ])('steps %s by %s', (latest, step) => {
    expect(stepFor(latest)).toBe(step)
  })

  it('sizes the step by magnitude, so a negative value uses its absolute size', () => {
    expect(stepFor(-50)).toBe(0.5)
  })
})

describe('applyStep', () => {
  it('rounds away float noise to the step decimals', () => {
    expect(applyStep(81.6, 0.1, -1)).toBe(81.5)
    expect(applyStep(0.2, 0.1, 1)).toBe(0.3)
  })

  it('handles whole-number steps', () => {
    expect(applyStep(8000, 500, 1)).toBe(8500)
    expect(applyStep(8000, 500, -1)).toBe(7500)
  })
})

describe('metTarget', () => {
  it('meets an at_least target at or above it', () => {
    expect(metTarget(8000, 8000, 'at_least')).toBe(true)
    expect(metTarget(9000, 8000, 'at_least')).toBe(true)
  })

  it('misses an at_least target below it', () => {
    expect(metTarget(7999, 8000, 'at_least')).toBe(false)
  })

  it('meets an at_most target at or below it', () => {
    expect(metTarget(2, 2, 'at_most')).toBe(true)
    expect(metTarget(1, 2, 'at_most')).toBe(true)
  })

  it('misses an at_most target above it', () => {
    expect(metTarget(3, 2, 'at_most')).toBe(false)
  })
})

describe('validateMetricInput', () => {
  it('requires a name', () => {
    expect(validateMetricInput({ name: '', unit: '' })).not.toBeNull()
    expect(validateMetricInput({ name: '   ', unit: '' })).not.toBeNull()
  })

  it('caps the name at 60 characters', () => {
    expect(validateMetricInput({ name: 'a'.repeat(60), unit: '' })).toBeNull()
    expect(validateMetricInput({ name: 'a'.repeat(61), unit: '' })).not.toBeNull()
  })

  it('caps the unit at 12 characters', () => {
    expect(validateMetricInput({ name: 'Weight', unit: 'a'.repeat(12) })).toBeNull()
    expect(validateMetricInput({ name: 'Weight', unit: 'a'.repeat(13) })).not.toBeNull()
  })

  it('accepts a name with no unit', () => {
    expect(validateMetricInput({ name: 'Weight', unit: '' })).toBeNull()
  })
})

describe('formatMetricValue', () => {
  it('rounds to two decimals and appends the unit', () => {
    expect(formatMetricValue(81.6, 'kg')).toBe('81.6 kg')
    expect(formatMetricValue(81.6049, 'kg')).toBe('81.6 kg')
    expect(formatMetricValue(0.125, 'kg')).toBe('0.13 kg')
  })

  it('leaves the unit off when there is none', () => {
    expect(formatMetricValue(3, null)).toBe('3')
  })
})

describe('buildScorecardRows', () => {
  const latest: Record<string, LatestValue> = {
    'm-1': { value: 3, date: '2026-10-30' },
    'm-2': { value: 70, date: '2026-10-31' },
  }

  it('gives a metric without a target null target and met', () => {
    const [row] = buildScorecardRows([metric({ id: 'm-2' })], latest)

    expect(row).toMatchObject({
      metricId: 'm-2',
      name: 'Weight',
      unit: 'kg',
      targetValue: null,
      direction: null,
      latestValue: 70,
      latestDate: '2026-10-31',
      met: null,
    })
  })

  it('marks an at_most target as missed above it', () => {
    const [row] = buildScorecardRows(
      [metric({ id: 'm-1', targetValue: 2, targetDirection: 'at_most' })],
      latest
    )

    expect(row.met).toBe(false)
    expect(row.direction).toBe('at_most')
  })

  it('has no latest value when nothing was logged', () => {
    const [row] = buildScorecardRows(
      [metric({ id: 'm-9', targetValue: 2, targetDirection: 'at_most' })],
      latest
    )

    expect(row.latestValue).toBeNull()
    expect(row.latestDate).toBeNull()
    expect(row.met).toBeNull()
  })

  it('keeps the input order', () => {
    const rows = buildScorecardRows(
      [metric({ id: 'm-2' }), metric({ id: 'm-1' }), metric({ id: 'm-9' })],
      latest
    )

    expect(rows.map((row) => row.metricId)).toEqual(['m-2', 'm-1', 'm-9'])
  })
})

describe('matchFieldsByLabel', () => {
  it('maps a field to the new field with the same label', () => {
    const result = matchFieldsByLabel(
      [{ id: 'old-1', label: 'Weight' }],
      [
        { id: 'new-1', label: 'Mood' },
        { id: 'new-2', label: 'Weight' },
      ]
    )

    expect(result.get('old-1')).toBe('new-2')
  })

  it('maps a label that is gone to null', () => {
    const result = matchFieldsByLabel(
      [{ id: 'old-1', label: 'Weight' }],
      [{ id: 'new-1', label: 'Mood' }]
    )

    expect(result.get('old-1')).toBeNull()
  })

  it('pairs duplicate labels in order, leaving extras unmatched', () => {
    const result = matchFieldsByLabel(
      [
        { id: 'old-1', label: 'Reps' },
        { id: 'old-2', label: 'Reps' },
        { id: 'old-3', label: 'Reps' },
      ],
      [
        { id: 'new-1', label: 'Reps' },
        { id: 'new-2', label: 'Reps' },
      ]
    )

    expect(result.get('old-1')).toBe('new-1')
    expect(result.get('old-2')).toBe('new-2')
    expect(result.get('old-3')).toBeNull()
  })
})

describe('entryMetricWrites', () => {
  it('takes the value of the field a metric is sourced from', () => {
    const writes = entryMetricWrites({
      linked: [metric({ id: 'm-1', sourceFieldId: 'field-1' })],
      fieldValues: { 'field-1': 81.6 },
      blockValues: {},
    })

    expect(writes).toEqual([{ metricId: 'm-1', value: 81.6 }])
  })

  it('parses a block input with a decimal comma', () => {
    const writes = entryMetricWrites({
      linked: [metric({ id: 'm-1' })],
      fieldValues: {},
      blockValues: { 'm-1': '81,6' },
    })

    expect(writes).toEqual([{ metricId: 'm-1', value: 81.6 }])
  })

  it('omits empty, unparsable and missing values', () => {
    const writes = entryMetricWrites({
      linked: [
        metric({ id: 'm-1', sourceFieldId: 'field-1' }),
        metric({ id: 'm-2' }),
        metric({ id: 'm-3' }),
        metric({ id: 'm-4', sourceFieldId: 'field-4' }),
      ],
      fieldValues: { 'field-1': null },
      blockValues: { 'm-2': '', 'm-3': 'abc' },
    })

    expect(writes).toEqual([])
  })

  it('does not read a block input for a sourced metric', () => {
    const writes = entryMetricWrites({
      linked: [metric({ id: 'm-1', sourceFieldId: 'field-1' })],
      fieldValues: { 'field-1': null },
      blockValues: { 'm-1': '5' },
    })

    expect(writes).toEqual([])
  })
})

describe('buildMetricAssistantContext', () => {
  it('keeps the 14 most recent values, newest last, with a target string', () => {
    const values: MetricValue[] = Array.from({ length: 20 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      value: i + 1,
      sourceEntryId: null,
      sourceLabel: null,
    }))

    const [context] = buildMetricAssistantContext(
      [metric({ targetValue: 80, targetDirection: 'at_most' })],
      { 'm-1': values }
    )

    expect(context.name).toBe('Weight')
    expect(context.unit).toBe('kg')
    expect(context.target).toBe('at most 80 kg')
    expect(context.recent).toHaveLength(14)
    expect(context.recent[0]).toEqual({ date: '2026-10-07', value: 7 })
    expect(context.recent[13]).toEqual({ date: '2026-10-20', value: 20 })
  })

  it('formats an at_least target and leaves the unit off when there is none', () => {
    const [context] = buildMetricAssistantContext(
      [metric({ unit: null, targetValue: 8, targetDirection: 'at_least' })],
      {}
    )

    expect(context.target).toBe('at least 8')
    expect(context.recent).toEqual([])
  })

  it('has a null target when none is set', () => {
    const [context] = buildMetricAssistantContext([metric()], {})

    expect(context.target).toBeNull()
  })
})

describe('fetchMetrics', () => {
  it('maps rows and joins the template name and archived flag', async () => {
    const { client, calls } = fakeClient({
      metrics: { data: [metricRow, { ...metricRow, id: 'm-2', template_id: null }], error: null },
      journal_templates: {
        data: [{ id: 'tpl-1', name: 'Morning', is_active: false }],
        error: null,
      },
    })

    const result = await fetchMetrics(client, 'u-1')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'm-1',
      name: 'Weight',
      unit: 'kg',
      targetValue: 80,
      targetDirection: 'at_most',
      templateId: 'tpl-1',
      templateName: 'Morning',
      templateArchived: true,
      sourceFieldId: 'field-1',
      createdAt: '2026-10-01T08:00:00Z',
    })
    expect(result[1].templateName).toBeNull()
    expect(result[1].templateArchived).toBe(false)
    expect(calls).toContainEqual({ table: 'metrics', method: 'eq', args: ['user_id', 'u-1'] })
    expect(calls).toContainEqual({
      table: 'metrics',
      method: 'order',
      args: ['created_at', { ascending: true }],
    })
  })

  it('skips the template query when no metric is linked', async () => {
    const { client, calls } = fakeClient({
      metrics: { data: [{ ...metricRow, template_id: null }], error: null },
    })

    await fetchMetrics(client, 'u-1')

    expect(calls.some((call) => call.table === 'journal_templates')).toBe(false)
  })

  it('throws on an error', async () => {
    const { client } = fakeClient({ metrics: { data: null, error: new Error('boom') } })

    await expect(fetchMetrics(client, 'u-1')).rejects.toThrow('boom')
  })
})

describe('fetchMetric', () => {
  it('returns null for a missing metric', async () => {
    const { client } = fakeClient({ metrics: { data: null, error: null } })

    expect(await fetchMetric(client, 'u-1', 'm-1')).toBeNull()
  })

  it('scopes the lookup to the user', async () => {
    const { client, calls } = fakeClient({
      metrics: { data: { ...metricRow, template_id: null }, error: null },
    })

    const result = await fetchMetric(client, 'u-1', 'm-1')

    expect(result?.id).toBe('m-1')
    expect(calls).toContainEqual({ table: 'metrics', method: 'eq', args: ['id', 'm-1'] })
    expect(calls).toContainEqual({ table: 'metrics', method: 'eq', args: ['user_id', 'u-1'] })
  })
})

describe('fetchMetricValues', () => {
  it('returns ascending values with the source template name as label', async () => {
    const { client, calls } = fakeClient({
      metric_values: {
        data: [
          { value_date: '2026-10-30', value: 81.6, source_entry_id: 'e-1' },
          { value_date: '2026-10-31', value: 81.4, source_entry_id: null },
        ],
        error: null,
      },
      journal_entries: { data: [{ id: 'e-1', template_id: 'tpl-1' }], error: null },
      journal_templates: { data: [{ id: 'tpl-1', name: 'Morning' }], error: null },
    })

    const result = await fetchMetricValues(client, 'm-1', '2026-10-01')

    expect(result).toEqual([
      { date: '2026-10-30', value: 81.6, sourceEntryId: 'e-1', sourceLabel: 'Morning' },
      { date: '2026-10-31', value: 81.4, sourceEntryId: null, sourceLabel: null },
    ])
    expect(calls).toContainEqual({
      table: 'metric_values',
      method: 'order',
      args: ['value_date', { ascending: true }],
    })
    expect(calls).toContainEqual({
      table: 'metric_values',
      method: 'gte',
      args: ['value_date', '2026-10-01'],
    })
  })

  it('has no label for a value whose entry is gone', async () => {
    const { client } = fakeClient({
      metric_values: {
        data: [{ value_date: '2026-10-30', value: 1, source_entry_id: 'e-1' }],
        error: null,
      },
      journal_entries: { data: [], error: null },
    })

    const [value] = await fetchMetricValues(client, 'm-1')

    expect(value.sourceLabel).toBeNull()
  })

  it('does not filter by date without sinceDate', async () => {
    const { client, calls } = fakeClient({ metric_values: { data: [], error: null } })

    await fetchMetricValues(client, 'm-1')

    expect(calls.some((call) => call.method === 'gte')).toBe(false)
  })
})

describe('fetchLatestValues', () => {
  it('reads the newest value of each metric with its own limit-1 query', async () => {
    const { client, calls } = fakeClient({
      metric_values: [
        { data: [{ metric_id: 'm-1', value_date: '2026-10-30', value: 81.6 }], error: null },
        { data: [{ metric_id: 'm-2', value_date: '2026-10-01', value: 5 }], error: null },
        { data: [], error: null },
      ],
    })

    const result = await fetchLatestValues(client, ['m-1', 'm-2', 'm-3'])

    expect(result).toEqual({
      'm-1': { value: 81.6, date: '2026-10-30' },
      'm-2': { value: 5, date: '2026-10-01' },
    })
    expect(calls.filter((call) => call.method === 'select')).toHaveLength(3)
    expect(calls.filter((call) => call.method === 'eq')).toEqual([
      { table: 'metric_values', method: 'eq', args: ['metric_id', 'm-1'] },
      { table: 'metric_values', method: 'eq', args: ['metric_id', 'm-2'] },
      { table: 'metric_values', method: 'eq', args: ['metric_id', 'm-3'] },
    ])
    expect(calls.filter((call) => call.method === 'order')).toEqual(
      ['m-1', 'm-2', 'm-3'].map(() => ({
        table: 'metric_values',
        method: 'order',
        args: ['value_date', { ascending: false }],
      }))
    )
    expect(calls.filter((call) => call.method === 'limit').map((call) => call.args)).toEqual([
      [1],
      [1],
      [1],
    ])
  })

  it('throws when a query fails', async () => {
    const { client } = fakeClient({ metric_values: { data: null, error: new Error('boom') } })

    await expect(fetchLatestValues(client, ['m-1'])).rejects.toThrow('boom')
  })

  it('does not query without ids', async () => {
    const { client, calls } = fakeClient()

    expect(await fetchLatestValues(client, [])).toEqual({})
    expect(calls).toHaveLength(0)
  })
})

describe('fetchValuesForDate', () => {
  it('reads one day of every given metric with a single query', async () => {
    const { client, calls } = fakeClient({
      metric_values: {
        data: [
          { metric_id: 'm-1', value: 81.6 },
          { metric_id: 'm-2', value: '5' },
        ],
        error: null,
      },
    })

    const result = await fetchValuesForDate(client, ['m-1', 'm-2', 'm-3'], '2026-10-20')

    expect(result).toEqual({ 'm-1': 81.6, 'm-2': 5 })
    expect(calls.filter((call) => call.method === 'select')).toHaveLength(1)
    expect(calls).toContainEqual({
      table: 'metric_values',
      method: 'in',
      args: ['metric_id', ['m-1', 'm-2', 'm-3']],
    })
    expect(calls).toContainEqual({
      table: 'metric_values',
      method: 'eq',
      args: ['value_date', '2026-10-20'],
    })
  })

  it('throws when the query fails', async () => {
    const { client } = fakeClient({ metric_values: { data: null, error: new Error('boom') } })

    await expect(fetchValuesForDate(client, ['m-1'], '2026-10-20')).rejects.toThrow('boom')
  })

  it('does not query without ids', async () => {
    const { client, calls } = fakeClient()

    expect(await fetchValuesForDate(client, [], '2026-10-20')).toEqual({})
    expect(calls).toHaveLength(0)
  })
})

describe('fetchLinkedMetrics', () => {
  it('matches the template or any of its fields', async () => {
    const { client, calls } = fakeClient({
      metrics: { data: [{ ...metricRow, template_id: 'tpl-1' }], error: null },
      journal_templates: { data: [{ id: 'tpl-1', name: 'Morning', is_active: true }], error: null },
    })

    const result = await fetchLinkedMetrics(client, 'u-1', 'tpl-1', ['f-1', 'f-2'])

    expect(result).toHaveLength(1)
    expect(calls).toContainEqual({
      table: 'metrics',
      method: 'or',
      args: ['template_id.eq.tpl-1,source_field_id.in.(f-1,f-2)'],
    })
    expect(calls).toContainEqual({ table: 'metrics', method: 'eq', args: ['user_id', 'u-1'] })
  })

  it('matches on the template alone without fields', async () => {
    const { client, calls } = fakeClient({ metrics: { data: [], error: null } })

    await fetchLinkedMetrics(client, 'u-1', 'tpl-1', [])

    expect(calls).toContainEqual({
      table: 'metrics',
      method: 'or',
      args: ['template_id.eq.tpl-1'],
    })
  })
})

describe('fetchJournalMetrics', () => {
  it('pairs each linked metric with its value on the entry date', async () => {
    const { client } = fakeClient({
      metrics: {
        data: [
          { ...metricRow, id: 'm-1' },
          { ...metricRow, id: 'm-2' },
        ],
        error: null,
      },
      journal_templates: { data: [{ id: 'tpl-1', name: 'Morning', is_active: true }], error: null },
      metric_values: { data: [{ metric_id: 'm-2', value: 5 }], error: null },
    })

    const result = await fetchJournalMetrics(client, 'u-1', 'tpl-1', ['f-1'], '2026-10-20')

    expect(result.map((row) => [row.metric.id, row.value])).toEqual([
      ['m-1', null],
      ['m-2', 5],
    ])
  })

  it('reads no values when nothing is linked', async () => {
    const { client, calls } = fakeClient({ metrics: { data: [], error: null } })

    expect(await fetchJournalMetrics(client, 'u-1', 'tpl-1', [], '2026-10-20')).toEqual([])
    expect(calls.some((call) => call.table === 'metric_values')).toBe(false)
  })
})

describe('writes', () => {
  it('createMetric inserts the trimmed name and a null unit when blank', async () => {
    const { client, calls } = fakeClient({
      metrics: { data: { ...metricRow, unit: null, template_id: null }, error: null },
    })

    const created = await createMetric(client, 'u-1', { name: '  Weight ', unit: ' ' })

    expect(created.id).toBe('m-1')
    expect(calls).toContainEqual({
      table: 'metrics',
      method: 'insert',
      args: [{ user_id: 'u-1', name: 'Weight', unit: null }],
    })
  })

  it('updateMetric writes only the given fields and stamps updated_at', async () => {
    const { client, calls } = fakeClient()

    await updateMetric(client, 'm-1', {
      unit: 'kg',
      targetValue: 80,
      targetDirection: 'at_most',
    })

    const update = calls.find((call) => call.method === 'update')
    expect(update?.args[0]).toMatchObject({
      unit: 'kg',
      target_value: 80,
      target_direction: 'at_most',
    })
    expect(update?.args[0]).not.toHaveProperty('template_id')
    expect(update?.args[0]).toHaveProperty('updated_at')
    expect(calls).toContainEqual({ table: 'metrics', method: 'eq', args: ['id', 'm-1'] })
  })

  it('updateMetric can clear the target', async () => {
    const { client, calls } = fakeClient()

    await updateMetric(client, 'm-1', { targetValue: null, targetDirection: null })

    const update = calls.find((call) => call.method === 'update')
    expect(update?.args[0]).toMatchObject({ target_value: null, target_direction: null })
  })

  it('updateMetric can point a metric at another source field, or at none', async () => {
    const { client, calls } = fakeClient()

    await updateMetric(client, 'm-1', { sourceFieldId: 'field-2' })
    await updateMetric(client, 'm-1', { sourceFieldId: null })

    const updates = calls.filter((call) => call.method === 'update')
    expect(updates[0].args[0]).toMatchObject({ source_field_id: 'field-2' })
    expect(updates[1].args[0]).toMatchObject({ source_field_id: null })
    expect(updates[0].args[0]).not.toHaveProperty('unit')
  })

  it('updateMetric leaves source_field_id alone when the patch has none', async () => {
    const { client, calls } = fakeClient()

    await updateMetric(client, 'm-1', { unit: 'kg' })

    const update = calls.find((call) => call.method === 'update')
    expect(update?.args[0]).not.toHaveProperty('source_field_id')
  })

  it('fetchTemplateMetricLinks reads the metrics of a template or of its fields', async () => {
    const { client, calls } = fakeClient({
      metrics: {
        data: [
          { id: 'm-1', name: 'Weight', template_id: 'tpl-1', source_field_id: 'field-1' },
          { id: 'm-2', name: 'Sleep', template_id: 'tpl-1', source_field_id: null },
        ],
        error: null,
      },
    })

    const result = await fetchTemplateMetricLinks(client, 'tpl-1', ['field-1', 'field-2'])

    expect(result).toEqual([
      { id: 'm-1', name: 'Weight', templateId: 'tpl-1', sourceFieldId: 'field-1' },
      { id: 'm-2', name: 'Sleep', templateId: 'tpl-1', sourceFieldId: null },
    ])
    expect(calls).toContainEqual({
      table: 'metrics',
      method: 'or',
      args: ['template_id.eq.tpl-1,source_field_id.in.(field-1,field-2)'],
    })
  })

  it('fetchTemplateMetricLinks asks only by template when there are no fields', async () => {
    const { client, calls } = fakeClient({ metrics: { data: [], error: null } })

    await fetchTemplateMetricLinks(client, 'tpl-1', [])

    expect(calls).toContainEqual({ table: 'metrics', method: 'eq', args: ['template_id', 'tpl-1'] })
    expect(calls.some((call) => call.method === 'or')).toBe(false)
  })

  it('deleteMetric deletes by id', async () => {
    const { client, calls } = fakeClient()

    await deleteMetric(client, 'm-1')

    expect(calls).toContainEqual({ table: 'metrics', method: 'delete', args: [] })
    expect(calls).toContainEqual({ table: 'metrics', method: 'eq', args: ['id', 'm-1'] })
  })

  it('logMetricValue upserts on metric and day', async () => {
    const { client, calls } = fakeClient()

    await logMetricValue(client, 'u-1', { metricId: 'm-1', date: '2026-11-01', value: 81.6 })

    expect(calls).toContainEqual({
      table: 'metric_values',
      method: 'upsert',
      args: [
        {
          metric_id: 'm-1',
          user_id: 'u-1',
          value_date: '2026-11-01',
          value: 81.6,
          source_entry_id: null,
        },
        { onConflict: 'metric_id,value_date' },
      ],
    })
  })

  it('logMetricValue records the source entry', async () => {
    const { client, calls } = fakeClient()

    await logMetricValue(client, 'u-1', {
      metricId: 'm-1',
      date: '2026-11-01',
      value: 81.6,
      sourceEntryId: 'e-1',
    })

    const upsert = calls.find((call) => call.method === 'upsert')
    expect(upsert?.args[0]).toMatchObject({ source_entry_id: 'e-1' })
  })

  it('updateMetricValue changes only the value of that day', async () => {
    const { client, calls } = fakeClient()

    await updateMetricValue(client, 'm-1', '2026-10-30', 80.2)

    const update = calls.find((call) => call.method === 'update')
    expect(update?.args[0]).toMatchObject({ value: 80.2 })
    expect(update?.args[0]).not.toHaveProperty('source_entry_id')
    expect(calls).toContainEqual({ table: 'metric_values', method: 'eq', args: ['metric_id', 'm-1'] })
    expect(calls).toContainEqual({
      table: 'metric_values',
      method: 'eq',
      args: ['value_date', '2026-10-30'],
    })
  })

  it('deleteMetricValue deletes one day', async () => {
    const { client, calls } = fakeClient()

    await deleteMetricValue(client, 'm-1', '2026-10-30')

    expect(calls).toContainEqual({ table: 'metric_values', method: 'delete', args: [] })
    expect(calls).toContainEqual({
      table: 'metric_values',
      method: 'eq',
      args: ['value_date', '2026-10-30'],
    })
  })

  it.each([
    ['createMetric', (c: SupabaseClient) => createMetric(c, 'u-1', { name: 'W', unit: '' })],
    ['updateMetric', (c: SupabaseClient) => updateMetric(c, 'm-1', { unit: 'kg' })],
    ['deleteMetric', (c: SupabaseClient) => deleteMetric(c, 'm-1')],
    [
      'logMetricValue',
      (c: SupabaseClient) => logMetricValue(c, 'u-1', { metricId: 'm-1', date: 'd', value: 1 }),
    ],
    ['updateMetricValue', (c: SupabaseClient) => updateMetricValue(c, 'm-1', 'd', 1)],
    ['deleteMetricValue', (c: SupabaseClient) => deleteMetricValue(c, 'm-1', 'd')],
  ])('%s throws on a Supabase error', async (_name, run) => {
    const failure = { data: null, error: new Error('rls') }
    const { client } = fakeClient({ metrics: failure, metric_values: failure })

    await expect(run(client)).rejects.toThrow('rls')
  })
})

describe('fetchPreviousValues', () => {
  it('reads the second-newest value of each metric with its own range(1, 1) query', async () => {
    const { client, calls } = fakeClient({
      metric_values: [
        { data: [{ metric_id: 'm-1', value: 82.1 }], error: null },
        { data: [], error: null },
      ],
    })

    const result = await fetchPreviousValues(client, ['m-1', 'm-2'])

    expect(result).toEqual({ 'm-1': 82.1, 'm-2': null })
    expect(calls.filter((call) => call.method === 'eq')).toEqual([
      { table: 'metric_values', method: 'eq', args: ['metric_id', 'm-1'] },
      { table: 'metric_values', method: 'eq', args: ['metric_id', 'm-2'] },
    ])
    expect(calls.filter((call) => call.method === 'order').map((call) => call.args)).toEqual([
      ['value_date', { ascending: false }],
      ['value_date', { ascending: false }],
    ])
    expect(calls.filter((call) => call.method === 'range').map((call) => call.args)).toEqual([
      [1, 1],
      [1, 1],
    ])
  })

  it('makes no query for no metrics', async () => {
    const { client, calls } = fakeClient()

    expect(await fetchPreviousValues(client, [])).toEqual({})
    expect(calls).toHaveLength(0)
  })

  it('throws when a query fails', async () => {
    const { client } = fakeClient({ metric_values: { data: null, error: new Error('boom') } })

    await expect(fetchPreviousValues(client, ['m-1'])).rejects.toThrow('boom')
  })
})

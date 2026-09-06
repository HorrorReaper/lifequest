import { describe, expect, it } from 'vitest'
import type { TrackedMetric } from '@/lib/metrics'
import {
  buildScorecardRows,
  latestByFieldId,
  metTarget,
  type MetricTarget,
} from '@/lib/metric-targets'

function metric(overrides: Partial<TrackedMetric> = {}): TrackedMetric {
  return {
    fieldId: 'field-steps',
    templateId: 'tpl-1',
    templateName: 'Daily check-in',
    label: 'Steps',
    unit: 'steps',
    ...overrides,
  }
}

function target(overrides: Partial<MetricTarget> = {}): MetricTarget {
  return {
    fieldId: 'field-steps',
    targetValue: 8000,
    direction: 'at_least',
    ...overrides,
  }
}

describe('metTarget', () => {
  it('meets an at_least target at or above it', () => {
    expect(metTarget(8000, 8000, 'at_least')).toBe(true)
    expect(metTarget(9000, 8000, 'at_least')).toBe(true)
  })

  it('misses an at_least target below it', () => {
    expect(metTarget(7999, 8000, 'at_least')).toBe(false)
  })

  it('meets an at_most target at or below it', () => {
    // Exactly two coffees against "at most two" is met, not missed.
    expect(metTarget(2, 2, 'at_most')).toBe(true)
    expect(metTarget(1, 2, 'at_most')).toBe(true)
  })

  it('misses an at_most target above it', () => {
    expect(metTarget(3, 2, 'at_most')).toBe(false)
  })
})

describe('latestByFieldId', () => {
  const dates = new Map([
    ['entry-old', '2026-08-01'],
    ['entry-new', '2026-09-01'],
  ])

  it('keeps the value from the most recent entry', () => {
    const result = latestByFieldId(
      [
        { field_id: 'field-steps', entry_id: 'entry-old', value_number: 5000 },
        { field_id: 'field-steps', entry_id: 'entry-new', value_number: 9000 },
      ],
      dates
    )

    expect(result['field-steps']).toEqual({ value: 9000, date: '2026-09-01' })
  })

  it('does not depend on the order responses arrive in', () => {
    const result = latestByFieldId(
      [
        { field_id: 'field-steps', entry_id: 'entry-new', value_number: 9000 },
        { field_id: 'field-steps', entry_id: 'entry-old', value_number: 5000 },
      ],
      dates
    )

    expect(result['field-steps']).toEqual({ value: 9000, date: '2026-09-01' })
  })

  it('keeps each field separate', () => {
    const result = latestByFieldId(
      [
        { field_id: 'field-steps', entry_id: 'entry-new', value_number: 9000 },
        { field_id: 'field-coffee', entry_id: 'entry-old', value_number: 3 },
      ],
      dates
    )

    expect(result['field-steps'].value).toBe(9000)
    expect(result['field-coffee'].value).toBe(3)
  })

  it('ignores a response with no number', () => {
    const result = latestByFieldId(
      [{ field_id: 'field-steps', entry_id: 'entry-new', value_number: null }],
      dates
    )

    expect(result['field-steps']).toBeUndefined()
  })

  it('ignores a response whose entry is not in the window', () => {
    const result = latestByFieldId(
      [{ field_id: 'field-steps', entry_id: 'entry-missing', value_number: 9000 }],
      dates
    )

    expect(result).toEqual({})
  })

  it('survives no responses at all', () => {
    expect(latestByFieldId([], dates)).toEqual({})
  })
})

describe('buildScorecardRows', () => {
  it('builds a row from a metric, its target and its latest value', () => {
    const rows = buildScorecardRows({
      metrics: [metric()],
      targets: [target()],
      latest: { 'field-steps': { value: 7400, date: '2026-09-01' } },
    })

    expect(rows).toEqual([
      {
        fieldId: 'field-steps',
        label: 'Steps',
        unit: 'steps',
        targetValue: 8000,
        direction: 'at_least',
        latestValue: 7400,
        latestDate: '2026-09-01',
        met: false,
      },
    ])
  })

  it('leaves out a tracked metric that has no target', () => {
    const rows = buildScorecardRows({
      metrics: [metric(), metric({ fieldId: 'field-coffee', label: 'Coffee' })],
      targets: [target()],
      latest: {},
    })

    expect(rows.map((row) => row.fieldId)).toEqual(['field-steps'])
  })

  it('leaves out a target whose field is no longer a tracked metric', () => {
    // The target is not deleted -- turning tracking back on restores the row.
    const rows = buildScorecardRows({
      metrics: [],
      targets: [target()],
      latest: { 'field-steps': { value: 9000, date: '2026-09-01' } },
    })

    expect(rows).toEqual([])
  })

  it('reports no value when nothing was recorded in the window', () => {
    const rows = buildScorecardRows({
      metrics: [metric()],
      targets: [target()],
      latest: {},
    })

    expect(rows[0].latestValue).toBeNull()
    expect(rows[0].latestDate).toBeNull()
    expect(rows[0].met).toBe(false)
  })

  it('follows the order of the metrics, not the targets', () => {
    const rows = buildScorecardRows({
      metrics: [
        metric({ fieldId: 'field-steps' }),
        metric({ fieldId: 'field-coffee', label: 'Coffee' }),
      ],
      targets: [
        target({ fieldId: 'field-coffee', targetValue: 2, direction: 'at_most' }),
        target({ fieldId: 'field-steps' }),
      ],
      latest: {},
    })

    expect(rows.map((row) => row.fieldId)).toEqual(['field-steps', 'field-coffee'])
  })

  it('marks a met target as met', () => {
    const rows = buildScorecardRows({
      metrics: [metric()],
      targets: [target()],
      latest: { 'field-steps': { value: 8200, date: '2026-09-01' } },
    })

    expect(rows[0].met).toBe(true)
  })
})

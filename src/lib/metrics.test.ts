import { describe, expect, it } from 'vitest'
import { shapeMetricSeries } from './metrics'

describe('shapeMetricSeries', () => {
  it('joins responses to their entry date and sorts chronologically', () => {
    const entryDateById = new Map([
      ['entry-2', '2026-07-20'],
      ['entry-1', '2026-07-18'],
    ])

    const result = shapeMetricSeries(
      [
        { entry_id: 'entry-2', value_number: 500 },
        { entry_id: 'entry-1', value_number: 250 },
      ],
      entryDateById
    )

    expect(result).toEqual([
      { date: '2026-07-18', value: 250 },
      { date: '2026-07-20', value: 500 },
    ])
  })

  it('drops responses with a null value', () => {
    const entryDateById = new Map([['entry-1', '2026-07-18']])

    const result = shapeMetricSeries(
      [{ entry_id: 'entry-1', value_number: null }],
      entryDateById
    )

    expect(result).toEqual([])
  })

  it('drops responses whose entry was outside the query window', () => {
    const entryDateById = new Map<string, string>()

    const result = shapeMetricSeries(
      [{ entry_id: 'entry-missing', value_number: 100 }],
      entryDateById
    )

    expect(result).toEqual([])
  })

  it('keeps more than one point on the same date rather than averaging them', () => {
    const entryDateById = new Map([
      ['entry-1', '2026-07-18'],
      ['entry-2', '2026-07-18'],
    ])

    const result = shapeMetricSeries(
      [
        { entry_id: 'entry-1', value_number: 100 },
        { entry_id: 'entry-2', value_number: 300 },
      ],
      entryDateById
    )

    expect(result).toHaveLength(2)
    expect(result.map((point) => point.value)).toEqual([100, 300])
  })
})

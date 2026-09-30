import { describe, expect, it } from 'vitest'
import {
  buildSignupSeries,
  cumulativeSignupSeries,
  parseSignupRange,
  signupBaseline,
  signupRangeStart,
  sumSignups,
} from '@/lib/signup-analytics'

const TODAY = '2026-09-30'

describe('signupRangeStart', () => {
  it('counts today as the last of the range, so 30 days ends today and starts 29 days back', () => {
    expect(signupRangeStart(TODAY, 30)).toBe('2026-09-01')
  })

  it('crosses month and year boundaries on date keys', () => {
    expect(signupRangeStart('2026-01-05', 10)).toBe('2025-12-27')
  })
})

describe('parseSignupRange', () => {
  it('accepts the offered ranges', () => {
    expect(parseSignupRange('90')).toBe(90)
    expect(parseSignupRange('365')).toBe(365)
  })

  it('falls back to 30 days for anything else', () => {
    expect(parseSignupRange(undefined)).toBe(30)
    expect(parseSignupRange('7')).toBe(30)
    expect(parseSignupRange('abc')).toBe(30)
    expect(parseSignupRange(['90', '365'])).toBe(90)
  })
})

describe('buildSignupSeries', () => {
  it('returns one point per day of the range, zero where nobody signed up', () => {
    const series = buildSignupSeries(
      [{ day: '2026-09-29', waitlist: 3, users: 1 }],
      '2026-09-28',
      TODAY
    )

    expect(series).toEqual([
      { date: '2026-09-28', waitlist: 0, users: 0 },
      { date: '2026-09-29', waitlist: 3, users: 1 },
      { date: '2026-09-30', waitlist: 0, users: 0 },
    ])
  })

  it('reads counts that arrive as strings, as a bigint column can', () => {
    const series = buildSignupSeries(
      [{ day: TODAY, waitlist: '12', users: '4' }],
      TODAY,
      TODAY
    )

    expect(series).toEqual([{ date: TODAY, waitlist: 12, users: 4 }])
  })

  it('drops rows outside the range and rows it cannot read, instead of throwing', () => {
    const series = buildSignupSeries(
      [
        { day: '2026-09-01', waitlist: 9, users: 9 },
        { day: 'not-a-date', waitlist: 9, users: 9 },
        { day: TODAY, waitlist: -2, users: 'x' },
        null,
      ],
      TODAY,
      TODAY
    )

    expect(series).toEqual([{ date: TODAY, waitlist: 0, users: 0 }])
  })

  it('returns an all-zero range when the RPC returned nothing usable', () => {
    expect(buildSignupSeries(null, '2026-09-29', TODAY)).toEqual([
      { date: '2026-09-29', waitlist: 0, users: 0 },
      { date: TODAY, waitlist: 0, users: 0 },
    ])
  })
})

describe('sumSignups', () => {
  it('adds each series separately', () => {
    expect(
      sumSignups([
        { date: '2026-09-29', waitlist: 3, users: 1 },
        { date: TODAY, waitlist: 2, users: 0 },
      ])
    ).toEqual({ waitlist: 5, users: 1 })
  })
})

describe('signupBaseline', () => {
  const points = [
    { date: '2026-09-29', waitlist: 3, users: 1 },
    { date: TODAY, waitlist: 2, users: 0 },
  ]

  it('is what existed before the range: the all-time total minus the range', () => {
    expect(signupBaseline({ waitlist: 40, users: 11 }, points)).toEqual({ waitlist: 35, users: 10 })
  })

  it('never goes below zero when a total was counted a moment before the series', () => {
    expect(signupBaseline({ waitlist: 4, users: 0 }, points)).toEqual({ waitlist: 0, users: 0 })
  })

  it('starts from zero when a total is unknown', () => {
    expect(signupBaseline({ waitlist: null, users: null }, points)).toEqual({ waitlist: 0, users: 0 })
  })
})

describe('cumulativeSignupSeries', () => {
  it('runs each series up from its baseline, so the last point is the all-time total', () => {
    expect(
      cumulativeSignupSeries(
        [
          { date: '2026-09-29', waitlist: 3, users: 1 },
          { date: TODAY, waitlist: 2, users: 0 },
        ],
        { waitlist: 35, users: 10 }
      )
    ).toEqual([
      { date: '2026-09-29', waitlist: 38, users: 11 },
      { date: TODAY, waitlist: 40, users: 11 },
    ])
  })
})

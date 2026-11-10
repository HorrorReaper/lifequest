import { describe, expect, it } from 'vitest'
import {
  buildLandingBreakdown,
  buildLandingSeries,
  formatRate,
  landingFunnel,
  rate,
  sumLandingDays,
} from '@/lib/landing-analytics'

describe('buildLandingSeries', () => {
  it('returns one zero-filled day per day of the range and reads bigint strings', () => {
    const days = buildLandingSeries(
      [
        { day: '2026-11-09', pageviews: '12', visitors: '9', cta_clicks: 4, cta_visitors: 3, signups: 1 },
        { day: '2026-11-10', pageviews: 2, visitors: 2, cta_clicks: 0, cta_visitors: 0, signups: 0 },
      ],
      '2026-11-08',
      '2026-11-10'
    )
    expect(days.map((day) => day.date)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10'])
    expect(days[0]).toMatchObject({ pageviews: 0, visitors: 0 })
    expect(days[1]).toEqual({
      date: '2026-11-09',
      pageviews: 12,
      visitors: 9,
      ctaClicks: 4,
      ctaVisitors: 3,
      signups: 1,
    })
  })

  it('ignores rows it cannot read and days outside the range', () => {
    const days = buildLandingSeries(
      [null, 'x', { day: 'yesterday', pageviews: 5 }, { day: '2026-01-01', pageviews: 5 }, { day: '2026-11-10', pageviews: -3 }],
      '2026-11-10',
      '2026-11-10'
    )
    expect(days).toEqual([
      { date: '2026-11-10', pageviews: 0, visitors: 0, ctaClicks: 0, ctaVisitors: 0, signups: 0 },
    ])
    expect(buildLandingSeries(null, '2026-11-09', '2026-11-10')).toHaveLength(2)
  })
})

describe('sumLandingDays and landingFunnel', () => {
  const totals = sumLandingDays(
    buildLandingSeries(
      [
        { day: '2026-11-09', pageviews: 30, visitors: 20, cta_clicks: 8, cta_visitors: 5, signups: 2 },
        { day: '2026-11-10', pageviews: 10, visitors: 5, cta_clicks: 2, cta_visitors: 1, signups: 0 },
      ],
      '2026-11-09',
      '2026-11-10'
    )
  )

  it('adds the days up', () => {
    expect(totals).toEqual({ pageviews: 40, visitors: 25, ctaClicks: 10, ctaVisitors: 6, signups: 2 })
  })

  it('expresses each funnel step as a share of visitors', () => {
    expect(landingFunnel(totals).map((step) => [step.label, step.value, step.ofVisitors])).toEqual([
      ['Visited', 25, 1],
      ['Clicked a CTA', 6, 0.24],
      ['Joined the waitlist', 2, 0.08],
    ])
  })

  it('has no rates without visitors', () => {
    const empty = landingFunnel({ pageviews: 0, visitors: 0, ctaClicks: 0, ctaVisitors: 0, signups: 1 })
    expect(empty.map((step) => step.ofVisitors)).toEqual([null, null, null])
  })
})

describe('rate and formatRate', () => {
  it('caps at 100 % and shows a dash for no rate', () => {
    expect(rate(3, 2)).toBe(1)
    expect(rate(1, 0)).toBeNull()
    expect(formatRate(null)).toBe('–')
    expect(formatRate(0)).toBe('0%')
    expect(formatRate(0.08)).toBe('8.0%')
    expect(formatRate(0.2449)).toBe('24%')
  })
})

describe('buildLandingBreakdown', () => {
  it('groups rows by dimension, names empty labels and computes shares', () => {
    const breakdown = buildLandingBreakdown([
      { dimension: 'referrer', label: null, visitors: 6, events: 8 },
      { dimension: 'referrer', label: 'reddit.com', visitors: 2, events: 2 },
      { dimension: 'device', label: 'mobile', visitors: '3', events: '4' },
      { dimension: 'cta', label: 'hero', visitors: 2, events: 5 },
      { dimension: 'bogus', label: 'x', visitors: 1, events: 1 },
    ])
    expect(breakdown.referrer).toEqual([
      { label: 'Direct / none', visitors: 6, events: 8, share: 0.75 },
      { label: 'reddit.com', visitors: 2, events: 2, share: 0.25 },
    ])
    expect(breakdown.device).toEqual([{ label: 'mobile', visitors: 3, events: 4, share: 1 }])
    expect(breakdown.cta[0]).toMatchObject({ label: 'hero', events: 5 })
    expect(breakdown.utm_source).toEqual([])
  })

  it('folds everything past the limit into Other', () => {
    const rows = ['a', 'b', 'c', 'd'].map((label, index) => ({
      dimension: 'utm_source',
      label,
      visitors: 10 - index,
      events: 10 - index,
    }))
    expect(buildLandingBreakdown(rows, 2).utm_source.map((row) => [row.label, row.visitors])).toEqual([
      ['a', 10],
      ['b', 9],
      ['Other', 15],
    ])
  })

  it('returns empty lists for anything that is not an array', () => {
    expect(buildLandingBreakdown(undefined).referrer).toEqual([])
  })
})

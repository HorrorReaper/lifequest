import { addDays, daysBetween } from '@/lib/dates'

/**
 * Landing-page traffic for the admin Tools page, from the admin_landing_daily
 * and admin_landing_breakdown RPCs
 * (supabase/migrations/20261110120000_landing_page_traffic.sql).
 *
 * Days are UTC date keys, like the signup chart beside it. Visitors are
 * counted per day: the visitor hash changes every UTC day, so a person who
 * comes back tomorrow is a new visitor tomorrow, and a range total is the sum
 * of daily visitors.
 */
export interface LandingDay {
  date: string
  pageviews: number
  visitors: number
  ctaClicks: number
  ctaVisitors: number
  signups: number
}

export type LandingTotals = Omit<LandingDay, 'date'>

export const LANDING_DIMENSIONS = ['referrer', 'utm_source', 'utm_campaign', 'device', 'cta'] as const
export type LandingDimension = (typeof LANDING_DIMENSIONS)[number]

export interface LandingBreakdownRow {
  label: string
  visitors: number
  events: number
  /** Share of this dimension's visitors, 0..1. */
  share: number
}

export type LandingBreakdown = Record<LandingDimension, LandingBreakdownRow[]>

/** How many labels a breakdown shows before folding the rest into "Other". */
export const BREAKDOWN_LIMIT = 8

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

const EMPTY_LABEL: Record<LandingDimension, string> = {
  referrer: 'Direct / none',
  utm_source: 'No UTM source',
  utm_campaign: 'No campaign',
  device: 'Unknown',
  cta: 'Unknown',
}

function count(value: unknown): number {
  // bigint columns can arrive as strings; a negative or unreadable count is
  // treated as none.
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

function emptyDay(date: string): LandingDay {
  return { date, pageviews: 0, visitors: 0, ctaClicks: 0, ctaVisitors: 0, signups: 0 }
}

/**
 * One point per day from `since` to `today`, both included, zero on days
 * without traffic. Never throws: unreadable rows and days outside the range
 * are left out.
 */
export function buildLandingSeries(rows: unknown, since: string, today: string): LandingDay[] {
  const length = Math.max(daysBetween(since, today) + 1, 0)
  const days = Array.from({ length }, (_, index) => emptyDay(addDays(since, index)))
  if (!Array.isArray(rows)) return days

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    if (typeof r.day !== 'string' || !DATE_KEY.test(r.day)) continue
    const index = daysBetween(since, r.day)
    if (index < 0 || index >= days.length) continue
    const day = days[index]
    day.pageviews += count(r.pageviews)
    day.visitors += count(r.visitors)
    day.ctaClicks += count(r.cta_clicks)
    day.ctaVisitors += count(r.cta_visitors)
    day.signups += count(r.signups)
  }

  return days
}

export function sumLandingDays(days: LandingDay[]): LandingTotals {
  return days.reduce<LandingTotals>(
    (sum, day) => ({
      pageviews: sum.pageviews + day.pageviews,
      visitors: sum.visitors + day.visitors,
      ctaClicks: sum.ctaClicks + day.ctaClicks,
      ctaVisitors: sum.ctaVisitors + day.ctaVisitors,
      signups: sum.signups + day.signups,
    }),
    { pageviews: 0, visitors: 0, ctaClicks: 0, ctaVisitors: 0, signups: 0 }
  )
}

/** part / whole, or null when there is no whole to divide by. Capped at 1. */
export function rate(part: number, whole: number): number | null {
  if (!(whole > 0)) return null
  return Math.min(Math.max(part, 0) / whole, 1)
}

export interface LandingFunnelStep {
  key: 'visitors' | 'ctaVisitors' | 'signups'
  label: string
  value: number
  /** Share of the first step (visitors), null when there were none. */
  ofVisitors: number | null
}

/**
 * Visit -> CTA click -> waitlist signup. Each step is a count of daily
 * visitors, so the steps are comparable; a signup arrives through
 * /api/waitlist and needs no CTA click of its own to be counted.
 */
export function landingFunnel(totals: LandingTotals): LandingFunnelStep[] {
  return [
    { key: 'visitors', label: 'Visited', value: totals.visitors, ofVisitors: rate(totals.visitors, totals.visitors) },
    {
      key: 'ctaVisitors',
      label: 'Clicked a CTA',
      value: totals.ctaVisitors,
      ofVisitors: rate(totals.ctaVisitors, totals.visitors),
    },
    {
      key: 'signups',
      label: 'Joined the waitlist',
      value: totals.signups,
      ofVisitors: rate(totals.signups, totals.visitors),
    },
  ]
}

/**
 * Groups the breakdown RPC's rows by dimension, names the empty label
 * (direct visits, untagged links), keeps the largest BREAKDOWN_LIMIT labels
 * and folds the rest into "Other". Shares are of the visitors in that
 * dimension's rows.
 */
export function buildLandingBreakdown(rows: unknown, limit = BREAKDOWN_LIMIT): LandingBreakdown {
  const grouped = Object.fromEntries(
    LANDING_DIMENSIONS.map((dimension) => [dimension, new Map<string, { visitors: number; events: number }>()])
  ) as Record<LandingDimension, Map<string, { visitors: number; events: number }>>

  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (typeof row !== 'object' || row === null) continue
      const r = row as Record<string, unknown>
      const dimension = r.dimension as LandingDimension
      if (!(LANDING_DIMENSIONS as readonly string[]).includes(dimension as string)) continue
      const label =
        typeof r.label === 'string' && r.label.trim().length > 0 ? r.label.trim() : EMPTY_LABEL[dimension]
      const entry = grouped[dimension].get(label) ?? { visitors: 0, events: 0 }
      entry.visitors += count(r.visitors)
      entry.events += count(r.events)
      grouped[dimension].set(label, entry)
    }
  }

  const result = {} as LandingBreakdown
  for (const dimension of LANDING_DIMENSIONS) {
    const sorted = [...grouped[dimension].entries()]
      .map(([label, value]) => ({ label, ...value }))
      .filter((row) => row.visitors > 0 || row.events > 0)
      .sort((a, b) => b.visitors - a.visitors || b.events - a.events || a.label.localeCompare(b.label))

    const kept = sorted.slice(0, limit)
    const rest = sorted.slice(limit)
    if (rest.length > 0) {
      kept.push({
        label: 'Other',
        visitors: rest.reduce((sum, row) => sum + row.visitors, 0),
        events: rest.reduce((sum, row) => sum + row.events, 0),
      })
    }

    const total = kept.reduce((sum, row) => sum + row.visitors, 0)
    result[dimension] = kept.map((row) => ({ ...row, share: rate(row.visitors, total) ?? 0 }))
  }
  return result
}

/** "12.5%" with one decimal below 10 %, whole numbers above; "–" for no rate. */
export function formatRate(value: number | null): string {
  if (value === null) return '–'
  const percent = value * 100
  return `${percent < 10 && percent > 0 ? percent.toFixed(1) : Math.round(percent)}%`
}

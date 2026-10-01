import { addDays, daysBetween } from '@/lib/dates'

/**
 * Signups over time for the admin Tools page: new waitlist entries and new
 * registered accounts per day, from the `admin_signup_series` RPC
 * (supabase/migrations/20260930120000_add_admin_signup_analytics.sql).
 *
 * Days are UTC date keys. The RPC buckets `created_at` in UTC, and there is
 * no single user timezone that would be more right for an app-wide count.
 */
export interface SignupPoint {
  date: string
  waitlist: number
  users: number
}

export interface SignupTotals {
  waitlist: number
  users: number
}

/** The ranges the Tools page offers, in days ending today. */
export const SIGNUP_RANGES = [30, 90, 365] as const
export type SignupRange = (typeof SIGNUP_RANGES)[number]

const DEFAULT_RANGE: SignupRange = 30

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Reads `?range=` from the Tools page URL; anything unexpected is 30 days. */
export function parseSignupRange(value: string | string[] | undefined): SignupRange {
  const raw = Array.isArray(value) ? value[0] : value
  const days = Number(raw)
  return (SIGNUP_RANGES as readonly number[]).includes(days) ? (days as SignupRange) : DEFAULT_RANGE
}

/** The first day of a range of `days` days that ends with (and includes) `today`. */
export function signupRangeStart(today: string, days: number): string {
  return addDays(today, -(days - 1))
}

function count(value: unknown): number {
  // bigint columns can arrive as strings; a negative or unreadable count is
  // treated as none rather than subtracted from the total.
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

/**
 * One point per day from `since` to `today`, both included, with zero on
 * days nobody signed up. The RPC only returns days that have a signup, so
 * this is where the gaps are filled. Never throws: rows it cannot read, or
 * that fall outside the range, are left out.
 */
export function buildSignupSeries(rows: unknown, since: string, today: string): SignupPoint[] {
  const length = daysBetween(since, today) + 1
  const points: SignupPoint[] = Array.from({ length: Math.max(length, 0) }, (_, index) => ({
    date: addDays(since, index),
    waitlist: 0,
    users: 0,
  }))
  if (!Array.isArray(rows)) return points

  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const { day, waitlist, users } = row as Record<string, unknown>
    if (typeof day !== 'string' || !DATE_KEY.test(day)) continue
    const index = daysBetween(since, day)
    if (index < 0 || index >= points.length) continue
    points[index].waitlist += count(waitlist)
    points[index].users += count(users)
  }

  return points
}

export function sumSignups(points: SignupPoint[]): SignupTotals {
  return points.reduce(
    (sum, point) => ({ waitlist: sum.waitlist + point.waitlist, users: sum.users + point.users }),
    { waitlist: 0, users: 0 }
  )
}

/**
 * What existed before the range began, so the cumulative line ends on the
 * real all-time total instead of starting from zero at the range's edge.
 * Derived from the totals rather than asked for separately; clamped at zero
 * because the totals and the series are two queries a moment apart.
 */
export function signupBaseline(
  totals: { waitlist: number | null; users: number | null },
  points: SignupPoint[]
): SignupTotals {
  const inRange = sumSignups(points)
  return {
    waitlist: Math.max((totals.waitlist ?? inRange.waitlist) - inRange.waitlist, 0),
    users: Math.max((totals.users ?? inRange.users) - inRange.users, 0),
  }
}

/** Running totals of each series, starting from `baseline`. */
export function cumulativeSignupSeries(points: SignupPoint[], baseline: SignupTotals): SignupPoint[] {
  let waitlist = baseline.waitlist
  let users = baseline.users
  return points.map((point) => {
    waitlist += point.waitlist
    users += point.users
    return { date: point.date, waitlist, users }
  })
}

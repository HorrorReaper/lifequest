import { addDays, weekStart, weekdayOf } from '@/lib/dates'

/**
 * The two weekly rituals: a review that closes the week on Sunday evening and
 * a plan that opens the next one on Monday.
 *
 * Both are ordinary journal templates, the way the Evening Review is, so the
 * entry form, XP, and history all come for free. Unlike the Evening Review
 * they are matched by a fixed id rather than by name, for the reason given in
 * daily-reflection.ts: a template this app seeds itself has no reason to be
 * fragile. Seeded in
 * `supabase/migrations/20260918120000_create_weekly_ritual_templates.sql`.
 */
export const WEEKLY_REVIEW_TEMPLATE_ID = '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01'
export const WEEKLY_PLAN_TEMPLATE_ID = 'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02'

const SUNDAY = 6
const MONDAY = 0

/** The earliest minute of Sunday the weekly review prompt may open at. */
export const WEEKLY_REVIEW_FROM_MINUTES = 18 * 60

/**
 * Whether the weekly review prompt may show: Sunday from 18:00 in the user's
 * own zone. Late enough that the week is essentially over, early enough to
 * come before the Evening Review at 20:00 rather than on top of it.
 */
export function isWeeklyReviewWindow(today: string, nowMinutes: number): boolean {
  return weekdayOf(today) === SUNDAY && nowMinutes >= WEEKLY_REVIEW_FROM_MINUTES
}

/** Whether the weekly plan prompt may show: any time on Monday. */
export function isWeeklyPlanWindow(today: string): boolean {
  return weekdayOf(today) === MONDAY
}

export interface WeeklyEntryLike {
  template_id: string
  entry_date: string
}

/**
 * Whether a completed entry for `templateId` already exists in the week that
 * `today` falls in (Monday through Sunday).
 *
 * Week-scoped rather than day-scoped so a review written on Sunday still
 * counts as done on Monday, and a plan written early counts for the week.
 */
export function weeklyEntryExists(
  entries: WeeklyEntryLike[],
  templateId: string,
  today: string
): boolean {
  const start = weekStart(today)
  const end = addDays(start, 6)
  return entries.some(
    (entry) =>
      entry.template_id === templateId &&
      entry.entry_date >= start &&
      entry.entry_date <= end
  )
}

/**
 * Where "Not now" on a weekly prompt is remembered. Suffixed with the week's
 * Monday rather than the day, so dismissing the review on Sunday does not
 * need repeating and the key expires on its own with the next week.
 */
export function weeklyReviewDismissKey(weekStartKey: string): string {
  return `lifequest-weekly-review-dismissed-${weekStartKey}`
}

export function weeklyPlanDismissKey(weekStartKey: string): string {
  return `lifequest-weekly-plan-dismissed-${weekStartKey}`
}

// src/lib/weekly-rituals.ts
import { addDays, weekStart } from '@/lib/dates'

/**
 * The journal templates behind the two weekly rituals, seeded in
 * `supabase/migrations/20260918120000_create_weekly_ritual_templates.sql`.
 *
 * Fixed ids rather than name lookups, for the reason given in
 * daily-reflection.ts: a template this app seeds itself has no reason to
 * be fragile. They are the defaults an admin starts from; which template a
 * prompt actually opens is read from ritual_settings (src/lib/rituals.ts).
 */
export const WEEKLY_REVIEW_TEMPLATE_ID = '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01'
export const WEEKLY_PLAN_TEMPLATE_ID = 'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02'

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
  templateId: string | null,
  today: string
): boolean {
  if (templateId === null) return false
  const start = weekStart(today)
  const end = addDays(start, 6)
  return entries.some(
    (entry) =>
      entry.template_id === templateId &&
      entry.entry_date >= start &&
      entry.entry_date <= end
  )
}

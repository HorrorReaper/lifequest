import { describe, expect, it } from 'vitest'
import {
  WEEKLY_PLAN_TEMPLATE_ID,
  WEEKLY_REVIEW_TEMPLATE_ID,
  isWeeklyPlanWindow,
  isWeeklyReviewWindow,
  weeklyEntryExists,
  weeklyPlanDismissKey,
  weeklyReviewDismissKey,
} from '@/lib/weekly-rituals'

const SUNDAY = '2026-09-20'
const MONDAY = '2026-09-21'
const TUESDAY = '2026-09-22'

describe('isWeeklyReviewWindow', () => {
  it('opens on Sunday from 18:00', () => {
    expect(isWeeklyReviewWindow(SUNDAY, 18 * 60)).toBe(true)
    expect(isWeeklyReviewWindow(SUNDAY, 23 * 60 + 59)).toBe(true)
  })

  it('stays closed on Sunday before 18:00', () => {
    expect(isWeeklyReviewWindow(SUNDAY, 17 * 60 + 59)).toBe(false)
  })

  it('stays closed on every other weekday, whatever the time', () => {
    expect(isWeeklyReviewWindow(MONDAY, 20 * 60)).toBe(false)
    expect(isWeeklyReviewWindow('2026-09-19', 20 * 60)).toBe(false) // Saturday
  })
})

describe('isWeeklyPlanWindow', () => {
  it('is open all of Monday', () => {
    expect(isWeeklyPlanWindow(MONDAY)).toBe(true)
  })

  it('is closed on other days', () => {
    expect(isWeeklyPlanWindow(SUNDAY)).toBe(false)
    expect(isWeeklyPlanWindow(TUESDAY)).toBe(false)
  })
})

describe('weeklyEntryExists', () => {
  const entries = [
    { template_id: WEEKLY_REVIEW_TEMPLATE_ID, entry_date: '2026-09-13' }, // last week's Sunday
    { template_id: WEEKLY_PLAN_TEMPLATE_ID, entry_date: MONDAY },
  ]

  it('finds an entry for the template dated inside the week of today', () => {
    expect(weeklyEntryExists(entries, WEEKLY_PLAN_TEMPLATE_ID, TUESDAY)).toBe(true)
  })

  it('ignores an entry from a previous week', () => {
    expect(weeklyEntryExists(entries, WEEKLY_REVIEW_TEMPLATE_ID, SUNDAY)).toBe(false)
  })

  it('ignores entries of other templates', () => {
    expect(weeklyEntryExists(entries, 'some-other-template', TUESDAY)).toBe(false)
  })
})

describe('dismiss keys', () => {
  it('scope the dismissal to the week, so "Not now" lasts until Monday', () => {
    expect(weeklyReviewDismissKey('2026-09-14')).toBe('lifequest-weekly-review-dismissed-2026-09-14')
    expect(weeklyPlanDismissKey('2026-09-14')).toBe('lifequest-weekly-plan-dismissed-2026-09-14')
  })
})

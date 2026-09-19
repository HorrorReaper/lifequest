import { describe, expect, it } from 'vitest'
import {
  WEEKLY_PLAN_TEMPLATE_ID,
  WEEKLY_REVIEW_TEMPLATE_ID,
  weeklyEntryExists,
} from '@/lib/weekly-rituals'

const SUNDAY = '2026-09-20'
const MONDAY = '2026-09-21'
const TUESDAY = '2026-09-22'

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

  it('is never done for a ritual without a target template', () => {
    expect(weeklyEntryExists(entries, null, TUESDAY)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { calendarHref, calendarWindow } from './calendar-window'

describe('calendar navigation', () => {
  it('shows complete Monday-first months including adjacent days', () => {
    const month = calendarWindow('2026-09-23', 'month')
    expect(month.start).toBe('2026-08-31')
    expect(month.end).toBe('2026-10-04')
    expect(month.days).toHaveLength(35)
    expect(month.days[0]).toBe(month.start)
    expect(month.days.at(-1)).toBe(month.end)
  })

  it('keeps the selected date valid when changing month or year', () => {
    const january = calendarWindow('2026-01-31', 'month')
    expect(january.previousDate).toBe('2025-12-31')
    expect(january.nextDate).toBe('2026-02-28')
    expect(calendarWindow('2028-01-31', 'month').nextDate).toBe('2028-02-29')
  })

  it('crosses daylight-saving dates in exactly seven date keys', () => {
    const week = calendarWindow('2026-10-25', 'week')
    expect(week.days).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-25',
    ])
    expect(week.nextDate).toBe('2026-11-01')
  })

  it('keeps date and view in calendar links', () => {
    expect(calendarHref('/admin/work/calendar', '2026-09-23', 'week'))
      .toBe('/admin/work/calendar?date=2026-09-23&view=week')
  })
})

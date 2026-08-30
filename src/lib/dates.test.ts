import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateFromDayNumber,
  dateInTimezone,
  dayNumber,
  formatDateOnly,
  hourInTimezone,
  localDateKey,
  parseLocalDate,
} from '@/lib/dates'

describe('dateInTimezone', () => {
  it('resolves the calendar day of the given zone, not of UTC', () => {
    // 22:30 UTC is already the next day in Berlin and still the same day in New York.
    const instant = new Date('2026-07-25T22:30:00Z')

    expect(dateInTimezone(instant, 'Europe/Berlin')).toBe('2026-07-26')
    expect(dateInTimezone(instant, 'UTC')).toBe('2026-07-25')
    expect(dateInTimezone(instant, 'America/New_York')).toBe('2026-07-25')
  })

  it('resolves the previous day for zones behind UTC just after UTC midnight', () => {
    const instant = new Date('2026-07-26T02:00:00Z')

    expect(dateInTimezone(instant, 'UTC')).toBe('2026-07-26')
    expect(dateInTimezone(instant, 'America/Los_Angeles')).toBe('2026-07-25')
  })
})

describe('hourInTimezone', () => {
  it('reports the local hour of the zone on a 0-23 clock', () => {
    const instant = new Date('2026-07-25T22:30:00Z')

    expect(hourInTimezone(instant, 'Europe/Berlin')).toBe(0)
    expect(hourInTimezone(instant, 'UTC')).toBe(22)
    expect(hourInTimezone(instant, 'America/New_York')).toBe(18)
  })

  it('reports midnight as 0 rather than 24', () => {
    expect(hourInTimezone(new Date('2026-07-25T00:00:00Z'), 'UTC')).toBe(0)
  })
})

describe('day-number arithmetic', () => {
  it('round-trips a date key', () => {
    expect(dateFromDayNumber(dayNumber('2026-07-25'))).toBe('2026-07-25')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('is unaffected by daylight-saving transitions', () => {
    // Central European DST ends on 2026-10-25; that day is still exactly one
    // day long in date-key arithmetic.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(dayNumber('2026-10-26') - dayNumber('2026-10-24')).toBe(2)
  })
})

describe('localDateKey', () => {
  it('reads the calendar fields instead of shifting through UTC', () => {
    // Local midnight in a zone ahead of UTC is the previous day in UTC, which
    // is exactly where toISOString() would lose a day.
    expect(localDateKey(new Date(2026, 6, 25, 0, 0))).toBe('2026-07-25')
    expect(localDateKey(new Date(2026, 6, 25, 23, 59))).toBe('2026-07-25')
  })
})

describe('parseLocalDate', () => {
  it('parses at local noon so a zone offset cannot move the day', () => {
    const parsed = parseLocalDate('2026-07-25')

    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(6)
    expect(parsed?.getDate()).toBe(25)
    expect(parsed?.getHours()).toBe(12)
  })

  it('rejects malformed and non-existent dates', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull()
    expect(parseLocalDate('25.07.2026')).toBeNull()
  })
})

describe('formatDateOnly', () => {
  it('formats a date key without shifting it through the runtime zone', () => {
    expect(formatDateOnly('2026-07-25', { month: 'long', day: 'numeric' })).toBe(
      'July 25'
    )
  })
})

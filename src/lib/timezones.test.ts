import { describe, expect, it } from 'vitest'
import {
  formatTimezoneLabel,
  groupedTimezoneOptions,
  timezoneOptions,
  UTC_TIMEZONE,
} from './timezones'

describe('timezoneOptions', () => {
  it('always contains the active zone so a select can render its own value', () => {
    // Europe/Vienna was absent from the previous curated list, which made the
    // picker display a value different from the one that was stored.
    expect(timezoneOptions('Europe/Vienna')).toContain('Europe/Vienna')
  })

  it('keeps an unrecognized stored zone selectable', () => {
    expect(timezoneOptions('Mars/Olympus_Mons')).toContain('Mars/Olympus_Mons')
  })

  it('always offers UTC, the profile default', () => {
    expect(timezoneOptions(null)).toContain(UTC_TIMEZONE)
  })

  it('does not duplicate a zone that is already supported', () => {
    const options = timezoneOptions('Europe/Berlin')
    expect(options.filter((zone) => zone === 'Europe/Berlin')).toHaveLength(1)
  })

  it('returns a sorted list', () => {
    const options = timezoneOptions(null)
    expect(options).toEqual([...options].sort((a, b) => a.localeCompare(b)))
  })
})

describe('groupedTimezoneOptions', () => {
  it('groups zones by IANA region', () => {
    const groups = groupedTimezoneOptions('Europe/Vienna')
    const europe = groups.find((group) => group.region === 'Europe')

    expect(europe?.zones).toContain('Europe/Vienna')
  })

  it('files single-segment zones under Other', () => {
    const groups = groupedTimezoneOptions(null)
    const other = groups.find((group) => group.region === 'Other')

    expect(other?.zones).toContain(UTC_TIMEZONE)
  })

  it('loses no option to grouping', () => {
    const flat = timezoneOptions('Europe/Vienna')
    const grouped = groupedTimezoneOptions('Europe/Vienna').flatMap(
      (group) => group.zones
    )

    expect(grouped.sort()).toEqual([...flat].sort())
  })
})

describe('formatTimezoneLabel', () => {
  it('replaces underscores for display', () => {
    expect(formatTimezoneLabel('America/New_York')).toBe('America/New York')
  })
})

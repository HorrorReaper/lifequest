import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_SECTIONS,
  isSectionVisible,
  normalizeDashboardSections,
  sectionsFor,
  visibleSectionCount,
} from '@/lib/dashboard-sections'

describe('DASHBOARD_SECTIONS', () => {
  it('lists the six sections, with routines marked admin-only', () => {
    expect(DASHBOARD_SECTIONS.map((section) => section.id)).toEqual([
      'today_plan',
      'habits',
      'tasks',
      'metric',
      'quests',
      'routines',
    ])
    expect(
      DASHBOARD_SECTIONS.filter((section) => section.adminOnly).map((s) => s.id)
    ).toEqual(['routines'])
  })

  it('gives every section a label and a description for the settings card', () => {
    for (const section of DASHBOARD_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0)
      expect(section.description.length).toBeGreaterThan(0)
    }
  })
})

describe('normalizeDashboardSections', () => {
  it('keeps the ids this build knows', () => {
    expect(normalizeDashboardSections({ habits: false, quests: true })).toEqual({
      habits: false,
      quests: true,
    })
  })

  it('drops an id this build no longer knows', () => {
    // A stored preference can outlive the section it referred to.
    expect(normalizeDashboardSections({ habits: false, city: false })).toEqual({
      habits: false,
    })
  })

  it('ignores a value that is not a boolean', () => {
    expect(normalizeDashboardSections({ habits: 'no', tasks: false })).toEqual({
      tasks: false,
    })
  })

  it('treats anything unreadable as all visible', () => {
    expect(normalizeDashboardSections(null)).toEqual({})
    expect(normalizeDashboardSections(undefined)).toEqual({})
    expect(normalizeDashboardSections('nonsense')).toEqual({})
    expect(normalizeDashboardSections(['habits'])).toEqual({})
    expect(normalizeDashboardSections(42)).toEqual({})
  })
})

describe('isSectionVisible', () => {
  it('treats a missing id as visible', () => {
    // The default has to be visible, or a section shipped after someone last
    // saved their settings would disappear for them.
    expect(isSectionVisible({}, 'habits')).toBe(true)
    expect(isSectionVisible({ tasks: false }, 'habits')).toBe(true)
  })

  it('hides only what was explicitly turned off', () => {
    expect(isSectionVisible({ habits: false }, 'habits')).toBe(false)
    expect(isSectionVisible({ habits: true }, 'habits')).toBe(true)
  })
})

describe('sectionsFor', () => {
  it('hides the admin-only section from everyone else', () => {
    const ids = sectionsFor({ isAdmin: false }).map((section) => section.id)
    expect(ids).not.toContain('routines')
    expect(ids).toHaveLength(5)
  })

  it('gives an admin the full list', () => {
    expect(sectionsFor({ isAdmin: true })).toHaveLength(6)
  })
})

describe('visibleSectionCount', () => {
  it('counts everything when nothing has been turned off', () => {
    expect(visibleSectionCount({}, { isAdmin: false })).toBe(5)
    expect(visibleSectionCount({}, { isAdmin: true })).toBe(6)
  })

  it('does not count a section the user could not see anyway', () => {
    // Routines is admin-only, so leaving it on must not keep a non-admin
    // permanently above zero and swallow the "everything is hidden" notice.
    const allOff = {
      today_plan: false,
      habits: false,
      tasks: false,
      metric: false,
      quests: false,
    }
    expect(visibleSectionCount(allOff, { isAdmin: false })).toBe(0)
    expect(visibleSectionCount(allOff, { isAdmin: true })).toBe(1)
  })
})

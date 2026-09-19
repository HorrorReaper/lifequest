import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RITUAL_SETTINGS,
  RITUAL_IDS,
  normalizeRitualSettings,
  fillName,
  isRitualWindow,
  ritualDismissKey,
} from '@/lib/rituals'
import { WEEKLY_PLAN_TEMPLATE_ID, WEEKLY_REVIEW_TEMPLATE_ID } from '@/lib/weekly-rituals'

describe('DEFAULT_RITUAL_SETTINGS', () => {
  it('matches the behaviour the dashboard hard-coded before the table existed', () => {
    expect(DEFAULT_RITUAL_SETTINGS.daily_plan).toMatchObject({ enabled: true, weekday: null, fromMinutes: 0, templateId: null })
    expect(DEFAULT_RITUAL_SETTINGS.evening_review).toMatchObject({ enabled: true, weekday: null, fromMinutes: 20 * 60, templateId: null })
    expect(DEFAULT_RITUAL_SETTINGS.weekly_review).toMatchObject({ enabled: true, weekday: 6, fromMinutes: 18 * 60, templateId: WEEKLY_REVIEW_TEMPLATE_ID })
    expect(DEFAULT_RITUAL_SETTINGS.weekly_plan).toMatchObject({ enabled: true, weekday: 0, fromMinutes: 0, templateId: WEEKLY_PLAN_TEMPLATE_ID })
  })

  it('lists the rituals in dashboard order', () => {
    expect(RITUAL_IDS).toEqual(['daily_plan', 'evening_review', 'weekly_review', 'weekly_plan'])
  })
})

describe('normalizeRitualSettings', () => {
  const row = {
    ritual: 'evening_review',
    enabled: false,
    weekday: null,
    from_minutes: 1290,
    template_id: 'tmpl-1',
    title: 'Evening, {name}',
    description: 'Wrap up.',
    cta_label: 'Go',
    updated_at: '2026-09-19T10:00:00Z',
    updated_by: null,
  }

  it('returns the defaults for every ritual when nothing was stored', () => {
    expect(normalizeRitualSettings(null)).toEqual(DEFAULT_RITUAL_SETTINGS)
    expect(normalizeRitualSettings([])).toEqual(DEFAULT_RITUAL_SETTINGS)
    expect(normalizeRitualSettings('nonsense')).toEqual(DEFAULT_RITUAL_SETTINGS)
  })

  it('maps a stored row onto the camelCase setting', () => {
    const settings = normalizeRitualSettings([row])

    expect(settings.evening_review).toEqual({
      ritual: 'evening_review',
      enabled: false,
      weekday: null,
      fromMinutes: 1290,
      templateId: 'tmpl-1',
      title: 'Evening, {name}',
      description: 'Wrap up.',
      ctaLabel: 'Go',
    })
    expect(settings.daily_plan).toEqual(DEFAULT_RITUAL_SETTINGS.daily_plan)
  })

  it('falls back per field, not per row, when a value is out of range', () => {
    const settings = normalizeRitualSettings([
      { ...row, from_minutes: 1440, weekday: 7, title: '   ', cta_label: 'Go' },
    ])

    expect(settings.evening_review.fromMinutes).toBe(DEFAULT_RITUAL_SETTINGS.evening_review.fromMinutes)
    expect(settings.evening_review.weekday).toBe(DEFAULT_RITUAL_SETTINGS.evening_review.weekday)
    expect(settings.evening_review.title).toBe(DEFAULT_RITUAL_SETTINGS.evening_review.title)
    expect(settings.evening_review.ctaLabel).toBe('Go')
    expect(settings.evening_review.enabled).toBe(false)
  })

  it('accepts weekday 0 and a null template as real values, not as missing', () => {
    const settings = normalizeRitualSettings([
      { ...row, ritual: 'weekly_plan', weekday: 0, template_id: null },
    ])

    expect(settings.weekly_plan.weekday).toBe(0)
    expect(settings.weekly_plan.templateId).toBeNull()
  })

  it('ignores rows for rituals it does not know', () => {
    const settings = normalizeRitualSettings([{ ...row, ritual: 'lunch_break' }])

    expect(settings).toEqual(DEFAULT_RITUAL_SETTINGS)
  })
})

describe('isRitualWindow', () => {
  const SUNDAY = '2026-09-20'
  const MONDAY = '2026-09-21'
  const weekly = { ...DEFAULT_RITUAL_SETTINGS.weekly_review } // Sunday from 18:00
  const daily = { ...DEFAULT_RITUAL_SETTINGS.evening_review } // every day from 20:00

  it('is closed while the ritual is disabled, whatever the time', () => {
    expect(isRitualWindow({ ...daily, enabled: false }, SUNDAY, 22 * 60)).toBe(false)
  })

  it('opens a daily ritual on any weekday once its time is reached', () => {
    expect(isRitualWindow(daily, MONDAY, 20 * 60)).toBe(true)
    expect(isRitualWindow(daily, SUNDAY, 20 * 60)).toBe(true)
    expect(isRitualWindow(daily, MONDAY, 19 * 60 + 59)).toBe(false)
  })

  it('opens a weekly ritual only on its weekday', () => {
    expect(isRitualWindow(weekly, SUNDAY, 18 * 60)).toBe(true)
    expect(isRitualWindow(weekly, SUNDAY, 17 * 60 + 59)).toBe(false)
    expect(isRitualWindow(weekly, MONDAY, 18 * 60)).toBe(false)
  })

  it('treats weekday 0 as Monday, not as "no weekday"', () => {
    expect(isRitualWindow({ ...weekly, weekday: 0, fromMinutes: 0 }, MONDAY, 0)).toBe(true)
    expect(isRitualWindow({ ...weekly, weekday: 0, fromMinutes: 0 }, SUNDAY, 0)).toBe(false)
  })
})

describe('fillName', () => {
  it('replaces every {name} with the username', () => {
    expect(fillName('Hi {name}, {name}!', 'Alex')).toBe('Hi Alex, Alex!')
  })

  it('falls back to the same default name as the dashboard hero', () => {
    expect(fillName('Hi {name}', null)).toBe('Hi Adventurer')
  })

  it('leaves text without a placeholder alone', () => {
    expect(fillName('Plan the week', 'Alex')).toBe('Plan the week')
  })

  it('treats the username literally, not as a replacement pattern', () => {
    expect(fillName('Hi {name}', '$&')).toBe('Hi $&')
  })
})

describe('ritualDismissKey', () => {
  it('names the key by ritual and period', () => {
    expect(ritualDismissKey('evening_review', '2026-09-20')).toBe('lifequest-ritual-evening_review-dismissed-2026-09-20')
    expect(ritualDismissKey('weekly_plan', '2026-09-14')).toBe('lifequest-ritual-weekly_plan-dismissed-2026-09-14')
  })
})

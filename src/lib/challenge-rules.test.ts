import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_RULES,
  formatRuleProgress,
  getChallengeRule,
  isAutomaticRule,
  isSafeInternalHref,
  isValidChallengeSlug,
  resolveDayAction,
  slugifyChallengeTitle,
  withChallengeReturn,
} from '@/lib/challenge-rules'

function day(patch: Partial<Parameters<typeof resolveDayAction>[0]> = {}) {
  return { completion_type: 'manual', completion_param: null, action_href: null, action_label: null, ...patch }
}

describe('challenge rules', () => {
  it('has exactly one manual rule, first', () => {
    expect(CHALLENGE_RULES[0].id).toBe('manual')
    expect(CHALLENGE_RULES.filter((rule) => rule.kind === 'manual')).toHaveLength(1)
  })

  it('falls back to manual for an unknown rule', () => {
    expect(getChallengeRule('nope').id).toBe('manual')
    expect(isAutomaticRule('nope')).toBe(false)
    expect(isAutomaticRule('habits_active')).toBe(true)
  })

  it('formats progress with the right noun and never past the target', () => {
    expect(formatRuleProgress('habits_active', 1, 3)).toBe('1 / 3 active habits')
    expect(formatRuleProgress('day_plans', 0, 1)).toBe('0 / 1 planned day')
    expect(formatRuleProgress('tasks_created', 7, 3)).toBe('3 / 3 new tasks')
  })
})

describe('resolveDayAction', () => {
  it('prefers the admin link and label', () => {
    expect(resolveDayAction(day({ completion_type: 'habits_active', action_href: '/plan', action_label: 'Go' }))).toEqual({
      href: '/plan',
      label: 'Go',
    })
  })

  it('uses the rule default when no link is set', () => {
    expect(resolveDayAction(day({ completion_type: 'habits_active' }))).toEqual({ href: '/habits', label: 'Open habits' })
  })

  it('links straight to the chosen tool or journal template', () => {
    expect(resolveDayAction(day({ completion_type: 'tool_entries', completion_param: 'vision' }))?.href).toBe('/learn/tools/vision')
    expect(resolveDayAction(day({ completion_type: 'journal_entries', completion_param: 'abc' }))?.href).toBe('/journal/new/abc')
  })

  it('has no button for a manual day without a link', () => {
    expect(resolveDayAction(day())).toBeNull()
  })

  it('drops a link that would leave the app', () => {
    expect(resolveDayAction(day({ action_href: '//evil.example' }))).toBeNull()
    expect(isSafeInternalHref('/\\evil.example')).toBe(false)
    expect(isSafeInternalHref('https://evil.example')).toBe(false)
    expect(isSafeInternalHref('/habits')).toBe(true)
  })
})

describe('slugs', () => {
  it('turns a title into a slug', () => {
    expect(slugifyChallengeTitle('Unfuck Your Life!')).toBe('unfuck-your-life')
    expect(slugifyChallengeTitle('  Größer   werden – 30 Tage ')).toBe('grosser-werden-30-tage')
  })

  it('validates slugs like the database does', () => {
    expect(isValidChallengeSlug('unfuck-your-life')).toBe(true)
    expect(isValidChallengeSlug('ab')).toBe(false)
    expect(isValidChallengeSlug('Unfuck')).toBe(false)
    expect(isValidChallengeSlug('double--dash')).toBe(false)
    expect(isValidChallengeSlug('-leading')).toBe(false)
  })
})

describe('withChallengeReturn', () => {
  it('tags tool links with the challenge', () => {
    expect(withChallengeReturn('/learn/tools/vision', 'tpl-1')).toBe('/learn/tools/vision?challenge=tpl-1')
    expect(withChallengeReturn('/learn/tools/time-audit?view=week', 'tpl-1')).toBe('/learn/tools/time-audit?view=week&challenge=tpl-1')
  })

  it('tags new journal entries, so a reflection day can show its question and lead back', () => {
    expect(withChallengeReturn('/journal/new/abc', 'tpl-1')).toBe('/journal/new/abc?challenge=tpl-1')
  })

  it('leaves every other link alone', () => {
    expect(withChallengeReturn('/habits', 'tpl-1')).toBe('/habits')
    expect(withChallengeReturn('/learn/tools', 'tpl-1')).toBe('/learn/tools')
  })
})

import { describe, expect, it } from 'vitest'
import {
  birthYearFromAge,
  clockFromMinutes,
  isValidAge,
  PLAN_START_HREF,
  questionSteps,
  sceneStageFor,
  startOptions,
  type OnboardingTemplate,
} from '@/lib/onboarding'

const template = (over: Partial<OnboardingTemplate>): OnboardingTemplate => ({
  id: 't',
  name: 'Free Write',
  description: 'No prompts.',
  entry_type: 'free_write',
  xp_reward: 10,
  sort_order: 4,
  ...over,
})

describe('isValidAge', () => {
  it('takes whole numbers from 13 to 120', () => {
    expect(isValidAge('13')).toBe(true)
    expect(isValidAge('120')).toBe(true)
    expect(isValidAge('12')).toBe(false)
    expect(isValidAge('121')).toBe(false)
    expect(isValidAge('2a')).toBe(false)
    expect(isValidAge('')).toBe(false)
  })
})

describe('birthYearFromAge', () => {
  it('subtracts the age from this year', () => {
    expect(birthYearFromAge(30, new Date('2026-11-18T12:00:00Z'))).toBe(1996)
  })
})

describe('questionSteps', () => {
  it('counts the questions, with or without the reminders step', () => {
    expect(questionSteps(true)).toEqual(['name', 'age', 'goal', 'reminders', 'start'])
    expect(questionSteps(false)).toEqual(['name', 'age', 'goal', 'start'])
  })
})

describe('sceneStageFor', () => {
  it('grows the scene as the answers come in', () => {
    expect(sceneStageFor('welcome')).toBe(0)
    expect(sceneStageFor('name')).toBe(0)
    expect(sceneStageFor('age')).toBe(1)
    expect(sceneStageFor('goal')).toBe(1)
    expect(sceneStageFor('reminders')).toBe(2)
    expect(sceneStageFor('done')).toBe(2)
  })
})

describe('startOptions', () => {
  it('offers the daily plan first, then each template once, in sort order', () => {
    const options = startOptions([
      template({ id: 'quick', name: 'Quick Insight', sort_order: 5 }),
      template({ id: 'morning', name: 'Morning Reflection', sort_order: 1, xp_reward: 25 }),
      template({ id: 'old-weekly', name: 'Weekly Review', sort_order: 3 }),
      template({ id: 'weekly', name: 'Weekly Review', sort_order: 101 }),
    ])

    expect(options.map((option) => option.id)).toEqual(['plan', 'morning', 'quick', 'weekly'])
    expect(options[0]).toMatchObject({ kind: 'plan', href: PLAN_START_HREF })
    expect(options[1]).toMatchObject({
      kind: 'template',
      xpReward: 25,
      href: '/journal/new/morning?firstEntry=1',
    })
  })
})

describe('clockFromMinutes', () => {
  it('writes minutes after midnight as a 24-hour time', () => {
    expect(clockFromMinutes(480)).toBe('08:00')
    expect(clockFromMinutes(1200)).toBe('20:00')
    expect(clockFromMinutes(65)).toBe('01:05')
  })
})

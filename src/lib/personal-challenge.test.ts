import { describe, expect, it } from 'vitest'
import {
  blankPersonalChallenge,
  personalChallengeReward,
  validatePersonalChallenge,
} from '@/lib/personal-challenge'

function input(patch: Partial<ReturnType<typeof blankPersonalChallenge>> = {}) {
  return { ...blankPersonalChallenge(), title: '30 days of cold showers', task: 'Take a cold shower', ...patch }
}

describe('validatePersonalChallenge', () => {
  it('accepts a complete challenge', () => {
    expect(validatePersonalChallenge(input())).toBeNull()
  })

  it('needs a title and a daily action', () => {
    expect(validatePersonalChallenge(input({ title: '  ' }))).toBe('Give your challenge a title.')
    expect(validatePersonalChallenge(input({ task: '' }))).toBe('Describe what you will do each day.')
  })

  it('keeps the daily action short enough to be a day title', () => {
    expect(validatePersonalChallenge(input({ task: 'x'.repeat(121) }))).toMatch(/120 characters/)
  })

  it('limits the length like the database does', () => {
    expect(validatePersonalChallenge(input({ days: 0 }))).toMatch(/between 1 and 365/)
    expect(validatePersonalChallenge(input({ days: 366 }))).toMatch(/between 1 and 365/)
    expect(validatePersonalChallenge(input({ days: 2.5 }))).toMatch(/between 1 and 365/)
    expect(validatePersonalChallenge(input({ days: 365 }))).toBeNull()
  })
})

describe('personalChallengeReward', () => {
  it('pays per day, as create_personal_challenge does', () => {
    expect(personalChallengeReward(30)).toEqual({ xp: 300, coins: 150 })
    expect(personalChallengeReward(Number.NaN)).toEqual({ xp: 0, coins: 0 })
  })
})

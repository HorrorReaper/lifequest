import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claimDayCompleteCelebration,
  completesHabitDay,
  releaseDayCompleteCelebration,
} from '@/lib/habit-day-complete'

function installSessionStorageStub() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  })
}

describe('completesHabitDay', () => {
  it('is true for the check-in that ticks off the last open habit', () => {
    expect(completesHabitDay({ doneBefore: 4, doneAfter: 5, total: 5 })).toBe(true)
    expect(completesHabitDay({ doneBefore: 0, doneAfter: 1, total: 1 })).toBe(true)
  })

  it('is false while habits are still open', () => {
    expect(completesHabitDay({ doneBefore: 3, doneAfter: 4, total: 5 })).toBe(false)
  })

  it('is false when the day was already complete', () => {
    expect(completesHabitDay({ doneBefore: 5, doneAfter: 5, total: 5 })).toBe(false)
  })

  it('is false without any habits', () => {
    expect(completesHabitDay({ doneBefore: 0, doneAfter: 0, total: 0 })).toBe(false)
  })
})

describe('claimDayCompleteCelebration', () => {
  beforeEach(installSessionStorageStub)

  it('lets the first completion of a day celebrate and no later one', () => {
    expect(claimDayCompleteCelebration('user-1', '2026-10-30')).toBe(true)
    expect(claimDayCompleteCelebration('user-1', '2026-10-30')).toBe(false)
  })

  it('keeps users and days apart', () => {
    expect(claimDayCompleteCelebration('user-1', '2026-10-30')).toBe(true)
    expect(claimDayCompleteCelebration('user-2', '2026-10-30')).toBe(true)
    expect(claimDayCompleteCelebration('user-1', '2026-10-31')).toBe(true)
  })

  it('can be given back when the check-in that claimed it fails to save', () => {
    expect(claimDayCompleteCelebration('user-1', '2026-10-30')).toBe(true)
    releaseDayCompleteCelebration('user-1', '2026-10-30')
    expect(claimDayCompleteCelebration('user-1', '2026-10-30')).toBe(true)
  })

  describe('without usable storage', () => {
    afterEach(installSessionStorageStub)

    it('still celebrates rather than never celebrating', () => {
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new Error('blocked')
        },
      })

      expect(claimDayCompleteCelebration('user-1', '2026-10-30')).toBe(true)
      expect(() => releaseDayCompleteCelebration('user-1', '2026-10-30')).not.toThrow()
    })
  })
})

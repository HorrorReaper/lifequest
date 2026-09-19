import { describe, expect, it } from 'vitest'
import { resolveStreak, streakMilestoneBonus } from '@/lib/streak'

const base = {
  today: '2026-07-25',
  lastJournalDate: '2026-07-24',
  currentStreak: 4,
  streakFreezes: 0,
}

describe('resolveStreak', () => {
  it('extends the streak on a consecutive day', () => {
    expect(resolveStreak(base)).toEqual({
      reason: 'continued',
      streak: 5,
      usedFreeze: false,
      brokenStreak: null,
    })
  })

  it('leaves the streak alone for a second entry on the same day', () => {
    expect(
      resolveStreak({ ...base, lastJournalDate: '2026-07-25' })
    ).toEqual({
      reason: 'same_day',
      streak: 4,
      usedFreeze: false,
      brokenStreak: null,
    })
  })

  it('starts at one for the very first entry', () => {
    expect(
      resolveStreak({ ...base, lastJournalDate: null, currentStreak: 0 })
    ).toEqual({
      reason: 'first_entry',
      streak: 1,
      usedFreeze: false,
      brokenStreak: null,
    })
  })

  it('spends a freeze to bridge exactly one missed day', () => {
    expect(
      resolveStreak({
        ...base,
        lastJournalDate: '2026-07-23',
        streakFreezes: 1,
      })
    ).toEqual({
      reason: 'frozen',
      streak: 5,
      usedFreeze: true,
      brokenStreak: null,
    })
  })

  it('resets when a day is missed and no freeze is available', () => {
    expect(
      resolveStreak({ ...base, lastJournalDate: '2026-07-23' })
    ).toEqual({
      reason: 'reset',
      streak: 1,
      usedFreeze: false,
      brokenStreak: {
        // Four days ending on the 23rd covers the 20th through the 23rd.
        length: 4,
        startedOn: '2026-07-20',
        endedOn: '2026-07-23',
      },
    })
  })

  it('does not let a freeze bridge a two-day gap', () => {
    const result = resolveStreak({
      ...base,
      lastJournalDate: '2026-07-22',
      streakFreezes: 5,
    })

    expect(result.reason).toBe('reset')
    expect(result.usedFreeze).toBe(false)
  })

  it('has no broken streak to archive when there was none to break', () => {
    expect(
      resolveStreak({
        ...base,
        lastJournalDate: '2026-07-20',
        currentStreak: 0,
      }).brokenStreak
    ).toBeNull()
  })

  it('survives a daylight-saving transition', () => {
    // Central European DST ends on 2026-10-25. The previous implementation
    // derived "yesterday" by subtracting from a wall-clock Date and reading
    // it back in UTC, which shifted across this boundary and reset a live
    // streak. Date keys make the comparison exact.
    expect(
      resolveStreak({
        ...base,
        today: '2026-10-26',
        lastJournalDate: '2026-10-25',
      }).reason
    ).toBe('continued')
  })

  it('treats a last entry dated in the future as a reset rather than a bonus', () => {
    // Reachable when a user moves their profile timezone backwards.
    const result = resolveStreak({
      ...base,
      today: '2026-07-25',
      lastJournalDate: '2026-07-26',
    })

    expect(result.reason).toBe('reset')
    expect(result.streak).toBe(1)
  })
})

describe('streakMilestoneBonus', () => {
  it('awards a bonus only on the exact milestone day', () => {
    expect(streakMilestoneBonus(7)).toBe(50)
    expect(streakMilestoneBonus(14)).toBe(100)
    expect(streakMilestoneBonus(30)).toBe(200)
    expect(streakMilestoneBonus(100)).toBe(500)
  })

  it('awards nothing between milestones', () => {
    expect(streakMilestoneBonus(6)).toBe(0)
    expect(streakMilestoneBonus(8)).toBe(0)
    expect(streakMilestoneBonus(101)).toBe(0)
  })
})

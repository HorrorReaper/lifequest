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
  const reaching = (streak: number) =>
    resolveStreak({ ...base, currentStreak: streak - 1 })

  it('awards a bonus only on the exact milestone day', () => {
    expect(streakMilestoneBonus(reaching(7))).toBe(50)
    expect(streakMilestoneBonus(reaching(14))).toBe(100)
    expect(streakMilestoneBonus(reaching(30))).toBe(200)
    expect(streakMilestoneBonus(reaching(100))).toBe(500)
  })

  it('awards nothing between milestones', () => {
    expect(streakMilestoneBonus(reaching(6))).toBe(0)
    expect(streakMilestoneBonus(reaching(8))).toBe(0)
    expect(streakMilestoneBonus(reaching(101))).toBe(0)
  })

  it('awards the bonus when a freeze carries the streak onto a milestone', () => {
    const transition = resolveStreak({
      ...base,
      lastJournalDate: '2026-07-23',
      currentStreak: 6,
      streakFreezes: 1,
    })

    expect(transition.reason).toBe('frozen')
    expect(streakMilestoneBonus(transition)).toBe(50)
  })

  it('awards nothing for a further entry on a day that already reached the milestone', () => {
    // The streak stays at 7 for every later entry that day; paying the bonus
    // on the value alone granted it once per entry.
    const transition = resolveStreak({
      ...base,
      lastJournalDate: '2026-07-25',
      currentStreak: 7,
    })

    expect(transition.reason).toBe('same_day')
    expect(streakMilestoneBonus(transition)).toBe(0)
  })
})

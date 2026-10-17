import { describe, expect, it } from 'vitest'
import {
  buildDashboardHabits,
  completedHabitIdsFor,
  habitStreakWindowStart,
  HABIT_STREAK_WINDOW_DAYS,
  openHabitsFirst,
} from '@/lib/dashboard-habits'

const habits = [
  { id: 'h1', name: 'Meditation', emoji: '🧘', skill_category: null },
  { id: 'h2', name: 'Read', emoji: null },
]

describe('buildDashboardHabits', () => {
  it('marks a habit completed only when today is logged', () => {
    const built = buildDashboardHabits(
      habits,
      [{ habit_id: 'h1', log_date: '2026-08-31' }],
      '2026-08-31'
    )

    expect(built[0].completed).toBe(true)
    expect(built[1].completed).toBe(false)
  })

  it('counts the streak through yesterday, excluding today', () => {
    const built = buildDashboardHabits(
      [habits[0]],
      [
        { habit_id: 'h1', log_date: '2026-08-29' },
        { habit_id: 'h1', log_date: '2026-08-30' },
        { habit_id: 'h1', log_date: '2026-08-31' },
      ],
      '2026-08-31'
    )

    // Today is deliberately not counted: the section adds 1 when checking off,
    // which is what makes its XP match the /habits path.
    expect(built[0].streakThroughYesterday).toBe(2)
  })

  it('reports no streak when yesterday was missed, even if today is done', () => {
    const built = buildDashboardHabits(
      [habits[0]],
      [
        { habit_id: 'h1', log_date: '2026-08-28' },
        { habit_id: 'h1', log_date: '2026-08-31' },
      ],
      '2026-08-31'
    )

    expect(built[0].streakThroughYesterday).toBe(0)
    expect(built[0].completed).toBe(true)
  })

  it("keeps each habit's logs separate", () => {
    const built = buildDashboardHabits(
      habits,
      [
        { habit_id: 'h1', log_date: '2026-08-30' },
        { habit_id: 'h2', log_date: '2026-08-29' },
      ],
      '2026-08-31'
    )

    expect(built[0].streakThroughYesterday).toBe(1)
    expect(built[1].streakThroughYesterday).toBe(0)
  })

  it('falls back to a default emoji', () => {
    expect(buildDashboardHabits(habits, [], '2026-08-31')[1].emoji).toBe('✅')
  })

  it('carries the skill category through for XP attribution', () => {
    const built = buildDashboardHabits(
      [{ id: 'h1', name: 'Run', emoji: '🏃', skill_category: 'physical_health' }],
      [],
      '2026-08-31'
    )

    expect(built[0].skillCategory).toBe('physical_health')
  })
})

describe('completedHabitIdsFor', () => {
  it('counts only today, ignoring the rest of the streak window', () => {
    const ids = completedHabitIdsFor(
      [
        { habit_id: 'h1', log_date: '2026-08-31' },
        { habit_id: 'h2', log_date: '2026-08-30' },
      ],
      '2026-08-31'
    )

    expect([...ids]).toEqual(['h1'])
  })
})

describe('habitStreakWindowStart', () => {
  it('reaches back the full streak window', () => {
    expect(habitStreakWindowStart('2026-08-31')).toBe('2025-07-27')
    expect(HABIT_STREAK_WINDOW_DAYS).toBe(400)
  })
})

describe('openHabitsFirst', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('moves done habits below the open ones, keeping both groups in order', () => {
    expect(openHabitsFirst(list, new Set(['a', 'c'])).map((h) => h.id)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('returns an unticked habit to its own place among the open ones', () => {
    expect(openHabitsFirst(list, new Set(['c'])).map((h) => h.id)).toEqual(['a', 'b', 'd', 'c'])
    expect(openHabitsFirst(list, new Set()).map((h) => h.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

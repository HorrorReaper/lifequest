import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyHabitCheckInReward } from '@/lib/habit-check-in'
import { calculateHabitCheckInXp } from '@/lib/habit-xp'

const checkInHabitReward = vi.fn()
const undoHabitCheckInReward = vi.fn()

vi.mock('@/lib/habit-xp', async () => {
  const actual = await vi.importActual<typeof import('@/lib/habit-xp')>('@/lib/habit-xp')
  return {
    ...actual,
    checkInHabitReward: (...args: unknown[]) => checkInHabitReward(...args),
    undoHabitCheckInReward: (...args: unknown[]) => undoHabitCheckInReward(...args),
  }
})

const supabase = {} as never

const base = {
  habitId: 'habit-1',
  date: '2026-08-31',
  streak: 5,
  skillCategory: null,
}

beforeEach(() => {
  checkInHabitReward.mockReset()
  undoHabitCheckInReward.mockReset()
})

describe('applyHabitCheckInReward', () => {
  it('pays streak-scaled XP when checking a habit off', async () => {
    const { xp } = calculateHabitCheckInXp(5)
    checkInHabitReward.mockResolvedValue({ totalXp: 100, coins: 30, awarded: true })

    const outcome = await applyHabitCheckInReward(supabase, {
      ...base,
      completed: true,
      wasCompleted: false,
    })

    expect(checkInHabitReward).toHaveBeenCalledWith(supabase, {
      habitId: 'habit-1',
      date: '2026-08-31',
      xp,
      skillCategory: null,
    })
    expect(outcome).toEqual({ xpDelta: xp, totalXp: 100, coins: 30 })
  })

  it('scales the reward with the streak it is given', async () => {
    checkInHabitReward.mockResolvedValue({ totalXp: 0, coins: 0, awarded: true })

    await applyHabitCheckInReward(supabase, { ...base, streak: 1, completed: true, wasCompleted: false })
    await applyHabitCheckInReward(supabase, { ...base, streak: 30, completed: true, wasCompleted: false })

    const [firstXp, secondXp] = checkInHabitReward.mock.calls.map((call) => call[1].xp)
    expect(secondXp).toBeGreaterThan(firstXp)
  })

  it('reverses the reward when unchecking, adding no XP', async () => {
    undoHabitCheckInReward.mockResolvedValue({ totalXp: 80, coins: 27, reversed: true })

    const outcome = await applyHabitCheckInReward(supabase, {
      ...base,
      completed: false,
      wasCompleted: true,
    })

    expect(undoHabitCheckInReward).toHaveBeenCalledWith(supabase, {
      habitId: 'habit-1',
      date: '2026-08-31',
    })
    expect(outcome).toEqual({ xpDelta: 0, totalXp: 80, coins: 27 })
  })

  it('pays nothing when the toggle did not change state', async () => {
    expect(
      await applyHabitCheckInReward(supabase, { ...base, completed: true, wasCompleted: true })
    ).toBeNull()
    expect(
      await applyHabitCheckInReward(supabase, { ...base, completed: false, wasCompleted: false })
    ).toBeNull()

    expect(checkInHabitReward).not.toHaveBeenCalled()
    expect(undoHabitCheckInReward).not.toHaveBeenCalled()
  })

  it('reports nothing to apply when the server already settled the reward', async () => {
    // The RPC dedupes by (user, habit, date), so a repeat check-in is a no-op
    // server-side and must not move the client's XP either.
    checkInHabitReward.mockResolvedValue({ totalXp: 100, coins: 30, awarded: false })

    expect(
      await applyHabitCheckInReward(supabase, { ...base, completed: true, wasCompleted: false })
    ).toBeNull()
  })
})

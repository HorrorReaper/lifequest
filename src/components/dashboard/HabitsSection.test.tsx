import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitsSection } from '@/components/dashboard/HabitsSection'
import type { DashboardHabit } from '@/lib/dashboard-habits'
import { calculateHabitCheckInXp } from '@/lib/habit-xp'

const setHabitLogCompletion = vi.fn()
const applyHabitCheckInReward = vi.fn()

vi.mock('@/lib/habits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/habits')>('@/lib/habits')
  return { ...actual, setHabitLogCompletion: (...a: unknown[]) => setHabitLogCompletion(...a) }
})

vi.mock('@/lib/habit-check-in', () => ({
  applyHabitCheckInReward: (...a: unknown[]) => applyHabitCheckInReward(...a),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

function habit(overrides: Partial<DashboardHabit> = {}): DashboardHabit {
  return {
    id: 'habit-1',
    name: 'Meditation',
    emoji: '🧘',
    completed: false,
    streakThroughYesterday: 4,
    skillCategory: null,
    ...overrides,
  }
}

afterEach(cleanup)

beforeEach(() => {
  setHabitLogCompletion.mockReset().mockResolvedValue({})
  applyHabitCheckInReward.mockReset().mockResolvedValue(null)
})

describe('HabitsSection', () => {
  it('lists every habit, not just the next unchecked one', () => {
    render(
      <HabitsSection
        userId="user-1"
        today="2026-08-31"
        habits={[habit(), habit({ id: 'habit-2', name: 'Read' }), habit({ id: 'habit-3', name: 'Walk' })]}
      />
    )

    expect(screen.getByRole('button', { name: /meditation/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /read/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /walk/i })).toBeTruthy()
  })

  it('counts the habits already done today', () => {
    render(
      <HabitsSection
        userId="user-1"
        today="2026-08-31"
        habits={[habit({ completed: true }), habit({ id: 'habit-2', name: 'Read' })]}
      />
    )

    expect(screen.getByText('1 of 2 today')).toBeTruthy()
  })

  it('rewards a check-in with the streak through yesterday plus today', async () => {
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[habit()]} />)

    fireEvent.click(screen.getByRole('button', { name: /meditation/i }))

    await waitFor(() =>
      expect(applyHabitCheckInReward).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ streak: 5, completed: true, wasCompleted: false })
      )
    )
  })

  it('pays what /habits pays for the same streak', async () => {
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[habit()]} />)

    fireEvent.click(screen.getByRole('button', { name: /meditation/i }))

    await waitFor(() => expect(applyHabitCheckInReward).toHaveBeenCalled())
    const { streak } = applyHabitCheckInReward.mock.calls[0][1]
    // The section never computes XP itself; passing streak = 4 + 1 is what
    // makes calculateHabitCheckInXp agree with the /habits path.
    expect(calculateHabitCheckInXp(streak).xp).toBe(calculateHabitCheckInXp(5).xp)
  })

  it('reverses the reward when unchecking', async () => {
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[habit({ completed: true })]} />)

    fireEvent.click(screen.getByRole('button', { name: /meditation/i }))

    await waitFor(() =>
      expect(applyHabitCheckInReward).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ completed: false, wasCompleted: true })
      )
    )
  })

  it('rolls the row back and explains when the write fails', async () => {
    setHabitLogCompletion.mockRejectedValue(new Error('offline'))
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[habit()]} />)

    const row = screen.getByRole('button', { name: /meditation/i })
    fireEvent.click(row)

    await waitFor(() => expect(screen.getByText('offline')).toBeTruthy())
    expect(row.getAttribute('aria-pressed')).toBe('false')
  })

  it('keeps the check-in when only the reward fails', async () => {
    applyHabitCheckInReward.mockRejectedValue(new Error('rpc down'))
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[habit()]} />)

    const row = screen.getByRole('button', { name: /meditation/i })
    fireEvent.click(row)

    await waitFor(() => expect(row.getAttribute('aria-pressed')).toBe('true'))
    expect(screen.queryByText('rpc down')).toBeNull()
  })

  it('offers a way to start when there are no habits', () => {
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[]} />)

    expect(screen.getByRole('link', { name: /add a habit/i }).getAttribute('href')).toBe('/habits')
  })
})

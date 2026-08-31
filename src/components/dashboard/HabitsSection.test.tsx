import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HabitsSection } from '@/components/dashboard/HabitsSection'
import type { DashboardHabit } from '@/lib/dashboard-habits'
import { calculateHabitCheckInXp } from '@/lib/habit-xp'

const setHabitLogCompletion = vi.fn()
const applyHabitCheckInReward = vi.fn()
const createHabit = vi.fn()

vi.mock('@/lib/habits', async () => {
  const actual = await vi.importActual<typeof import('@/lib/habits')>('@/lib/habits')
  return {
    ...actual,
    setHabitLogCompletion: (...a: unknown[]) => setHabitLogCompletion(...a),
    createHabit: (...a: unknown[]) => createHabit(...a),
  }
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
  createHabit.mockReset().mockResolvedValue({ id: 'new-habit' })
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

    expect(screen.getByRole('button', { name: /add a habit/i })).toBeTruthy()
  })

  it('opens the create dialog in place instead of routing to the habit list', async () => {
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[]} />)

    expect(screen.queryByLabelText('Name')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add a habit/i }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toBeTruthy())
  })

  it('can add a habit even when some already exist', async () => {
    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[habit()]} />)

    fireEvent.click(screen.getByRole('button', { name: /add habit/i }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toBeTruthy())
  })

  it('appends the new habit to the end of the existing order', async () => {
    render(
      <HabitsSection
        userId="user-1"
        today="2026-08-31"
        habits={[habit(), habit({ id: 'habit-2', name: 'Read' })]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /add habit/i }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Walk' } })
    fireEvent.submit(screen.getByLabelText('Name').closest('form') as HTMLFormElement)

    await waitFor(() =>
      expect(createHabit).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        expect.objectContaining({ name: 'Walk', sortOrder: 2 })
      )
    )
  })

  it('surfaces a duplicate name rather than failing silently', async () => {
    const { DuplicateHabitError } = await import('@/lib/habits')
    createHabit.mockRejectedValue(new DuplicateHabitError())

    render(<HabitsSection userId="user-1" today="2026-08-31" habits={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /add a habit/i }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Meditation' } })
    fireEvent.submit(screen.getByLabelText('Name').closest('form') as HTMLFormElement)

    await waitFor(() =>
      expect(screen.getByText(/already exists/i)).toBeTruthy()
    )
  })
})

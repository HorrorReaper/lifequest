import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GoalsDashboardWidget } from '@/components/dashboard/GoalsDashboardWidget'
import type { Goal } from '@/lib/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

const createGoal = vi.fn()
vi.mock('@/lib/goals', async () => {
  const actual = await vi.importActual<typeof import('@/lib/goals')>('@/lib/goals')
  return { ...actual, createGoal: (...args: unknown[]) => createGoal(...args) }
})

const goal: Goal = {
  id: 'goal-1',
  user_id: 'user-1',
  title: 'Run a half marathon',
  why: 'To prove I can finish what I start',
  category: 'health',
  target_date: null,
  status: 'active',
  sort_order: 0,
  completed_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

afterEach(cleanup)

describe('GoalsDashboardWidget', () => {
  it('lets a normal user manage goals without the AI suggestions', () => {
    render(<GoalsDashboardWidget userId="user-1" initialGoals={[goal]} />)

    expect(screen.getByText('Run a half marathon')).toBeTruthy()
    expect(screen.getByRole('button', { name: /complete/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /archive/i })).toBeTruthy()
    // The suggestion route answers non-admins with a 403, so offering the
    // button would only ever end in an error.
    expect(screen.queryByRole('button', { name: /generate quests/i })).toBeNull()
  })

  it('offers the AI suggestions when they are allowed', () => {
    render(
      <GoalsDashboardWidget userId="user-1" initialGoals={[goal]} canSuggestQuests />
    )

    expect(screen.getByRole('button', { name: /generate quests/i })).toBeTruthy()
  })

  it('adds a goal from the + in the header, in a dialog rather than an inline form', async () => {
    createGoal.mockResolvedValue({ ...goal, id: 'goal-2', title: 'Read 12 books', why: '' })
    render(<GoalsDashboardWidget userId="user-1" initialGoals={[goal]} />)

    expect(screen.queryByPlaceholderText(/what goal should motivate you/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add goal' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'Read 12 books' } })
    fireEvent.submit(screen.getByLabelText('Goal').closest('form')!)

    await waitFor(() =>
      expect(createGoal).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        expect.objectContaining({ title: 'Read 12 books', category: 'personal', target_date: null })
      )
    )
    expect(await screen.findByText('Read 12 books')).toBeTruthy()
  })

  it('opens the dialog straight away when a link asks for the goal form', () => {
    render(<GoalsDashboardWidget userId="user-1" initialGoals={[]} initiallyOpen />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText('Goal')).toBeTruthy()
  })

  it('offers one way in while empty: the Add Goal button, not a second + above it', () => {
    render(<GoalsDashboardWidget userId="user-1" initialGoals={[]} />)
    expect(screen.queryByRole('button', { name: 'Add goal' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

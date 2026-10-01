import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GoalsDashboardWidget } from '@/components/dashboard/GoalsDashboardWidget'
import type { Goal } from '@/lib/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

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
})

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { ManagedTask } from '@/lib/tasks'
import { TaskList } from './TaskList'

const mocks = vi.hoisted(() => ({
  fetchTasks: vi.fn(),
  toggleTask: vi.fn(),
  awardTaskCompletionXp: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  refresh: vi.fn(),
  addXp: vi.fn(),
}))

afterEach(cleanup)

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ client: true }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@/lib/stores/user-store', () => ({
  useUserStore: () => ({ addXp: mocks.addXp }),
}))

vi.mock('@/lib/tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tasks')>()
  return {
    ...original,
    fetchTasks: mocks.fetchTasks,
    toggleTask: mocks.toggleTask,
    awardTaskCompletionXp: mocks.awardTaskCompletionXp,
    createTask: mocks.createTask,
    updateTask: mocks.updateTask,
    deleteTask: mocks.deleteTask,
  }
})

const openTask: ManagedTask = {
  id: 'task-1',
  user_id: 'user-1',
  title: 'Review dashboard',
  description: 'Check compact behavior',
  is_completed: false,
  due_date: '2026-07-25',
  priority: 'high',
  created_at: '2026-07-25T08:00:00Z',
  updated_at: '2026-07-25T08:00:00Z',
}

describe('TaskList compact mode', () => {
  beforeEach(() => {
    mocks.fetchTasks.mockResolvedValue([openTask])
    mocks.toggleTask.mockResolvedValue({
      ...openTask,
      is_completed: true,
    })
    mocks.awardTaskCompletionXp.mockResolvedValue({
      awarded: false,
      previousTotal: 0,
      newTotal: 0,
    })
  })

  it('keeps the compact dashboard props and presentation working', async () => {
    render(
      <TaskList
        today="2026-07-25"
        userId="user-1"
        compact
        limit={5}
        onlyOpen
      />
    )

    expect(await screen.findByText('Review dashboard')).toBeTruthy()
    expect(mocks.fetchTasks).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { onlyOpen: true, limit: 5 }
    )
    expect(
      screen.queryByRole('tab', { name: /Today/ })
    ).toBeNull()
    expect(screen.queryByText('Check compact behavior')).toBeNull()
  })

  it('rolls back a failed completion and exposes Retry', async () => {
    const user = userEvent.setup()
    mocks.toggleTask
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ ...openTask, is_completed: true })

    render(<TaskList userId="user-1" today="2026-07-25" compact onlyOpen />)

    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Complete Review dashboard',
      })
    )

    expect((await screen.findByRole('alert')).textContent).toContain('Offline')
    expect(
      screen
        .getByRole('checkbox', { name: 'Complete Review dashboard' })
        .getAttribute('aria-checked')
    ).toBe('false')

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.toggleTask).toHaveBeenCalledTimes(2))
  })
})

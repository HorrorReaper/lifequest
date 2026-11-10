import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { FocusTimerTool } from './FocusTimerTool'
import type { TodayPlannerTask } from '@/components/planning/TodayPlanner'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockResolvedValue({ data: { id: 'session' }, error: null })
})
afterEach(cleanup)

const tasks: TodayPlannerTask[] = [
  'Write proposal',
  'Review notes',
  'Plan next sprint',
  'Reply to Alex',
].map((title, index) => ({
  id: `task-${index + 1}`,
  title,
  dueDate: null,
  priority: 'medium',
  isOverdue: false,
  estimateMinutes: null,
}))

function selectTask(title: string) {
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Search open tasks' }),
    {
      target: { value: title },
    },
  )
  fireEvent.click(screen.getByRole('option', { name: title }))
}

it('requires a commitment and starts with the chosen task IDs and duration only once', async () => {
  render(<FocusTimerTool tasks={tasks} />)
  const start = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Commit and start',
  })
  expect(start.disabled).toBe(true)
  selectTask('Review notes')
  selectTask('Write proposal')
  fireEvent.click(screen.getByRole('button', { name: '50 min' }))
  fireEvent.click(start)
  fireEvent.click(start)
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce())
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    'start_committed_focus_session',
    {
      p_planned_minutes: 50,
      p_task_ids: ['task-2', 'task-1'],
    },
  )
})

it('allows up to three distinct existing tasks and makes room when one is removed', () => {
  render(<FocusTimerTool tasks={tasks} />)
  selectTask('Write proposal')
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'Write proposal' },
  })
  expect(screen.queryByRole('option')).toBeNull()
  selectTask('Review notes')
  selectTask('Plan next sprint')
  expect(screen.queryByRole('combobox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Remove Review notes' }))
  selectTask('Reply to Alex')
  expect(
    screen.getByRole('button', { name: 'Remove Reply to Alex' }),
  ).toBeDefined()
})

it('validates custom minutes and lets a failed start be retried', async () => {
  render(<FocusTimerTool tasks={tasks} />)
  selectTask('Write proposal')
  fireEvent.change(screen.getByLabelText('Custom duration'), {
    target: { value: '241' },
  })
  expect(
    (
      screen.getByRole('button', {
        name: 'Commit and start',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true)
  fireEvent.change(screen.getByLabelText('Custom duration'), {
    target: { value: '10' },
  })
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'Offline' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Commit and start' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'could not be started',
    ),
  )
  expect(mocks.refresh).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Commit and start' }))
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
})

it('does not offer a new session after a failed load', () => {
  render(<FocusTimerTool tasks={[]} loadFailed />)
  expect(screen.queryByRole('button', { name: 'Commit and start' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(mocks.refresh).toHaveBeenCalled()
})

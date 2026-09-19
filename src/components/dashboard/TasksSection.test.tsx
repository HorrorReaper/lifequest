import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TasksSection } from '@/components/dashboard/TasksSection'
import type { DashboardTask } from '@/lib/dashboard-tasks'

const toggleTask = vi.fn()
const awardTaskCompletionXp = vi.fn()
const createTask = vi.fn()

vi.mock('@/lib/tasks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tasks')>('@/lib/tasks')
  return {
    ...actual,
    toggleTask: (...a: unknown[]) => toggleTask(...a),
    awardTaskCompletionXp: (...a: unknown[]) => awardTaskCompletionXp(...a),
    createTask: (...a: unknown[]) => createTask(...a),
  }
})

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

function task(overrides: Partial<DashboardTask> = {}): DashboardTask {
  return {
    id: 'task-1',
    title: 'Write the report',
    dueDate: '2026-08-31',
    priority: 'medium',
    isOverdue: false,
    ...overrides,
  }
}

afterEach(cleanup)

beforeEach(() => {
  toggleTask.mockReset().mockResolvedValue({})
  awardTaskCompletionXp.mockReset().mockResolvedValue({ awarded: true, previousTotal: 100 })
  createTask.mockReset().mockResolvedValue({ id: 'new-task' })
})

describe('TasksSection', () => {
  it("lists all of today's tasks, not just the top one", () => {
    render(
      <TasksSection
        userId="user-1"
        dueTasks={[task(), task({ id: 'task-2', title: 'Call the bank' })]}
        undatedTasks={[]}
        openTaskCount={2}
      />
    )

    expect(screen.getByRole('button', { name: /write the report/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /call the bank/i })).toBeTruthy()
  })

  it('separates overdue from due today in the header', () => {
    render(
      <TasksSection
        userId="user-1"
        dueTasks={[task({ isOverdue: true, dueDate: '2026-08-20' }), task({ id: 'task-2' })]}
        undatedTasks={[]}
        openTaskCount={2}
      />
    )

    expect(screen.getByText(/1 overdue/)).toBeTruthy()
    expect(screen.getByText(/1 today/)).toBeTruthy()
  })

  it('completes a task through the idempotent XP helper', async () => {
    render(
      <TasksSection userId="user-1" dueTasks={[task()]} undatedTasks={[]} openTaskCount={1} />
    )

    fireEvent.click(screen.getByRole('button', { name: /write the report/i }))

    await waitFor(() => expect(toggleTask).toHaveBeenCalledWith(expect.anything(), 'task-1', true))
    await waitFor(() =>
      expect(awardTaskCompletionXp).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        expect.objectContaining({ id: 'task-1' })
      )
    )
  })

  it('falls back to unscheduled work rather than looking empty', () => {
    render(
      <TasksSection
        userId="user-1"
        dueTasks={[]}
        undatedTasks={[task({ id: 'task-9', title: 'Someday idea', dueDate: null })]}
        openTaskCount={1}
      />
    )

    expect(screen.getByText(/nothing due today/i)).toBeTruthy()
    expect(screen.getByText(/1 unscheduled/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /someday idea/i })).toBeTruthy()
  })

  it('reads as finished when nothing is open at all', () => {
    render(<TasksSection userId="user-1" dueTasks={[]} undatedTasks={[]} openTaskCount={0} />)

    expect(screen.getByText('Nothing due today.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /add task/i })).toBeTruthy()
  })

  it('opens the create dialog in place instead of routing to the task list', async () => {
    render(<TasksSection userId="user-1" dueTasks={[]} undatedTasks={[]} openTaskCount={0} />)

    expect(screen.queryByLabelText('Task')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add task/i }))

    await waitFor(() => expect(screen.getByLabelText('Task')).toBeTruthy())
  })

  it('can add a task even when the list is not empty', async () => {
    render(
      <TasksSection userId="user-1" dueTasks={[task()]} undatedTasks={[]} openTaskCount={1} />
    )

    fireEvent.click(screen.getByRole('button', { name: /add task/i }))

    await waitFor(() => expect(screen.getByLabelText('Task')).toBeTruthy())
  })

  it('creates the task the dialog submits', async () => {
    render(<TasksSection userId="user-1" dueTasks={[]} undatedTasks={[]} openTaskCount={0} />)

    fireEvent.click(screen.getByRole('button', { name: /add task/i }))
    await waitFor(() => expect(screen.getByLabelText('Task')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Buy milk' } })
    fireEvent.submit(screen.getByLabelText('Task').closest('form') as HTMLFormElement)

    await waitFor(() =>
      expect(createTask).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        expect.objectContaining({ title: 'Buy milk' })
      )
    )
  })

  it('shows the full open count in the footer, not just the visible rows', () => {
    render(
      <TasksSection userId="user-1" dueTasks={[task()]} undatedTasks={[]} openTaskCount={14} />
    )

    expect(screen.getByRole('link', { name: /all tasks \(14\)/i })).toBeTruthy()
  })

  it('restores the row and explains when completing fails', async () => {
    toggleTask.mockRejectedValue(new Error('offline'))
    render(
      <TasksSection userId="user-1" dueTasks={[task()]} undatedTasks={[]} openTaskCount={1} />
    )

    const row = screen.getByRole('button', { name: /write the report/i })
    fireEvent.click(row)

    await waitFor(() => expect(screen.getByText('offline')).toBeTruthy())
    expect(row).toHaveProperty('disabled', false)
  })
})

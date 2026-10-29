import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextUpCard } from '@/components/dashboard/NextUpCard'
import type { PlanStatusBlock } from '@/lib/dashboard-plan'

const completeTaskWithReward = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/tasks', () => ({
  completeTaskWithReward: (...args: unknown[]) => completeTaskWithReward(...args),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const at = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const habits = [
  { id: 'h1', name: 'Meditation', completed: false },
  { id: 'h2', name: 'Read', completed: false },
  { id: 'h3', name: 'Walk', completed: false },
  { id: 'h4', name: 'Stretch', completed: true },
]

const base = {
  userId: 'user-1',
  nowMinutes: at('12:00'),
  openTaskCount: 3,
  habits,
  today: '2026-10-29',
}

const card = () => screen.getByRole('region', { name: /.+/ })

describe('NextUpCard', () => {
  it('leads a running task block with the minutes left and marks the task done', async () => {
    completeTaskWithReward.mockResolvedValue({ awarded: false, previousTotal: 0 })
    const blocks: PlanStatusBlock[] = [
      {
        id: 'b1',
        startTime: '11:30',
        endTime: '12:45',
        title: 'Write the thesis intro',
        taskId: 't1',
        taskCompleted: false,
        taskDueDate: '2026-10-29',
        source: 'task',
        priorityLabel: 'Main focus',
      },
    ]
    render(<NextUpCard {...base} blocks={blocks} />)

    expect(card().getAttribute('data-kind')).toBe('current')
    expect(screen.getByText('Now · until 12:45')).toBeTruthy()
    expect(screen.getByText('45')).toBeTruthy()
    expect(screen.getByText('min left')).toBeTruthy()
    expect(screen.getByText('Main focus · Due today · 11:30–12:45')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mark task done' }))
    await waitFor(() => expect(completeTaskWithReward).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: 'Edit plan' })).toBeTruthy()
  })

  it('offers an upcoming reflection to start early, as a quiet action', () => {
    const blocks: PlanStatusBlock[] = [
      {
        id: 'b1',
        startTime: '12:40',
        endTime: '12:50',
        title: 'Evening reflection',
        source: 'journal',
        templateId: 'tpl-1',
      },
    ]
    render(<NextUpCard {...base} blocks={blocks} />)

    expect(screen.getByText('Next at 12:40')).toBeTruthy()
    expect(screen.getByText('40')).toBeTruthy()
    expect(screen.getByText('min to go')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Start early' }).getAttribute('href')
    ).toBe('/journal/new/tpl-1')
  })

  it('counts open habits around a ring and names the first two', () => {
    render(
      <NextUpCard {...base} blocks={[{ id: 'b', startTime: '08:00', endTime: '09:00', title: 'Done' }]} />
    )

    expect(screen.getByRole('heading', { name: '3 habits still open' })).toBeTruthy()
    expect(screen.getByText('1/4')).toBeTruthy()
    expect(screen.getByText('1 of 4 habits done today.')).toBeTruthy()
    expect(screen.getByText('Meditation')).toBeTruthy()
    expect(screen.getByText('Read')).toBeTruthy()
    expect(screen.getByText('+1 more')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Check in' }).getAttribute('href')).toBe('#habits')
  })

  it('names the tasks due today when nothing is planned', () => {
    render(
      <NextUpCard
        {...base}
        blocks={[]}
        dueTodayCount={4}
        overdueCount={1}
        firstDueTitle="Send the project update"
      />
    )

    expect(screen.getByRole('heading', { name: '4 tasks due today' })).toBeTruthy()
    expect(screen.getByText('1 overdue')).toBeTruthy()
    expect(screen.getByText('Send the project update')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Plan my day' })).toBeTruthy()
  })

  it('shows a planned task left open with how many planned tasks are done', () => {
    const blocks: PlanStatusBlock[] = [
      { id: 'a', startTime: '08:00', endTime: '09:00', title: 'Prepare slides', taskId: 't1', taskCompleted: false, taskDueDate: '2026-10-30' },
      { id: 'b', startTime: '09:00', endTime: '10:00', title: 'Inbox', taskId: 't2', taskCompleted: true },
    ]
    render(<NextUpCard {...base} blocks={blocks} habits={[]} />)

    expect(screen.getByText('Planned today, still open')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Prepare slides' })).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    expect(screen.getByText('Due tomorrow')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark task done' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Replan' })).toBeTruthy()
  })

  it('points at an unwritten reflection once the habits are done, then says the journal is done', () => {
    const blocks: PlanStatusBlock[] = [{ id: 'a', startTime: '08:00', endTime: '09:00', title: 'Done' }]
    const doneHabits = habits.map((habit) => ({ ...habit, completed: true }))
    const { rerender } = render(
      <NextUpCard
        {...base}
        blocks={blocks}
        habits={doneHabits}
        reflections={[
          { templateId: 'tpl-a', title: 'Morning pages', written: true },
          { templateId: 'tpl-b', title: 'Evening reflection', written: false },
        ]}
      />
    )

    expect(screen.getByText('Reflection still open')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Evening reflection' })).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Write now' }).getAttribute('href')).toBe(
      '/journal/new/tpl-b'
    )

    rerender(
      <NextUpCard
        {...base}
        blocks={blocks}
        habits={doneHabits}
        reflections={[{ templateId: 'tpl-b', title: 'Evening reflection', written: true }]}
      />
    )
    expect(screen.getByText('Journal done for today')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Your reflection is written' })).toBeTruthy()
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import { FocusAnalytics } from './FocusAnalytics'

afterEach(cleanup)

function session(overrides: Partial<FocusSessionRow> = {}): FocusSessionRow {
  return {
    id: 'session-1',
    user_id: 'user',
    task_id: null,
    planned_minutes: 25,
    status: 'completed',
    started_at: '2026-08-27T09:00:00.000Z',
    ended_at: '2026-08-27T09:25:00.000Z',
    actual_seconds: 25 * 60,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

const taskTitles = new Map([
  ['task-1', 'Ship the paid tier'],
  ['task-2', 'Find 10 beta users'],
])

describe('FocusAnalytics', () => {
  it('leads with the minutes focused today', () => {
    render(<FocusAnalytics sessions={[session()]} taskTitles={taskTitles} />)
    expect(screen.getByTestId('focused-minutes').textContent).toContain('25')
  })

  it('shows the XP those minutes earned', () => {
    render(<FocusAnalytics sessions={[session({ actual_seconds: 50 * 60 })]} taskTitles={taskTitles} />)
    expect(screen.getByTestId('focus-xp').textContent).toContain('50')
  })

  it('shows adherence against the time that was blocked out', () => {
    render(
      <FocusAnalytics
        sessions={[session({ planned_minutes: 50, actual_seconds: 25 * 60 })]}
        taskTitles={taskTitles}
      />
    )
    expect(screen.getByTestId('focus-adherence').textContent).toContain('50%')
  })

  it('names the tasks the time went to', () => {
    render(
      <FocusAnalytics
        sessions={[session({ task_id: 'task-1', actual_seconds: 25 * 60 })]}
        taskTitles={taskTitles}
      />
    )
    expect(screen.getByTestId('focus-task-row').textContent).toContain('Ship the paid tier')
  })

  it('labels time from a session with no task rather than leaving it blank', () => {
    render(<FocusAnalytics sessions={[session({ task_id: null })]} taskTitles={taskTitles} />)
    expect(screen.getByTestId('focus-task-row').textContent).toMatch(/open focus/i)
  })

  it('still names a task that has since been deleted', () => {
    // Sessions outlive the tasks they point at, and a blank row would read
    // as a bug rather than as history.
    render(<FocusAnalytics sessions={[session({ task_id: 'gone' })]} taskTitles={taskTitles} />)
    expect(screen.getByTestId('focus-task-row').textContent).toMatch(/deleted task/i)
  })

  it('reports cancelled sessions without counting their minutes', () => {
    render(
      <FocusAnalytics
        sessions={[session({ id: 'a' }), session({ id: 'b', status: 'cancelled', actual_seconds: 60 * 60 })]}
        taskTitles={taskTitles}
      />
    )
    expect(screen.getByTestId('focused-minutes').textContent).toContain('25')
    expect(screen.getByTestId('focus-counts').textContent).toContain('1 cancelled')
  })

  it('invites a first session on a day with nothing logged', () => {
    render(<FocusAnalytics sessions={[]} taskTitles={taskTitles} />)
    expect(screen.getByText(/no focus sessions yet today/i)).toBeTruthy()
  })
})

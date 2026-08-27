import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GoalTree } from './GoalTree'
import type { GoalBreakdownPayload } from './goal-breakdown'

afterEach(cleanup)

function goal(overrides: Partial<GoalBreakdownPayload> = {}): GoalBreakdownPayload {
  return {
    kind: 'goal-breakdown',
    title: 'Become financially independent',
    why: 'Stop trading time for money',
    subGoals: [
      {
        id: 'sub-1',
        title: 'Build a €2k/mo side income',
        targetDate: null,
        actions: [
          { id: 'act-1', title: 'Ship the paid tier', done: true },
          { id: 'act-2', title: 'Find 10 beta users', done: false },
        ],
      },
    ],
    ...overrides,
  }
}

function setup(overrides: { goal?: GoalBreakdownPayload } = {}) {
  const onEdit = vi.fn()
  const onToggle = vi.fn()
  render(<GoalTree goal={overrides.goal ?? goal()} onEdit={onEdit} onToggle={onToggle} />)
  return { onEdit, onToggle }
}

describe('GoalTree', () => {
  it('shows the sub-goals and their actions', () => {
    setup()
    expect(screen.getByDisplayValue('Build a €2k/mo side income')).toBeTruthy()
    expect(screen.getByDisplayValue('Ship the paid tier')).toBeTruthy()
  })

  it('shows how far along each sub-goal is', () => {
    setup()
    expect(screen.getByTestId('subgoal-progress').textContent).toContain('1/2')
  })

  it('reflects which actions are already done', () => {
    setup()
    expect(screen.getByRole('checkbox', { name: /ship the paid tier/i }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('checkbox', { name: /find 10 beta users/i }).getAttribute('aria-checked')).toBe('false')
  })

  it('reports a tick separately from an edit, because ticking saves at once', () => {
    const { onToggle, onEdit } = setup()
    fireEvent.click(screen.getByRole('checkbox', { name: /find 10 beta users/i }))
    expect(onToggle).toHaveBeenCalledWith('sub-1', 'act-2')
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('adds a sub-goal', () => {
    const { onEdit } = setup()
    fireEvent.change(screen.getByLabelText('New sub-goal'), { target: { value: 'Cut fixed costs' } })
    fireEvent.click(screen.getByRole('button', { name: /add sub-goal/i }))
    const next = onEdit.mock.calls[0][0] as GoalBreakdownPayload
    expect(next.subGoals.map((sub) => sub.title)).toContain('Cut fixed costs')
  })

  it('refuses to add a sub-goal with no title', () => {
    const { onEdit } = setup()
    fireEvent.click(screen.getByRole('button', { name: /add sub-goal/i }))
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('adds an action under the right sub-goal', () => {
    const { onEdit } = setup()
    fireEvent.change(screen.getByLabelText(/new action under build/i), {
      target: { value: 'Write the pricing page' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add action under build/i }))
    const next = onEdit.mock.calls[0][0] as GoalBreakdownPayload
    expect(next.subGoals[0].actions.map((action) => action.title)).toContain('Write the pricing page')
  })

  it('renames a sub-goal', () => {
    const { onEdit } = setup()
    fireEvent.change(screen.getByDisplayValue('Build a €2k/mo side income'), {
      target: { value: 'Build a €3k/mo side income' },
    })
    const next = onEdit.mock.calls[0][0] as GoalBreakdownPayload
    expect(next.subGoals[0].title).toBe('Build a €3k/mo side income')
  })

  it('renames an action', () => {
    const { onEdit } = setup()
    fireEvent.change(screen.getByDisplayValue('Find 10 beta users'), {
      target: { value: 'Find 20 beta users' },
    })
    const next = onEdit.mock.calls[0][0] as GoalBreakdownPayload
    expect(next.subGoals[0].actions[1].title).toBe('Find 20 beta users')
  })

  it('removes a sub-goal along with its actions', () => {
    const { onEdit } = setup()
    fireEvent.click(screen.getByRole('button', { name: /remove sub-goal build/i }))
    const next = onEdit.mock.calls[0][0] as GoalBreakdownPayload
    expect(next.subGoals).toEqual([])
  })

  it('removes a single action', () => {
    const { onEdit } = setup()
    fireEvent.click(screen.getByRole('button', { name: /remove action find 10 beta users/i }))
    const next = onEdit.mock.calls[0][0] as GoalBreakdownPayload
    expect(next.subGoals[0].actions.map((action) => action.id)).toEqual(['act-1'])
  })

  it('asks for a first sub-goal when the goal has not been broken down yet', () => {
    setup({ goal: goal({ subGoals: [] }) })
    expect(screen.getByText(/what has to be true/i)).toBeTruthy()
  })
})

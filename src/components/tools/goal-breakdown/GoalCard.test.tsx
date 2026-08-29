import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GoalCard } from './GoalCard'
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

function setup(
  overrides: { goal?: GoalBreakdownPayload; dirty?: boolean; defaultExpanded?: boolean } = {}
) {
  const onEdit = vi.fn()
  const onToggleAction = vi.fn()
  const onSave = vi.fn()
  const onDelete = vi.fn()
  render(
    <GoalCard
      goal={overrides.goal ?? goal()}
      dirty={overrides.dirty ?? false}
      saving={false}
      defaultExpanded={overrides.defaultExpanded ?? true}
      onEdit={onEdit}
      onToggleAction={onToggleAction}
      onSave={onSave}
      onDelete={onDelete}
    />
  )
  return { onEdit, onToggleAction, onSave, onDelete }
}

describe('GoalCard', () => {
  it('shows the goal and the reason behind it', () => {
    setup()
    expect(screen.getByDisplayValue('Become financially independent')).toBeTruthy()
    expect(screen.getByDisplayValue('Stop trading time for money')).toBeTruthy()
  })

  it('shows overall progress across every sub-goal', () => {
    setup()
    expect(screen.getByTestId('goal-progress').textContent).toContain('1/2')
  })

  it('reads as not started rather than as zero percent before any action exists', () => {
    // A goal written a minute ago must not look like a goal being failed.
    setup({ goal: goal({ subGoals: [] }) })
    expect(screen.getByTestId('goal-progress').textContent).toMatch(/not started/i)
  })

  it('hides the breakdown until the goal is opened', () => {
    setup({ defaultExpanded: false })
    expect(screen.queryByLabelText('New sub-goal')).toBeNull()
  })

  it('reveals the breakdown when opened', () => {
    setup({ defaultExpanded: false })
    fireEvent.click(screen.getByRole('button', { name: /open become financially independent/i }))
    expect(screen.getByLabelText('New sub-goal')).toBeTruthy()
  })

  it('reports a retitled goal', () => {
    const { onEdit } = setup()
    fireEvent.change(screen.getByDisplayValue('Become financially independent'), {
      target: { value: 'Reach financial independence' },
    })
    expect((onEdit.mock.calls[0][0] as GoalBreakdownPayload).title).toBe(
      'Reach financial independence'
    )
  })

  it('reports a rewritten reason', () => {
    const { onEdit } = setup()
    fireEvent.change(screen.getByDisplayValue('Stop trading time for money'), {
      target: { value: 'Buy back my time' },
    })
    expect((onEdit.mock.calls[0][0] as GoalBreakdownPayload).why).toBe('Buy back my time')
  })

  it('has nothing to save until something changes', () => {
    setup({ dirty: false })
    expect(screen.getByRole('button', { name: /^save/i }).hasAttribute('disabled')).toBe(true)
  })

  it('saves when there are unsaved changes', () => {
    const { onSave } = setup({ dirty: true })
    fireEvent.click(screen.getByRole('button', { name: /^save/i }))
    expect(onSave).toHaveBeenCalled()
  })

  it('deletes the goal', () => {
    const { onDelete } = setup()
    fireEvent.click(screen.getByRole('button', { name: /delete become financially independent/i }))
    expect(onDelete).toHaveBeenCalled()
  })
})

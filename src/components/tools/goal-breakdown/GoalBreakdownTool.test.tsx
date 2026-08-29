import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ToolEntry } from '@/lib/tools/storage'
import { GoalBreakdownTool } from './GoalBreakdownTool'
import type { GoalBreakdownPayload } from './goal-breakdown'

const mocks = vi.hoisted(() => ({
  createToolEntry: vi.fn(),
  updateToolEntry: vi.fn(),
  deleteToolEntry: vi.fn(),
  fetchToolEntries: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))

vi.mock('@/lib/tools/storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tools/storage')>()
  return { ...original, ...mocks }
})

afterEach(cleanup)

beforeEach(() => {
  mocks.createToolEntry.mockResolvedValue({})
  mocks.updateToolEntry.mockResolvedValue(undefined)
  mocks.deleteToolEntry.mockResolvedValue(undefined)
  mocks.fetchToolEntries.mockResolvedValue([])
})

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
        actions: [{ id: 'act-1', title: 'Find 10 beta users', done: false }],
      },
    ],
    ...overrides,
  }
}

function entry(payload: unknown, id = 'goal-1'): ToolEntry {
  return { id, toolId: 'goal-breakdown', runId: null, payload, createdAt: '', updatedAt: '' }
}

function open() {
  fireEvent.click(screen.getByRole('button', { name: /open become financially independent/i }))
}

describe('GoalBreakdownTool', () => {
  it('invites a first goal when there is nothing yet', () => {
    render(<GoalBreakdownTool userId="user" initialEntries={[]} />)
    expect(screen.getByText(/no goals yet/i)).toBeTruthy()
  })

  it('creates a goal from the title and reason given', async () => {
    render(<GoalBreakdownTool userId="user" initialEntries={[]} />)
    fireEvent.change(screen.getByLabelText(/new goal/i), { target: { value: 'Run a sub-3h marathon' } })
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))

    await waitFor(() => expect(mocks.createToolEntry).toHaveBeenCalled())
    const payload = mocks.createToolEntry.mock.calls[0][3] as GoalBreakdownPayload
    expect(payload).toMatchObject({ kind: 'goal-breakdown', title: 'Run a sub-3h marathon', subGoals: [] })
  })

  it('refuses to create a goal with no title', () => {
    render(<GoalBreakdownTool userId="user" initialEntries={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))
    expect(mocks.createToolEntry).not.toHaveBeenCalled()
  })

  it('reports the save upwards, so an embedding lesson can unlock', async () => {
    const onUsed = vi.fn()
    render(<GoalBreakdownTool userId="user" initialEntries={[]} onUsed={onUsed} />)
    fireEvent.change(screen.getByLabelText(/new goal/i), { target: { value: 'Learn Japanese' } })
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }))
    await waitFor(() => expect(onUsed).toHaveBeenCalled())
  })

  it('lists the goals already written', () => {
    render(<GoalBreakdownTool userId="user" initialEntries={[entry(goal())]} />)
    expect(screen.getByDisplayValue('Become financially independent')).toBeTruthy()
  })

  it('ignores rows another tool wrote to the shared table', () => {
    render(
      <GoalBreakdownTool
        userId="user"
        initialEntries={[entry({ statement: 'Vision' }, 'foreign'), entry(goal())]}
      />
    )
    expect(screen.getAllByTestId('goal-progress')).toHaveLength(1)
  })

  it('saves an edited goal against its own row', async () => {
    render(<GoalBreakdownTool userId="user" initialEntries={[entry(goal())]} />)
    open()
    fireEvent.change(screen.getByDisplayValue('Become financially independent'), {
      target: { value: 'Reach financial independence' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save goal/i }))

    await waitFor(() => expect(mocks.updateToolEntry).toHaveBeenCalled())
    expect(mocks.updateToolEntry.mock.calls[0][1]).toBe('goal-1')
    expect((mocks.updateToolEntry.mock.calls[0][2] as GoalBreakdownPayload).title).toBe(
      'Reach financial independence'
    )
  })

  it('writes a ticked action straight away, without waiting for Save', async () => {
    render(<GoalBreakdownTool userId="user" initialEntries={[entry(goal())]} />)
    open()
    fireEvent.click(screen.getByRole('checkbox', { name: /find 10 beta users/i }))

    await waitFor(() => expect(mocks.updateToolEntry).toHaveBeenCalled())
    const saved = mocks.updateToolEntry.mock.calls[0][2] as GoalBreakdownPayload
    expect(saved.subGoals[0].actions[0].done).toBe(true)
  })

  it('carries pending text edits along when an action is ticked, so nothing is lost', async () => {
    // Ticking persists the whole working copy. Saving only the tick would
    // mean the row on the server disagrees with what is on screen.
    render(<GoalBreakdownTool userId="user" initialEntries={[entry(goal())]} />)
    open()
    fireEvent.change(screen.getByDisplayValue('Become financially independent'), {
      target: { value: 'Reach financial independence' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /find 10 beta users/i }))

    await waitFor(() => expect(mocks.updateToolEntry).toHaveBeenCalled())
    const saved = mocks.updateToolEntry.mock.calls[0][2] as GoalBreakdownPayload
    expect(saved.title).toBe('Reach financial independence')
    expect(saved.subGoals[0].actions[0].done).toBe(true)
  })

  it('deletes a goal', async () => {
    render(<GoalBreakdownTool userId="user" initialEntries={[entry(goal())]} />)
    fireEvent.click(screen.getByRole('button', { name: /delete become financially independent/i }))
    await waitFor(() => expect(mocks.deleteToolEntry).toHaveBeenCalledWith(expect.anything(), 'goal-1'))
  })

  it('keeps the edited goal on screen when the save fails', async () => {
    mocks.updateToolEntry.mockRejectedValue(new Error('offline'))
    render(<GoalBreakdownTool userId="user" initialEntries={[entry(goal())]} />)
    open()
    fireEvent.change(screen.getByDisplayValue('Become financially independent'), {
      target: { value: 'Reach financial independence' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save goal/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByDisplayValue('Reach financial independence')).toBeTruthy()
  })
})

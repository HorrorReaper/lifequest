import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ToolEntry } from '@/lib/tools/storage'
import { TimeAuditTool } from './TimeAuditTool'
import { BLOCKS_PER_DAY, paintRange, seedCategories, type TimeAuditPayload } from './time-audit'

const mocks = vi.hoisted(() => ({
  createToolEntry: vi.fn(),
  updateToolEntry: vi.fn(),
  fetchToolEntries: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))

vi.mock('@/lib/tools/storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tools/storage')>()
  return {
    ...original,
    createToolEntry: mocks.createToolEntry,
    updateToolEntry: mocks.updateToolEntry,
    fetchToolEntries: mocks.fetchToolEntries,
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 7, 24, 10, 0, 0))
  mocks.createToolEntry.mockResolvedValue({})
  mocks.updateToolEntry.mockResolvedValue(undefined)
  mocks.fetchToolEntries.mockResolvedValue([])
})

function entry(payload: TimeAuditPayload, id = 'entry-1'): ToolEntry {
  return {
    id,
    toolId: 'time-audit',
    runId: null,
    payload,
    createdAt: '2026-08-24T10:00:00.000Z',
    updatedAt: '2026-08-24T10:00:00.000Z',
  }
}

function day(date: string, fills: Array<[number, number, string]> = []): TimeAuditPayload {
  let blocks: (string | null)[] = Array.from({ length: BLOCKS_PER_DAY }, () => null)
  for (const [from, to, id] of fills) blocks = paintRange(blocks, from, to, id)
  return { kind: 'time-audit-day', date, blocks, categories: seedCategories() }
}

function paintBlock(time: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${time}`) }))
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: /^save/i }))
}

describe('TimeAuditTool', () => {
  it('offers the starter palette on a first-ever use', () => {
    render(<TimeAuditTool userId="user" initialEntries={[]} />)
    expect(screen.getByRole('button', { name: /brush deep work/i })).toBeTruthy()
  })

  it('saves a painted day against the current date', async () => {
    render(<TimeAuditTool userId="user" initialEntries={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /brush deep work/i }))
    paintBlock('09:00')
    save()

    await waitFor(() => expect(mocks.createToolEntry).toHaveBeenCalled())
    const payload = mocks.createToolEntry.mock.calls[0][3] as TimeAuditPayload
    expect(payload.date).toBe('2026-08-24')
    expect(payload.blocks[36]).toBe('deep-work')
    expect(payload.kind).toBe('time-audit-day')
  })

  it('updates the existing row when the same day is logged again', async () => {
    // There is no unique constraint in SQL, so re-logging a day must be
    // resolved here or the day would silently exist twice.
    render(<TimeAuditTool userId="user" initialEntries={[entry(day('2026-08-24'), 'existing')]} />)
    fireEvent.click(screen.getByRole('button', { name: /brush deep work/i }))
    paintBlock('09:00')
    save()

    await waitFor(() => expect(mocks.updateToolEntry).toHaveBeenCalled())
    expect(mocks.updateToolEntry.mock.calls[0][1]).toBe('existing')
    expect(mocks.createToolEntry).not.toHaveBeenCalled()
  })

  it('reports the save upwards, so an embedding lesson can unlock', async () => {
    const onUsed = vi.fn()
    render(<TimeAuditTool userId="user" initialEntries={[]} onUsed={onUsed} />)
    fireEvent.click(screen.getByRole('button', { name: /brush deep work/i }))
    paintBlock('09:00')
    save()

    await waitFor(() => expect(onUsed).toHaveBeenCalled())
  })

  it('has nothing to save until something is painted', () => {
    render(<TimeAuditTool userId="user" initialEntries={[]} />)
    expect(screen.getByRole('button', { name: /^save/i }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps the painted day on screen when the save fails', async () => {
    // Losing an evening of entry to a dropped connection is the worst thing
    // this tool could do, so the draft has to survive the error.
    mocks.createToolEntry.mockRejectedValue(new Error('offline'))
    render(<TimeAuditTool userId="user" initialEntries={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /brush deep work/i }))
    paintBlock('09:00')
    save()

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(
      screen.getByRole('button', { name: /^09:00/ }).getAttribute('aria-label')
    ).toContain('Deep work')
  })

  it('loads a previously logged day when stepping back to it', () => {
    render(
      <TimeAuditTool
        userId="user"
        initialEntries={[entry(day('2026-08-23', [[36, 39, 'scrolling']]), 'yesterday')]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /previous day/i }))
    expect(
      screen.getByRole('button', { name: /^09:00/ }).getAttribute('aria-label')
    ).toContain('Scrolling')
  })

  it('carries the palette forward from the most recent logged day', () => {
    // Categories are snapshotted per day; a fresh day would otherwise drop
    // back to the seed and lose everything the user set up.
    const customised = {
      ...day('2026-08-20'),
      categories: [{ id: 'reading', label: 'Reading', color: 'violet', value: 'worth_it' as const }],
    }
    render(<TimeAuditTool userId="user" initialEntries={[entry(customised, 'older')]} />)
    expect(screen.getByRole('button', { name: /brush reading/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /brush deep work/i })).toBeNull()
  })

  it('ignores rows another tool wrote to the shared table', () => {
    const foreign = { id: 'x', toolId: 'vision', runId: null, payload: { statement: 'hi' }, createdAt: '', updatedAt: '' }
    render(<TimeAuditTool userId="user" initialEntries={[foreign]} />)
    expect(screen.getByRole('button', { name: /brush deep work/i })).toBeTruthy()
  })
})

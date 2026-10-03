import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ToolEntry } from '@/lib/tools/storage'
import { IdentityTool } from './IdentityTool'
import { cleanIdentity, isIdentityPayload, toIdentityRevisions } from './identity'

const mocks = vi.hoisted(() => ({ createToolEntry: vi.fn(), fetchToolEntries: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/tools/storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tools/storage')>()
  return { ...original, createToolEntry: mocks.createToolEntry, fetchToolEntries: mocks.fetchToolEntries }
})

function entry(payload: unknown, id = 'entry-1'): ToolEntry {
  return { id, toolId: 'identity', runId: null, payload, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' }
}

beforeEach(() => {
  mocks.createToolEntry.mockResolvedValue({})
  mocks.fetchToolEntries.mockResolvedValue([entry({ statements: ['trains four times a week'], dailyProof: 'Walk' })])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('identity payloads', () => {
  it('accepts statements and a daily proof', () => {
    expect(isIdentityPayload({ statements: ['keeps promises'], dailyProof: '' })).toBe(true)
  })

  it('rejects empty and foreign shapes', () => {
    expect(isIdentityPayload({ statements: [], dailyProof: '' })).toBe(false)
    expect(isIdentityPayload({ statements: [1], dailyProof: '' })).toBe(false)
    expect(isIdentityPayload({ statement: 'vision' })).toBe(false)
    expect(toIdentityRevisions([entry({ statement: 'x' }), entry({ statements: ['a'], dailyProof: '' }, 'ok')]).map((e) => e.id)).toEqual(['ok'])
  })

  it('cleans blank lines and refuses an empty identity', () => {
    expect(cleanIdentity(['  reads daily ', '', '  '], ' walk ')).toEqual({ statements: ['reads daily'], dailyProof: 'walk' })
    expect(cleanIdentity(['', ' '], 'walk')).toBeNull()
    expect(cleanIdentity(['a', 'b', 'c', 'd', 'e', 'f'], '')?.statements).toHaveLength(5)
  })
})

describe('IdentityTool', () => {
  it('saves the statements as a new revision and reports use', async () => {
    const onUsed = vi.fn()
    render(<IdentityTool userId="user-1" initialEntries={[]} onUsed={onUsed} />)

    fireEvent.click(screen.getByRole('button', { name: /describe who you are becoming/i }))
    fireEvent.change(screen.getByLabelText('Identity statement 1'), { target: { value: 'trains four times a week' } })
    fireEvent.change(screen.getByLabelText(/what would that person do today/i), { target: { value: 'Walk' } })
    fireEvent.click(screen.getByRole('button', { name: /save identity/i }))

    await waitFor(() => expect(onUsed).toHaveBeenCalled())
    expect(mocks.createToolEntry).toHaveBeenCalledWith({ client: true }, 'user-1', 'identity', {
      statements: ['trains four times a week'],
      dailyProof: 'Walk',
    })
    expect(await screen.findByText('trains four times a week')).toBeTruthy()
  })

  it('cannot save without a single statement', () => {
    render(<IdentityTool userId="user-1" initialEntries={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /describe who you are becoming/i }))
    expect((screen.getByRole('button', { name: /save identity/i }) as HTMLButtonElement).disabled).toBe(true)
  })
})

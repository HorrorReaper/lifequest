import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ToolEntry } from '@/lib/tools/storage'
import { EnvironmentAuditTool } from './EnvironmentAuditTool'
import { countDone, groupByArea, isEnvironmentItemPayload, toEnvironmentItems, type EnvironmentItemPayload } from './environment-audit'

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

function entry(payload: EnvironmentItemPayload, id: string): ToolEntry {
  return { id, toolId: 'environment-audit', runId: null, payload, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' }
}

const phone: EnvironmentItemPayload = { area: 'digital', item: 'Phone on the nightstand', change: 'Charge it in the kitchen', done: false }

beforeEach(() => {
  mocks.createToolEntry.mockResolvedValue({})
  mocks.updateToolEntry.mockResolvedValue(undefined)
  mocks.deleteToolEntry.mockResolvedValue(undefined)
  mocks.fetchToolEntries.mockResolvedValue([entry(phone, 'phone')])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('environment audit payloads', () => {
  it('accepts an item in a known area', () => {
    expect(isEnvironmentItemPayload(phone)).toBe(true)
  })

  it('rejects unknown areas and foreign shapes', () => {
    expect(isEnvironmentItemPayload({ ...phone, area: 'moon' })).toBe(false)
    expect(isEnvironmentItemPayload({ ...phone, done: 'yes' })).toBe(false)
    expect(isEnvironmentItemPayload({ statement: 'vision' })).toBe(false)
  })

  it('groups by area in fixed order with open items first, and counts done ones', () => {
    const items = toEnvironmentItems([
      entry({ ...phone, done: true }, 'a'),
      entry({ area: 'space', item: 'Messy desk', change: '', done: false }, 'b'),
      entry({ ...phone, item: 'Notifications' }, 'c'),
    ])
    const groups = groupByArea(items)
    expect(groups.map((group) => group.id)).toEqual(['space', 'digital'])
    expect(groups[1].items.map((item) => item.id)).toEqual(['c', 'a'])
    expect(countDone(items)).toBe(1)
  })
})

describe('EnvironmentAuditTool', () => {
  it('adds an item and reports use', async () => {
    const onUsed = vi.fn()
    render(<EnvironmentAuditTool userId="user-1" initialEntries={[]} onUsed={onUsed} />)

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'digital' } })
    fireEvent.change(screen.getByLabelText('What is holding you back'), { target: { value: 'Phone on the nightstand' } })
    fireEvent.change(screen.getByLabelText('What you will change'), { target: { value: 'Charge it in the kitchen' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    await waitFor(() => expect(onUsed).toHaveBeenCalled())
    expect(mocks.createToolEntry).toHaveBeenCalledWith({ client: true }, 'user-1', 'environment-audit', phone)
    expect(await screen.findByText('Phone on the nightstand')).toBeTruthy()
  })

  it('marks an item as removed, which also counts as using the tool', async () => {
    const onUsed = vi.fn()
    render(<EnvironmentAuditTool userId="user-1" initialEntries={[entry(phone, 'phone')]} onUsed={onUsed} />)

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() => expect(mocks.updateToolEntry).toHaveBeenCalledWith({ client: true }, 'phone', { ...phone, done: true }))
    expect(onUsed).toHaveBeenCalled()
    expect(screen.getByText('1 of 1 removed or changed')).toBeTruthy()
  })
})

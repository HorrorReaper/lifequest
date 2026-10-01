import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ToolEntry } from '@/lib/tools/storage'
import { WheelOfLifeTool } from './WheelOfLifeTool'
import {
  averageRating,
  compareToBaseline,
  formatDelta,
  isWheelOfLifePayload,
  lowestArea,
  toWheelSnapshots,
  type WheelOfLifePayload,
} from './wheel-of-life'

const mocks = vi.hoisted(() => ({ createToolEntry: vi.fn(), fetchToolEntries: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/tools/storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tools/storage')>()
  return { ...original, createToolEntry: mocks.createToolEntry, fetchToolEntries: mocks.fetchToolEntries }
})

function ratings(values: [number, number, number, number, number]): WheelOfLifePayload['ratings'] {
  const [relationships, health, career, fun, growth] = values
  return { relationships, health, career, fun, growth }
}

function snapshot(values: [number, number, number, number, number], id: string, createdAt = '2026-10-01T10:00:00Z'): ToolEntry {
  return { id, toolId: 'wheel-of-life', runId: null, payload: { ratings: ratings(values), note: '' }, createdAt, updatedAt: createdAt }
}

beforeEach(() => {
  mocks.createToolEntry.mockResolvedValue({})
  mocks.fetchToolEntries.mockResolvedValue([snapshot([5, 5, 5, 5, 5], 'new')])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('wheel of life payloads', () => {
  it('accepts five ratings from 1 to 10 and a note', () => {
    expect(isWheelOfLifePayload({ ratings: ratings([1, 10, 5, 7, 3]), note: '' })).toBe(true)
  })

  it('rejects missing areas, out-of-range and foreign payloads', () => {
    expect(isWheelOfLifePayload({ ratings: { health: 5 }, note: '' })).toBe(false)
    expect(isWheelOfLifePayload({ ratings: ratings([0, 5, 5, 5, 5]), note: '' })).toBe(false)
    expect(isWheelOfLifePayload({ ratings: ratings([5, 5, 5, 5, 11]), note: '' })).toBe(false)
    expect(isWheelOfLifePayload({ ratings: ratings([5, 5, 5, 5, 5.5]), note: '' })).toBe(false)
    expect(isWheelOfLifePayload({ statement: 'vision' })).toBe(false)
    expect(isWheelOfLifePayload(null)).toBe(false)
  })
})

describe('compareToBaseline', () => {
  it('compares the newest snapshot with the very first one', () => {
    const snapshots = toWheelSnapshots([
      snapshot([7, 6, 5, 8, 6], 'latest'),
      snapshot([5, 5, 5, 5, 5], 'middle'),
      snapshot([4, 6, 3, 8, 2], 'first'),
    ])
    const comparison = compareToBaseline(snapshots)
    expect(comparison.map((area) => area.delta)).toEqual([3, 0, 2, 0, 4])
    expect(formatDelta(3)).toBe('+3')
    expect(formatDelta(0)).toBe('±0')
    expect(formatDelta(-2)).toBe('-2')
  })

  it('has no baseline with a single snapshot', () => {
    const comparison = compareToBaseline(toWheelSnapshots([snapshot([5, 5, 5, 5, 5], 'only')]))
    expect(comparison.every((area) => area.baseline === null && area.delta === null)).toBe(true)
  })

  it('finds the area with most room to grow and averages', () => {
    const comparison = compareToBaseline(toWheelSnapshots([snapshot([7, 3, 5, 3, 6], 'a')]))
    expect(lowestArea(comparison)?.id).toBe('health')
    expect(averageRating(ratings([7, 3, 5, 3, 6]))).toBe(4.8)
  })
})

describe('WheelOfLifeTool', () => {
  it('saves a new snapshot with the chosen ratings and reports use', async () => {
    const onUsed = vi.fn()
    render(<WheelOfLifeTool userId="user-1" initialEntries={[]} onUsed={onUsed} />)

    fireEvent.click(screen.getByRole('button', { name: /rate your life areas/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Health: 8' }))
    fireEvent.click(screen.getByRole('button', { name: /save ratings/i }))

    await waitFor(() => expect(onUsed).toHaveBeenCalled())
    expect(mocks.createToolEntry).toHaveBeenCalledWith(
      { client: true },
      'user-1',
      'wheel-of-life',
      { ratings: ratings([5, 8, 5, 5, 5]), note: '' }
    )
  })

  it('shows the change since the first rating', () => {
    render(
      <WheelOfLifeTool
        userId="user-1"
        initialEntries={[snapshot([7, 6, 5, 8, 6], 'latest', '2026-10-14T10:00:00Z'), snapshot([4, 6, 3, 8, 2], 'first')]}
      />
    )
    expect(screen.getByText('+3')).toBeTruthy()
    expect(screen.getByText('+4')).toBeTruthy()
    expect(screen.getByText(/compared with your first rating/i)).toBeTruthy()
  })
})

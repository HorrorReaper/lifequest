import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { ScorecardSection } from '@/components/dashboard/ScorecardSection'
import type { ScorecardRow } from '@/lib/metrics'

function row(overrides: Partial<ScorecardRow> = {}): ScorecardRow {
  return {
    metricId: 'metric-steps',
    name: 'Steps',
    unit: 'steps',
    targetValue: 8000,
    direction: 'at_least',
    latestValue: 7400,
    latestDate: '2026-09-01',
    met: false,
    ...overrides,
  }
}

function renderSection(rows: ScorecardRow[]) {
  return render(<ScorecardSection rows={rows} userId="user-1" today="2026-11-01" />)
}

afterEach(cleanup)

describe('ScorecardSection', () => {
  it('shows the empty state instead of nothing when there are no metrics', () => {
    renderSection([])

    expect(screen.getByText('Track a number over time')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create your first metric' })).toBeTruthy()
    expect(screen.queryByText(/ met$/)).toBeNull()
  })

  it('opens the create dialog from the empty state', () => {
    renderSection([])

    fireEvent.click(screen.getByRole('button', { name: 'Create your first metric' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('shows the latest value against the target', () => {
    renderSection([row()])

    expect(screen.getByText('Steps')).toBeTruthy()
    expect(screen.getByText(/7400 of 8000 steps/i)).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('shows value and date but no progress bar for a row without a target', () => {
    renderSection([
      row({
        name: 'Weight',
        unit: 'kg',
        targetValue: null,
        direction: null,
        latestValue: 81.6,
        latestDate: '2026-10-29',
        met: null,
      }),
    ])

    expect(screen.getByText('81.6 kg')).toBeTruthy()
    expect(screen.getByText(/Oct 29/)).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('says so for a row without a target or a value', () => {
    renderSection([
      row({ targetValue: null, direction: null, latestValue: null, latestDate: null, met: null }),
    ])

    expect(screen.getByText('No value yet')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('names an at_most target as a limit', () => {
    renderSection([
      row({
        name: 'Coffee',
        unit: 'cups',
        targetValue: 2,
        direction: 'at_most',
        latestValue: 1,
        met: true,
      }),
    ])

    expect(screen.getByText(/1 of at most 2 cups/i)).toBeTruthy()
  })

  it('says so when a target has no value yet', () => {
    renderSection([row({ latestValue: null, latestDate: null, met: null })])

    expect(screen.getByText(/no value yet · 8000 steps/i)).toBeTruthy()
  })

  it('links the name and value of a row to the metric page', () => {
    renderSection([row()])

    const link = screen.getByRole('link', { name: /Steps/ })
    expect(link.getAttribute('href')).toBe('/journal/metrics/metric-steps?from=home')
    expect(link.textContent).toMatch(/7400 of 8000 steps/)
  })

  it('opens the log dialog for that metric from the + button', () => {
    renderSection([row(), row({ metricId: 'metric-coffee', name: 'Coffee', unit: 'cups' })])

    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Log Coffee' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toMatch(/Coffee/)
    expect(screen.getByRole('button', { name: 'Save for today' })).toBeTruthy()
  })

  it('counts only rows with a target in the header', () => {
    renderSection([
      row({ met: true, latestValue: 9000 }),
      row({ metricId: 'metric-b', name: 'Water', met: false }),
      row({
        metricId: 'metric-c',
        name: 'Weight',
        targetValue: null,
        direction: null,
        met: null,
      }),
    ])

    expect(screen.getByText('1 of 2 met')).toBeTruthy()
  })

  it('hides the count when no row has a target', () => {
    renderSection([row({ targetValue: null, direction: null, met: null })])

    expect(screen.queryByText(/ met$/)).toBeNull()
  })

  it('links the heading to the metrics list', () => {
    renderSection([row()])

    expect(screen.getByRole('link', { name: 'Scorecard' }).getAttribute('href')).toBe(
      '/journal/metrics'
    )
  })

  it('draws a full bar for a met zero target instead of an invisible one', () => {
    const { container } = renderSection([
      row({
        name: 'Cigarettes',
        unit: 'cigarettes',
        targetValue: 0,
        direction: 'at_most',
        latestValue: 0,
        met: true,
      }),
    ])

    const bar = container.querySelector('.transition-all') as HTMLElement | null
    expect(bar).toBeTruthy()
    expect(bar?.style.width).toBe('100%')
  })
})

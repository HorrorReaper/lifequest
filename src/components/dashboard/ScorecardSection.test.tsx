import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScorecardSection } from '@/components/dashboard/ScorecardSection'
import type { ScorecardRow } from '@/lib/metric-targets'

function row(overrides: Partial<ScorecardRow> = {}): ScorecardRow {
  return {
    fieldId: 'field-steps',
    label: 'Steps',
    unit: 'steps',
    targetValue: 8000,
    direction: 'at_least',
    latestValue: 7400,
    latestDate: '2026-09-01',
    met: false,
    ...overrides,
  }
}

afterEach(cleanup)

describe('ScorecardSection', () => {
  it('renders nothing at all when no targets are set', () => {
    const { container } = render(<ScorecardSection rows={[]} />)

    // Opt-in by construction: a permanently empty card on every dashboard is
    // the clutter the section switches exist to remove.
    expect(container.innerHTML).toBe('')
  })

  it('shows the latest value against the target', () => {
    render(<ScorecardSection rows={[row()]} />)

    expect(screen.getByText('Steps')).toBeTruthy()
    expect(screen.getByText(/7400 of 8000 steps/i)).toBeTruthy()
  })

  it('names an at_most target as a limit', () => {
    render(
      <ScorecardSection
        rows={[
          row({
            label: 'Coffee',
            unit: 'cups',
            targetValue: 2,
            direction: 'at_most',
            latestValue: 1,
            met: true,
          }),
        ]}
      />
    )

    expect(screen.getByText(/1 of at most 2 cups/i)).toBeTruthy()
  })

  it('says so when nothing has been recorded in the window', () => {
    render(<ScorecardSection rows={[row({ latestValue: null, latestDate: null })]} />)

    expect(screen.getByText(/no value yet/i)).toBeTruthy()
  })

  it('lists every row it is given', () => {
    render(
      <ScorecardSection
        rows={[row(), row({ fieldId: 'field-coffee', label: 'Coffee' })]}
      />
    )

    expect(screen.getByText('Steps')).toBeTruthy()
    expect(screen.getByText('Coffee')).toBeTruthy()
  })

  it('links to where targets are set', () => {
    render(<ScorecardSection rows={[row()]} />)

    expect(
      screen.getByRole('link', { name: /metrics/i }).getAttribute('href')
    ).toBe('/journal/metrics')
  })
})

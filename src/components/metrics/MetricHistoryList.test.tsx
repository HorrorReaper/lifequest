import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MetricHistoryList } from '@/components/metrics/MetricHistoryList'
import type { MetricValue } from '@/lib/metrics'

const metric = { id: 'metric-1', name: 'Weight', unit: 'kg' }

const values: MetricValue[] = [
  { date: '2026-10-28', value: 82, sourceEntryId: null, sourceLabel: null },
  { date: '2026-10-30', value: 81.6, sourceEntryId: 'entry-1', sourceLabel: 'Morning check-in' },
  { date: '2026-10-29', value: 81.8, sourceEntryId: null, sourceLabel: null },
]

afterEach(cleanup)

describe('MetricHistoryList', () => {
  it('lists the newest value first', () => {
    render(<MetricHistoryList metric={metric} values={values} />)

    const rows = screen.getAllByRole('button')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Oct 30'),
      expect.stringContaining('Oct 29'),
      expect.stringContaining('Oct 28'),
    ])
  })

  it('shows each value with its unit', () => {
    render(<MetricHistoryList metric={metric} values={values} />)

    expect(screen.getByRole('button', { name: /Oct 30/ }).textContent).toContain('81.6 kg')
  })

  it('says Entered for a value typed in and the template name for one from an entry', () => {
    render(<MetricHistoryList metric={metric} values={values} />)

    expect(
      within(screen.getByRole('button', { name: /Oct 30/ })).getByText('Morning check-in')
    ).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /Oct 29/ })).getByText('Entered')).toBeTruthy()
  })

  it('calls onSelect with the value of the row that was pressed', () => {
    const onSelect = vi.fn()
    render(<MetricHistoryList metric={metric} values={values} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: /Oct 29/ }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(values[2])
  })

  it('says so when nothing was logged yet', () => {
    render(<MetricHistoryList metric={metric} values={[]} />)

    expect(screen.getByText('Nothing logged yet.')).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

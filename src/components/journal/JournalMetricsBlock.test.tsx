import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JournalMetricsBlock } from '@/components/journal/JournalMetricsBlock'
import type { Metric } from '@/lib/metrics'

function metric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'metric-1',
    name: 'Weight',
    unit: 'kg',
    targetValue: null,
    targetDirection: null,
    templateId: 'tpl-1',
    templateName: 'Morning',
    templateArchived: false,
    sourceFieldId: null,
    createdAt: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

afterEach(cleanup)

describe('JournalMetricsBlock', () => {
  it('shows one input per metric with the typed text', () => {
    render(
      <JournalMetricsBlock
        metrics={[
          { metric: metric(), value: null },
          { metric: metric({ id: 'metric-2', name: 'Sleep', unit: 'h' }), value: null },
        ]}
        values={{ 'metric-1': '81,6' }}
        onChange={vi.fn()}
        entryDate="2026-11-01"
        today="2026-11-01"
      />
    )

    expect((screen.getByRole('textbox', { name: 'Weight' }) as HTMLInputElement).value).toBe('81,6')
    expect((screen.getByRole('textbox', { name: 'Sleep' }) as HTMLInputElement).value).toBe('')
  })

  it('names the day the value goes to when it is not today', () => {
    render(
      <JournalMetricsBlock
        metrics={[{ metric: metric(), value: null }]}
        values={{}}
        onChange={vi.fn()}
        entryDate="2026-10-20"
        today="2026-11-01"
      />
    )

    expect(screen.getByText('Saved for Oct 20')).toBeTruthy()
  })

  it('does not name the day for today', () => {
    render(
      <JournalMetricsBlock
        metrics={[{ metric: metric(), value: null }]}
        values={{}}
        onChange={vi.fn()}
        entryDate="2026-11-01"
        today="2026-11-01"
      />
    )

    expect(screen.queryByText(/Saved for/)).toBeNull()
  })

  it('warns that an existing value is replaced', () => {
    render(
      <JournalMetricsBlock
        metrics={[
          { metric: metric(), value: 81.6 },
          { metric: metric({ id: 'metric-2', name: 'Sleep', unit: 'h' }), value: null },
        ]}
        values={{ 'metric-1': '81.6' }}
        onChange={vi.fn()}
        entryDate="2026-11-01"
        today="2026-11-01"
      />
    )

    expect(
      screen.getByText('Already logged for this day (81.6 kg). Changing it replaces it.')
    ).toBeTruthy()
    expect(screen.getAllByText(/Already logged/)).toHaveLength(1)
  })

  it('reports typed text, accepting a comma decimal', () => {
    const onChange = vi.fn()
    render(
      <JournalMetricsBlock
        metrics={[{ metric: metric(), value: null }]}
        values={{}}
        onChange={onChange}
        entryDate="2026-11-01"
        today="2026-11-01"
      />
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Weight' }), {
      target: { value: '81,6' },
    })
    expect(onChange).toHaveBeenCalledWith('metric-1', '81,6')

    onChange.mockClear()
    fireEvent.change(screen.getByRole('textbox', { name: 'Weight' }), {
      target: { value: 'abc' },
    })
    expect(onChange).not.toHaveBeenCalled()
  })
})

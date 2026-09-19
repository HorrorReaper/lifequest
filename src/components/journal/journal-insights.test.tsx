import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  JournalInsights,
  type JournalInsightItem,
} from '@/components/journal/journal-insights'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/supabase/helpers', () => ({ supabaseFrom: () => ({}) }))

function insight(overrides: Partial<JournalInsightItem> = {}): JournalInsightItem {
  return {
    id: 'insight-1',
    source: 'response',
    sourceId: 'response-1',
    entryId: 'entry-1',
    fieldId: 'field-1',
    type: 'learning',
    title: 'Sleep drives everything',
    answer: 'Eight hours changed the whole week.',
    prompt: 'What did you learn?',
    tags: ['health'],
    actionText: null,
    isFavorite: false,
    markedAt: '2026-09-01T08:00:00.000Z',
    entryDate: '2026-09-01',
    template: { id: 'tpl-1', name: 'Daily check-in', icon: '📓' },
    ...overrides,
  }
}

afterEach(cleanup)

describe('JournalInsights filters', () => {
  it('shows the search and the types without opening anything', () => {
    render(<JournalInsights insights={[insight()]} />)

    expect(screen.getByRole('searchbox')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /learning/i })).toBeTruthy()
  })

  it('keeps the rest of the filters out of the way until asked', () => {
    render(<JournalInsights insights={[insight()]} />)

    // Six controls stacked above fourteen insights is a form in front of the
    // content someone came to read.
    expect(screen.queryByLabelText('Topic')).toBeNull()
    expect(screen.queryByLabelText('Template')).toBeNull()
    expect(screen.queryByLabelText('From')).toBeNull()
    expect(screen.queryByLabelText('To')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /filters/i }))

    expect(screen.getByLabelText('Topic')).toBeTruthy()
    expect(screen.getByLabelText('Template')).toBeTruthy()
    expect(screen.getByLabelText('From')).toBeTruthy()
    expect(screen.getByLabelText('To')).toBeTruthy()
  })

  it('says how many filters are on, so a hidden one cannot be forgotten', () => {
    render(<JournalInsights insights={[insight()]} />)

    const filters = () => screen.getByRole('button', { name: /filters/i })
    expect(filters().textContent).not.toMatch(/\d/)

    fireEvent.click(filters())
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'health' } })

    expect(filters().textContent).toMatch(/1/)
  })

  it('counts only what the panel hides, not what is already on screen', () => {
    render(<JournalInsights insights={[insight()]} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sleep' } })
    fireEvent.click(screen.getByRole('tab', { name: /learning/i }))

    // Both of those are visible right there. Counting them would badge the
    // button with a number and then show an empty panel behind it.
    expect(
      screen.getByRole('button', { name: /filters/i }).textContent
    ).not.toMatch(/\d/)

    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'health' } })

    expect(
      screen.getByRole('button', { name: /filters/i }).textContent
    ).toMatch(/1/)
  })

  it('offers a reset only when there is something to reset', () => {
    render(<JournalInsights insights={[insight()]} />)

    // A permanently disabled button next to the search box is chrome, not an
    // affordance.
    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sleep' } })

    // And it must be reachable without opening the panel, or a typed search
    // would have nothing to clear it.
    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy()
  })

  it('clears everything, including a filter that is out of sight', () => {
    render(<JournalInsights insights={[insight()]} />)

    fireEvent.click(screen.getByRole('button', { name: /filters/i }))
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'health' } })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sleep' } })

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))

    expect(screen.getByRole('searchbox')).toHaveProperty('value', '')
    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull()
    // The panel stays open across a reset, so the hidden filter is visibly
    // cleared rather than silently.
    expect(screen.getByLabelText('Topic')).toHaveProperty('value', 'all')
  })

  it('still filters by what is typed', () => {
    render(
      <JournalInsights
        insights={[
          insight(),
          insight({ id: 'insight-2', title: 'Call the bank', answer: 'Overdue.' }),
        ]}
      />
    )

    expect(screen.getByText('Sleep drives everything')).toBeTruthy()
    expect(screen.getByText('Call the bank')).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bank' } })

    expect(screen.queryByText('Sleep drives everything')).toBeNull()
    expect(screen.getByText('Call the bank')).toBeTruthy()
  })
})

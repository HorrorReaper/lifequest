import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuditSummary } from './AuditSummary'
import { BLOCKS_PER_DAY, paintRange, seedCategories, type TimeAuditPayload } from './time-audit'

afterEach(cleanup)

function day(date: string, fills: Array<[number, number, string]>): TimeAuditPayload {
  let blocks: (string | null)[] = Array.from({ length: BLOCKS_PER_DAY }, () => null)
  for (const [from, to, id] of fills) blocks = paintRange(blocks, from, to, id)
  return { kind: 'time-audit-day', date, blocks, categories: seedCategories() }
}

describe('AuditSummary', () => {
  it('leads with how much logged time was wasted, the question the tool exists to answer', () => {
    // 4 blocks deep work + 4 blocks scrolling = 50% wasted.
    render(<AuditSummary days={[day('2026-08-24', [[0, 3, 'deep-work'], [4, 7, 'scrolling']])]} today="2026-08-24" />)
    expect(screen.getByTestId('wasted-headline').textContent).toContain('1h')
    expect(screen.getByTestId('wasted-headline').textContent).toContain('50%')
  })

  it('ranks categories by time spent', () => {
    render(<AuditSummary days={[day('2026-08-24', [[0, 3, 'deep-work'], [4, 19, 'sleep']])]} today="2026-08-24" />)
    const rows = screen.getAllByTestId('category-row')
    expect(rows[0].textContent).toContain('Sleep')
    expect(rows[1].textContent).toContain('Deep work')
  })

  it('shows each category duration in hours and minutes', () => {
    render(<AuditSummary days={[day('2026-08-24', [[0, 4, 'deep-work']])]} today="2026-08-24" />)
    expect(screen.getByTestId('category-row').textContent).toContain('1h 15m')
  })

  it('narrows to the chosen window when the range is switched', () => {
    const days = [day('2026-08-24', [[0, 3, 'deep-work']]), day('2026-07-01', [[0, 3, 'sleep']])]
    render(<AuditSummary days={days} today="2026-08-24" />)

    expect(screen.getAllByTestId('category-row')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /all time/i }))
    expect(screen.getAllByTestId('category-row')).toHaveLength(2)
  })

  it('invites a first entry when nothing has been logged at all', () => {
    render(<AuditSummary days={[]} today="2026-08-24" />)
    expect(screen.getByText(/nothing logged yet/i)).toBeTruthy()
  })

  it('says the window is empty rather than claiming nothing was ever logged', () => {
    // An older audit still exists; only this window is empty, and the copy
    // has to tell those two situations apart.
    render(<AuditSummary days={[day('2026-01-01', [[0, 3, 'deep-work']])]} today="2026-08-24" />)
    expect(screen.getByText(/nothing logged in the last 7 days/i)).toBeTruthy()
  })
})

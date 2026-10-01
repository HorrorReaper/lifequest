import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SignupAnalytics } from './SignupAnalytics'

// jsdom ships no ResizeObserver; Recharts' ResponsiveContainer only uses it
// to measure, and these tests read the text around the chart, not the SVG.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

afterEach(cleanup)

const daily = [
  { date: '2026-09-29', waitlist: 3, users: 1 },
  { date: '2026-09-30', waitlist: 2, users: 0 },
]
const baseline = { waitlist: 35, users: 10 }

function renderAnalytics(overrides: Partial<Parameters<typeof SignupAnalytics>[0]> = {}) {
  return render(
    <SignupAnalytics range={30} daily={daily} baseline={baseline} unavailable={null} {...overrides} />
  )
}

describe('SignupAnalytics', () => {
  it('sums each series over the range and shows the all-time total beside it', () => {
    renderAnalytics()

    const waitlist = screen.getByRole('group', { name: 'Waitlist' })
    expect(within(waitlist).getByText('+5')).toBeTruthy()
    expect(within(waitlist).getByText('40 total')).toBeTruthy()

    const users = screen.getByRole('group', { name: 'Registered' })
    expect(within(users).getByText('+1')).toBeTruthy()
    expect(within(users).getByText('11 total')).toBeTruthy()
  })

  it('links each range to the Tools page and marks the one shown', () => {
    renderAnalytics({ range: 90 })

    expect(screen.getByRole('link', { name: '30 days' }).getAttribute('href')).toBe('/admin/tools?range=30')
    expect(screen.getByRole('link', { name: '1 year' }).getAttribute('href')).toBe('/admin/tools?range=365')
    expect(screen.getByRole('link', { name: '90 days' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: '30 days' }).getAttribute('aria-current')).toBeNull()
  })

  it('lists the daily numbers in a table, and running totals once switched to cumulative', () => {
    renderAnalytics()

    const table = screen.getByRole('table')
    const firstRow = () => within(table).getAllByRole('row')[1]
    expect(within(firstRow()).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['2026-09-29', '3', '1'])

    fireEvent.click(screen.getByRole('button', { name: 'Cumulative' }))

    expect(screen.getByRole('button', { name: 'Cumulative' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(firstRow()).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['2026-09-29', '38', '11'])
  })

  it('says so when nobody signed up in the range, instead of drawing a flat line', () => {
    renderAnalytics({
      daily: [{ date: '2026-09-30', waitlist: 0, users: 0 }],
    })

    expect(screen.getByText('No signups in this range yet.')).toBeTruthy()
  })

  it('explains that the admin role is missing for an allowlist-only admin', () => {
    renderAnalytics({ unavailable: 'untrusted' })

    expect(screen.getByText(/app_metadata.role = admin/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('points at the migration when the numbers could not be loaded', () => {
    renderAnalytics({ unavailable: 'error' })

    expect(screen.getByText(/20260930120000_add_admin_signup_analytics\.sql/)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

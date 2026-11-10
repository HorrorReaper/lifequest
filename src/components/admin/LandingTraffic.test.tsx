import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { LandingTraffic } from './LandingTraffic'
import { buildLandingBreakdown, buildLandingSeries } from '@/lib/landing-analytics'

// jsdom ships no ResizeObserver; Recharts' ResponsiveContainer only uses it
// to measure, and these tests read the text around the chart, not the SVG.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

afterEach(cleanup)

const daily = buildLandingSeries(
  [
    { day: '2026-11-09', pageviews: 30, visitors: 20, cta_clicks: 8, cta_visitors: 5, signups: 2 },
    { day: '2026-11-10', pageviews: 10, visitors: 5, cta_clicks: 2, cta_visitors: 1, signups: 0 },
  ],
  '2026-11-09',
  '2026-11-10'
)
const breakdown = buildLandingBreakdown([
  { dimension: 'referrer', label: null, visitors: 15, events: 25 },
  { dimension: 'referrer', label: 'reddit.com', visitors: 10, events: 15 },
])

function renderTraffic(overrides: Partial<Parameters<typeof LandingTraffic>[0]> = {}) {
  return render(<LandingTraffic range={30} daily={daily} breakdown={breakdown} unavailable={null} {...overrides} />)
}

describe('LandingTraffic', () => {
  it('shows the range totals and the conversion to the waitlist', () => {
    renderTraffic()
    expect(within(screen.getByRole('group', { name: 'Visitors' })).getByText('25')).toBeTruthy()
    expect(within(screen.getByRole('group', { name: 'Page views' })).getByText('40')).toBeTruthy()
    const signups = within(screen.getByRole('group', { name: 'Waitlist signups' }))
    expect(signups.getByText('2')).toBeTruthy()
    expect(signups.getByText('8.0% of visitors')).toBeTruthy()
    expect(screen.getByText('6 · 24%')).toBeTruthy()
  })

  it('lists the top referrers, with direct visits named', () => {
    renderTraffic()
    expect(screen.getByText('Direct / none')).toBeTruthy()
    expect(screen.getByText('10 visitors · 40%')).toBeTruthy()
  })

  it('links the range switch to the Tools page', () => {
    renderTraffic({ range: 90 })
    const nav = screen.getByRole('navigation', { name: 'Landing traffic range' })
    expect(within(nav).getByRole('link', { name: '90 days' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: '1 year' }).getAttribute('href')).toBe('/admin/tools?range=365')
  })

  it('explains an untrusted admin and a missing migration instead of showing zeros', () => {
    renderTraffic({ unavailable: 'untrusted' })
    expect(screen.getByText(/app_metadata.role = admin/)).toBeTruthy()
    cleanup()
    renderTraffic({ unavailable: 'error' })
    expect(screen.getByText(/20261110120000_landing_page_traffic.sql/)).toBeTruthy()
  })

  it('says so when nobody visited in the range', () => {
    renderTraffic({ daily: buildLandingSeries([], '2026-11-09', '2026-11-10') })
    expect(screen.getByText('No landing page visits in this range yet.')).toBeTruthy()
  })
})

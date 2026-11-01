import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MetricPageHeader } from '@/components/metrics/MetricPageHeader'
import type { Metric } from '@/lib/metrics'

const metric: Metric = {
  id: 'metric-1',
  name: 'Weight',
  unit: 'kg',
  targetValue: 80,
  targetDirection: 'at_most',
  templateId: null,
  templateName: null,
  templateArchived: false,
  sourceFieldId: null,
  createdAt: '2026-10-01T00:00:00Z',
}

afterEach(cleanup)

describe('MetricPageHeader', () => {
  it('links back to the dashboard from home', () => {
    render(<MetricPageHeader metric={metric} backHref="/dashboard" />)

    const link = screen.getByRole('link', { name: '‹ Home' })
    expect(link.getAttribute('href')).toBe('/dashboard')
  })

  it('links back to the metrics list otherwise', () => {
    render(<MetricPageHeader metric={metric} backHref="/journal/metrics" />)

    const link = screen.getByRole('link', { name: '‹ Metrics' })
    expect(link.getAttribute('href')).toBe('/journal/metrics')
  })

  it('shows the name and the target', () => {
    render(<MetricPageHeader metric={metric} backHref="/journal/metrics" />)

    expect(screen.getByRole('heading', { name: 'Weight' })).toBeTruthy()
    expect(screen.getByText('at most 80 kg')).toBeTruthy()
  })

  it('words an at-least target', () => {
    render(
      <MetricPageHeader
        metric={{ ...metric, name: 'Steps', unit: null, targetValue: 8000, targetDirection: 'at_least' }}
        backHref="/journal/metrics"
      />
    )

    expect(screen.getByText('at least 8000')).toBeTruthy()
  })

  it('says No target when none is set', () => {
    render(
      <MetricPageHeader
        metric={{ ...metric, targetValue: null, targetDirection: null }}
        backHref="/journal/metrics"
      />
    )

    expect(screen.getByText('No target')).toBeTruthy()
  })

  it('renders the settings slot', () => {
    render(
      <MetricPageHeader
        metric={metric}
        backHref="/journal/metrics"
        settingsSlot={<button type="button">Settings</button>}
      />
    )

    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
  })
})

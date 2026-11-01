import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MetricList } from '@/components/metrics/MetricList'
import type { Metric } from '@/lib/metrics'

afterEach(cleanup)

function metric(overrides: Partial<Metric> = {}): Metric {
  return {
    id: 'm-1',
    name: 'Weight',
    unit: 'kg',
    targetValue: null,
    targetDirection: null,
    templateId: null,
    templateName: null,
    templateArchived: false,
    sourceFieldId: null,
    createdAt: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

const noArrow = () => {
  expect(screen.queryByText('↗')).toBeNull()
  expect(screen.queryByText('↘')).toBeNull()
  expect(screen.queryByText('→')).toBeNull()
}

describe('MetricList', () => {
  it('links each row to its metric page', () => {
    render(
      <MetricList
        metrics={[metric(), metric({ id: 'm-2', name: 'Steps', unit: null })]}
        latest={{}}
        previous={{}}
      />
    )

    expect(screen.getByRole('link', { name: /Weight/ }).getAttribute('href')).toBe(
      '/journal/metrics/m-1'
    )
    expect(screen.getByRole('link', { name: /Steps/ }).getAttribute('href')).toBe(
      '/journal/metrics/m-2'
    )
  })

  it('shows the latest value with its unit and date', () => {
    render(
      <MetricList
        metrics={[metric()]}
        latest={{ 'm-1': { value: 81.6, date: '2026-10-29' } }}
        previous={{ 'm-1': null }}
      />
    )

    expect(screen.getByText('81.6 kg')).toBeTruthy()
    expect(screen.getByText('Oct 29')).toBeTruthy()
  })

  it('says so when a metric has no value yet', () => {
    render(<MetricList metrics={[metric()]} latest={{}} previous={{}} />)

    expect(screen.getByText('No value yet')).toBeTruthy()
    noArrow()
  })

  it.each([
    [82, 81.6, '↘'],
    [80, 81.6, '↗'],
    [81.6, 81.6, '→'],
  ])('compares %s before with %s now as %s', (before, now, arrow) => {
    render(
      <MetricList
        metrics={[metric()]}
        latest={{ 'm-1': { value: now, date: '2026-10-29' } }}
        previous={{ 'm-1': before }}
      />
    )

    expect(screen.getByText(arrow)).toBeTruthy()
  })

  it('shows no arrow without a previous value', () => {
    render(
      <MetricList
        metrics={[metric()]}
        latest={{ 'm-1': { value: 81.6, date: '2026-10-29' } }}
        previous={{ 'm-1': null }}
      />
    )

    noArrow()
  })

  it('shows the linked journal template', () => {
    render(
      <MetricList
        metrics={[metric({ templateId: 't-1', templateName: 'Morning check-in' })]}
        latest={{}}
        previous={{}}
      />
    )

    expect(screen.getByText('📓 Morning check-in')).toBeTruthy()
  })

  it('shows no template line for an unlinked metric', () => {
    render(<MetricList metrics={[metric()]} latest={{}} previous={{}} />)

    expect(screen.queryByText(/📓/)).toBeNull()
  })
})

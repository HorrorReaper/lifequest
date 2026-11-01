import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MetricChart } from '@/components/journal/MetricChart'

// jsdom has no layout, so ResponsiveContainer would render nothing. The mock
// exposes the data the chart was given and whether a target line is drawn.
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    ResponsiveContainer: Passthrough,
    LineChart: ({ data, children }: { data: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="chart" data-points={data.length}>
        {children}
      </div>
    ),
    ReferenceLine: ({ y }: { y: number }) => <div data-testid="target-line" data-y={y} />,
    CartesianGrid: () => null,
    Line: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  }
})

const today = '2026-11-01'
const data = [
  { date: '2026-09-22', value: 83 }, // today - 40
  { date: '2026-10-27', value: 81.6 }, // today - 5
]

function points() {
  return Number(screen.getByTestId('chart').getAttribute('data-points'))
}

afterEach(cleanup)

describe('MetricChart', () => {
  it('shows the last 30 days at first', () => {
    render(<MetricChart label="Weight" unit="kg" data={data} today={today} />)

    expect(points()).toBe(1)
    expect(screen.getByRole('button', { name: '30d' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('widens to 90 days', () => {
    render(<MetricChart label="Weight" unit="kg" data={data} today={today} />)

    fireEvent.click(screen.getByRole('button', { name: '90d' }))

    expect(points()).toBe(2)
    expect(screen.getByRole('button', { name: '90d' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps showing the newest value whatever the range', () => {
    render(<MetricChart label="Weight" unit="kg" data={[data[0]]} today={today} />)

    expect(screen.getByText('83 kg')).toBeTruthy()
    expect(screen.getByText('Nothing logged in the last 30 days.')).toBeTruthy()
  })

  it('draws a target line only when there is a target', () => {
    const { rerender } = render(
      <MetricChart label="Weight" unit="kg" data={data} today={today} targetValue={80} />
    )
    expect(screen.getByTestId('target-line').getAttribute('data-y')).toBe('80')

    rerender(<MetricChart label="Weight" unit="kg" data={data} today={today} targetValue={null} />)
    expect(screen.queryByTestId('target-line')).toBeNull()
  })

  it('shows the subtitle when given', () => {
    render(<MetricChart label="Weight" unit="kg" subtitle="Daily check-in" data={data} today={today} />)

    expect(screen.getByText('Daily check-in')).toBeTruthy()
  })
})

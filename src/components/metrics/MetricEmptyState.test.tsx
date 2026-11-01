import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MetricEmptyState } from '@/components/metrics/MetricEmptyState'

afterEach(cleanup)

describe('MetricEmptyState', () => {
  it('explains what a metric is', () => {
    render(<MetricEmptyState onCreate={() => {}} />)

    expect(screen.getByText('Track a number over time')).toBeTruthy()
    expect(
      screen.getByText(
        'Weight, steps, sleep, revenue — anything you can count. Log it in a tap, see the trend, set a target.'
      )
    ).toBeTruthy()
  })

  it('offers to create the first metric', () => {
    const onCreate = vi.fn()
    render(<MetricEmptyState onCreate={onCreate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create your first metric' }))

    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})

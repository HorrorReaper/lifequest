import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { QuickActionButton } from './quick-action-button'

afterEach(cleanup)

describe('QuickActionButton', () => {
  it('offers a Metric action after Habit that opens the create dialog', () => {
    render(<QuickActionButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Open quick actions' }))

    const metric = screen.getByRole('link', { name: /Metric/ })
    expect(metric.getAttribute('href')).toBe('/journal/metrics?new=1')
    expect(metric.textContent).toContain('Track a number over time — weight, steps, sleep…')

    const titles = screen
      .getAllByRole('link')
      .map((link) => link.querySelector('span span')?.textContent)
    expect(titles.indexOf('Metric')).toBe(titles.indexOf('Habit') + 1)
  })
})

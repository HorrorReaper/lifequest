import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MetricCreatedHint } from '@/components/metrics/MetricCreatedHint'

afterEach(cleanup)

function renderHint() {
  const handlers = { onSetTarget: vi.fn(), onAskInJournal: vi.fn(), onDismiss: vi.fn() }
  render(<MetricCreatedHint {...handlers} />)
  return handlers
}

describe('MetricCreatedHint', () => {
  it('shows the copy', () => {
    renderHint()

    expect(screen.getByText('Almost there.')).toBeTruthy()
    expect(
      screen.getByText(
        "Want the app to tell you when you're on track, or ask for this number in your journal?"
      )
    ).toBeTruthy()
  })

  it('calls onSetTarget', () => {
    const handlers = renderHint()
    fireEvent.click(screen.getByRole('button', { name: 'Set a target' }))
    expect(handlers.onSetTarget).toHaveBeenCalledTimes(1)
  })

  it('calls onAskInJournal', () => {
    const handlers = renderHint()
    fireEvent.click(screen.getByRole('button', { name: 'Ask in journal' }))
    expect(handlers.onAskInJournal).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss on Later', () => {
    const handlers = renderHint()
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1)
  })
})

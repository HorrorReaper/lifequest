import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { JournalNavigation } from './journal-navigation'

afterEach(() => {
  cleanup()
})

describe('JournalNavigation', () => {
  it('navigates intermediate steps without submitting and submits once on the final step', () => {
    const onBack = vi.fn()
    const onNext = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const view = render(
      <form onSubmit={onSubmit}>
        <JournalNavigation
          activeStep={0}
          stepCount={2}
          submitting={false}
          onBack={onBack}
          onNext={onNext}
        />
      </form>
    )

    fireEvent.click(view.getByRole('button', { name: /next/i }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()

    view.rerender(
      <form onSubmit={onSubmit}>
        <JournalNavigation
          activeStep={1}
          stepCount={2}
          submitting={false}
          onBack={onBack}
          onNext={onNext}
        />
      </form>
    )

    fireEvent.click(view.getByRole('button', { name: /save reflection/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not reuse the Next button as the Save button', () => {
    // The bug: Next and Save were one <button> whose type flipped from
    // "button" to "submit". Tapping Next on the second-to-last step
    // re-rendered it as a submit button before the browser ran the click's
    // default action, so that same tap saved the entry instead of showing
    // the last step (reproduced in Chrome; jsdom does not run the default
    // action late enough to show it). Two separate elements cannot do that.
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())

    function Wizard() {
      const [step, setStep] = useState(0)
      return (
        <form onSubmit={onSubmit}>
          <JournalNavigation
            activeStep={step}
            stepCount={2}
            submitting={false}
            onBack={() => setStep((current) => current - 1)}
            onNext={() => setStep((current) => current + 1)}
          />
        </form>
      )
    }

    render(<Wizard />)
    const next = screen.getByRole('button', { name: /next/i })
    fireEvent.click(next)

    const save = screen.getByRole('button', { name: /save reflection/i })
    expect(save).not.toBe(next)
    expect(next.isConnected).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

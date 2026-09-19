import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

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
})

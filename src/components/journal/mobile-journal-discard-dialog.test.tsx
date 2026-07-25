import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { MobileJournalDiscardDialog } from './mobile-journal-discard-dialog'

afterEach(() => {
  cleanup()
})

describe('MobileJournalDiscardDialog', () => {
  it('lets the user continue without discarding', () => {
    const onOpenChange = vi.fn()
    const onDiscard = vi.fn()
    const view = render(
      <MobileJournalDiscardDialog
        open
        onOpenChange={onOpenChange}
        onDiscard={onDiscard}
      />
    )

    fireEvent.click(view.getByRole('button', { name: /continue reflection/i }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onDiscard).not.toHaveBeenCalled()
  })

  it('runs the explicit discard action', () => {
    const onOpenChange = vi.fn()
    const onDiscard = vi.fn()
    const view = render(
      <MobileJournalDiscardDialog
        open
        onOpenChange={onOpenChange}
        onDiscard={onDiscard}
      />
    )

    fireEvent.click(view.getByRole('button', { name: /discard draft/i }))

    expect(onDiscard).toHaveBeenCalledTimes(1)
  })
})

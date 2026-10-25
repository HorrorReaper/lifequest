import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

import { ClickableSection, SectionHeadingLink } from './ClickableSection'

afterEach(() => {
  cleanup()
  push.mockReset()
})

function renderSection() {
  render(
    <ClickableSection href="/habits" aria-label="Habits section">
      <h2>
        <SectionHeadingLink href="/habits">Habits</SectionHeadingLink>
      </h2>
      <p>3 of 5 today</p>
      <button type="button">Meditation</button>
      <div role="checkbox" aria-checked="false" tabIndex={0}>
        Read
      </div>
      <span data-section-ignore>Busy area</span>
      {createPortal(<div role="dialog">Edit habit</div>, document.body)}
    </ClickableSection>
  )
}

describe('ClickableSection', () => {
  it('opens its page when empty space or text in it is clicked', () => {
    renderSection()
    fireEvent.click(screen.getByText('3 of 5 today'))
    expect(push).toHaveBeenCalledWith('/habits')
  })

  it("leaves the section's own controls alone", () => {
    renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Meditation' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Read' }))
    fireEvent.click(screen.getByText('Busy area'))
    expect(push).not.toHaveBeenCalled()
  })

  it('ignores clicks inside a dialog the section opened in a portal', () => {
    renderSection()
    fireEvent.click(screen.getByText('Edit habit'))
    expect(push).not.toHaveBeenCalled()
  })

  it('keeps the page reachable from the keyboard through the heading link', () => {
    renderSection()
    expect(screen.getByRole('link', { name: 'Habits' }).getAttribute('href')).toBe('/habits')
  })

  it('opens a new tab on a modifier click instead of leaving the dashboard', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderSection()
    fireEvent.click(screen.getByText('3 of 5 today'), { ctrlKey: true })
    expect(open).toHaveBeenCalledWith('/habits', '_blank', 'noopener')
    expect(push).not.toHaveBeenCalled()
    open.mockRestore()
  })
})

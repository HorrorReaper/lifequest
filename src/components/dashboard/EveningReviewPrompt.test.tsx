import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EveningReviewPrompt } from './EveningReviewPrompt'
import { installLocalStorageStub } from '../../../test/local-storage-stub'

const TODAY = '2026-08-02'

const copy = { title: 'How was your day, Alex?', description: 'Close the loop.', ctaLabel: 'Start evening review' }

const defaultProps = {
  today: TODAY,
  isEvening: true,
  reviewDone: false,
  href: '/journal/new/evening-review-template-id',
  copy,
  habitsCompleted: 2,
  habitsTotal: 3,
  tasksCompletedToday: 4,
}

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  cleanup()
})

describe('EveningReviewPrompt', () => {
  it('opens once it is evening, the review is not done, and it has not been dismissed today', () => {
    render(<EveningReviewPrompt {...defaultProps} />)

    expect(screen.getByText('How was your day, Alex?')).toBeTruthy()
  })

  it('stays closed before 8pm', () => {
    render(<EveningReviewPrompt {...defaultProps} isEvening={false} />)

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('stays closed once the evening review is already done today', () => {
    render(<EveningReviewPrompt {...defaultProps} reviewDone />)

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('stays closed when the ritual has no target to open', () => {
    render(<EveningReviewPrompt {...defaultProps} href={null} />)

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('links where the page told it to', () => {
    render(<EveningReviewPrompt {...defaultProps} />)

    expect(screen.getByRole('link', { name: 'Start evening review' }).getAttribute('href')).toBe('/journal/new/evening-review-template-id')
  })

  it('shows the day summary and links straight into the journal entry', () => {
    render(<EveningReviewPrompt {...defaultProps} />)

    expect(screen.getByText('2/3 habits')).toBeTruthy()
    expect(screen.getByText('4 tasks completed')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Start evening review' }).getAttribute('href')
    ).toBe('/journal/new/evening-review-template-id')
  })

  it('closes and remembers the dismissal for the rest of the day when the user picks "Not now"', () => {
    const { unmount } = render(<EveningReviewPrompt {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
    expect(
      window.localStorage.getItem(`lifequest-ritual-evening_review-dismissed-${TODAY}`)
    ).toBe('1')

    // Simulate a fresh page load later the same evening: still dismissed.
    unmount()
    render(<EveningReviewPrompt {...defaultProps} />)
    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('reopens on a new day even if yesterday was dismissed', () => {
    window.localStorage.setItem('lifequest-ritual-evening_review-dismissed-2026-08-01', '1')

    render(<EveningReviewPrompt {...defaultProps} />)

    expect(screen.getByText('How was your day, Alex?')).toBeTruthy()
  })

  it('stays closed while a weekly prompt it yields to is still unanswered', () => {
    render(
      <EveningReviewPrompt
        {...defaultProps}
        heldBackBy="lifequest-ritual-weekly_review-dismissed-2026-07-27"
      />
    )

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('opens once the weekly prompt it yields to has been dismissed', () => {
    window.localStorage.setItem('lifequest-ritual-weekly_review-dismissed-2026-07-27', '1')

    render(
      <EveningReviewPrompt
        {...defaultProps}
        heldBackBy="lifequest-ritual-weekly_review-dismissed-2026-07-27"
      />
    )

    expect(screen.getByText('How was your day, Alex?')).toBeTruthy()
  })
})

describe('EveningReviewPrompt preview', () => {
  it('opens regardless of state when a preview close handler is given', () => {
    window.localStorage.setItem(`lifequest-ritual-evening_review-dismissed-${TODAY}`, '1')

    render(
      <EveningReviewPrompt
        {...defaultProps}
        isEvening={false}
        reviewDone
        onPreviewClose={() => {}}
      />
    )

    expect(screen.getByText('How was your day, Alex?')).toBeTruthy()
  })

  it('closes through the handler without remembering a dismissal', () => {
    const onPreviewClose = vi.fn()

    render(<EveningReviewPrompt {...defaultProps} onPreviewClose={onPreviewClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(onPreviewClose).toHaveBeenCalledTimes(1)
    expect(
      window.localStorage.getItem(`lifequest-ritual-evening_review-dismissed-${TODAY}`)
    ).toBeNull()
  })

  it('previews even when the ritual has no target to open', () => {
    render(<EveningReviewPrompt {...defaultProps} href={null} onPreviewClose={() => {}} />)

    expect(screen.getByText('How was your day, Alex?')).toBeTruthy()
  })
})

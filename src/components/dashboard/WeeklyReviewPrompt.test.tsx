import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WeeklyReviewPrompt } from './WeeklyReviewPrompt'
import { installLocalStorageStub } from '../../../test/local-storage-stub'

const WEEK_START = '2026-09-14'

const copy = { title: 'How was your week, Alex?', description: 'Step back.', ctaLabel: 'Start weekly review' }

const defaultProps = {
  weekStart: WEEK_START,
  isWindow: true,
  reviewDone: false,
  href: '/journal/new/weekly-review-id',
  copy,
  habitsCompletedThisWeek: 12,
  tasksCompletedThisWeek: 7,
}

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  cleanup()
})

describe('WeeklyReviewPrompt', () => {
  it('opens in the Sunday-evening window when the review is not done and not dismissed', () => {
    render(<WeeklyReviewPrompt {...defaultProps} />)

    expect(screen.getByText('How was your week, Alex?')).toBeTruthy()
  })

  it('stays closed outside the window', () => {
    render(<WeeklyReviewPrompt {...defaultProps} isWindow={false} />)

    expect(screen.queryByText('How was your week, Alex?')).toBeNull()
  })

  it('stays closed once this week\'s review exists', () => {
    render(<WeeklyReviewPrompt {...defaultProps} reviewDone />)

    expect(screen.queryByText('How was your week, Alex?')).toBeNull()
  })

  it('stays closed when the ritual has no target to open', () => {
    render(<WeeklyReviewPrompt {...defaultProps} href={null} />)

    expect(screen.queryByText('How was your week, Alex?')).toBeNull()
  })

  it('shows the week\'s habit and task counts', () => {
    render(<WeeklyReviewPrompt {...defaultProps} />)

    expect(screen.getByText('12 habit check-ins')).toBeTruthy()
    expect(screen.getByText('7 tasks completed')).toBeTruthy()
  })

  it('links to a new entry of the weekly review template', () => {
    render(<WeeklyReviewPrompt {...defaultProps} />)

    const link = screen.getByRole('link', { name: 'Start weekly review' })
    expect(link.getAttribute('href')).toBe('/journal/new/weekly-review-id')
  })

  it('closes and remembers the dismissal for the rest of the week on "Not now"', () => {
    const { unmount } = render(<WeeklyReviewPrompt {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('How was your week, Alex?')).toBeNull()
    expect(
      window.localStorage.getItem(`lifequest-ritual-weekly_review-dismissed-${WEEK_START}`)
    ).toBe('1')

    unmount()
    render(<WeeklyReviewPrompt {...defaultProps} />)
    expect(screen.queryByText('How was your week, Alex?')).toBeNull()
  })

  it('reopens in a new week even if last week was dismissed', () => {
    window.localStorage.setItem('lifequest-ritual-weekly_review-dismissed-2026-09-07', '1')

    render(<WeeklyReviewPrompt {...defaultProps} />)

    expect(screen.getByText('How was your week, Alex?')).toBeTruthy()
  })
})

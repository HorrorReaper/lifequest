import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EveningReviewPrompt } from './EveningReviewPrompt'

const TODAY = '2026-08-02'
const TEMPLATE_ID = 'evening-review-template-id'

// Node 22+'s experimental global `localStorage` shadows jsdom's real
// implementation in this project's Vitest setup (throws/undefined without
// --localstorage-file), so window.localStorage is unusable as-is here. A
// minimal in-memory stand-in keeps this test self-contained rather than
// changing shared Vitest config for one test file.
function installLocalStorageStub() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  })
}

const defaultProps = {
  today: TODAY,
  isEvening: true,
  reviewDone: false,
  templateId: TEMPLATE_ID,
  username: 'Alex',
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

  it('falls back to the same default name as the morning prompt when there is no username', () => {
    render(<EveningReviewPrompt {...defaultProps} username={null} />)

    expect(screen.getByText('How was your day, Adventurer?')).toBeTruthy()
  })

  it('stays closed before 8pm', () => {
    render(<EveningReviewPrompt {...defaultProps} isEvening={false} />)

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('stays closed once the evening review is already done today', () => {
    render(<EveningReviewPrompt {...defaultProps} reviewDone />)

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('stays closed when the Evening Review template could not be found', () => {
    render(<EveningReviewPrompt {...defaultProps} templateId={null} />)

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('shows the day summary and links straight into the journal entry', () => {
    render(<EveningReviewPrompt {...defaultProps} />)

    expect(screen.getByText('2/3 habits')).toBeTruthy()
    expect(screen.getByText('4 tasks completed')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Start evening review' }).getAttribute('href')
    ).toBe(`/journal/new/${TEMPLATE_ID}`)
  })

  it('closes and remembers the dismissal for the rest of the day when the user picks "Not now"', () => {
    const { unmount } = render(<EveningReviewPrompt {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
    expect(
      window.localStorage.getItem(`lifequest-evening-review-dismissed-${TODAY}`)
    ).toBe('1')

    // Simulate a fresh page load later the same evening: still dismissed.
    unmount()
    render(<EveningReviewPrompt {...defaultProps} />)
    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('reopens on a new day even if yesterday was dismissed', () => {
    window.localStorage.setItem('lifequest-evening-review-dismissed-2026-08-01', '1')

    render(<EveningReviewPrompt {...defaultProps} />)

    expect(screen.getByText('How was your day, Alex?')).toBeTruthy()
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DailyPlanPrompt } from './DailyPlanPrompt'

const TODAY = '2026-08-02'

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

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  cleanup()
})

describe('DailyPlanPrompt', () => {
  it('opens when the plan is not committed and has not been dismissed today', () => {
    render(<DailyPlanPrompt today={TODAY} planCommitted={false} username="Alex" />)

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
  })

  it('falls back to the same default name as the dashboard hero when there is no username', () => {
    render(<DailyPlanPrompt today={TODAY} planCommitted={false} username={null} />)

    expect(screen.getByText('Welcome back, Adventurer 👋')).toBeTruthy()
  })

  it('stays closed once the plan is already committed', () => {
    render(<DailyPlanPrompt today={TODAY} planCommitted username="Alex" />)

    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('closes and remembers the dismissal for the rest of the day when the user picks "Not now"', () => {
    const { unmount } = render(
      <DailyPlanPrompt today={TODAY} planCommitted={false} username="Alex" />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
    expect(window.localStorage.getItem(`lifequest-plan-prompt-dismissed-${TODAY}`)).toBe('1')

    // Simulate a fresh page load later the same day: still dismissed.
    unmount()
    render(<DailyPlanPrompt today={TODAY} planCommitted={false} username="Alex" />)
    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('reopens on a new day even if yesterday was dismissed', () => {
    window.localStorage.setItem('lifequest-plan-prompt-dismissed-2026-08-01', '1')

    render(<DailyPlanPrompt today={TODAY} planCommitted={false} username="Alex" />)

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
  })
})

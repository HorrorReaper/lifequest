import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DailyPlanPrompt } from './DailyPlanPrompt'
import { installLocalStorageStub } from '../../../test/local-storage-stub'

const TODAY = '2026-08-02'
const copy = { title: 'Welcome back, Alex 👋', description: 'Set your Top Three.', ctaLabel: 'Start briefing' }

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  cleanup()
})

describe('DailyPlanPrompt', () => {
  it('opens when the plan is not committed and has not been dismissed today', () => {
    render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
    expect(screen.getByText('Set your Top Three.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start briefing' }).getAttribute('href')).toBe('/plan')
  })

  it('stays closed once the plan is already committed', () => {
    render(<DailyPlanPrompt today={TODAY} planCommitted copy={copy} />)

    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('closes and remembers the dismissal for the rest of the day when the user picks "Not now"', () => {
    const { unmount } = render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
    expect(window.localStorage.getItem(`lifequest-ritual-daily_plan-dismissed-${TODAY}`)).toBe('1')

    // Simulate a fresh page load later the same day: still dismissed.
    unmount()
    render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)
    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('reopens on a new day even if yesterday was dismissed', () => {
    window.localStorage.setItem('lifequest-ritual-daily_plan-dismissed-2026-08-01', '1')

    render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
  })

  it('stays closed while a weekly prompt it yields to is still unanswered', () => {
    render(
      <DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} heldBackBy="lifequest-ritual-weekly_plan-dismissed-2026-07-27" />
    )

    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('opens once the weekly prompt it yields to has been dismissed', () => {
    window.localStorage.setItem('lifequest-ritual-weekly_plan-dismissed-2026-07-27', '1')

    render(
      <DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} heldBackBy="lifequest-ritual-weekly_plan-dismissed-2026-07-27" />
    )

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WeeklyPlanPrompt } from './WeeklyPlanPrompt'
import { WEEKLY_PLAN_TEMPLATE_ID } from '@/lib/weekly-rituals'
import { installLocalStorageStub } from '../../../test/local-storage-stub'

const WEEK_START = '2026-09-21'

const defaultProps = {
  weekStart: WEEK_START,
  isWindow: true,
  planDone: false,
  username: 'Alex',
  openTaskCount: 9,
}

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  cleanup()
})

describe('WeeklyPlanPrompt', () => {
  it('opens on Monday when the plan is not written and not dismissed', () => {
    render(<WeeklyPlanPrompt {...defaultProps} />)

    expect(screen.getByText('New week, Alex 🗓️')).toBeTruthy()
  })

  it('falls back to the same default name as the daily prompts', () => {
    render(<WeeklyPlanPrompt {...defaultProps} username={null} />)

    expect(screen.getByText('New week, Adventurer 🗓️')).toBeTruthy()
  })

  it('stays closed outside the window', () => {
    render(<WeeklyPlanPrompt {...defaultProps} isWindow={false} />)

    expect(screen.queryByText('New week, Alex 🗓️')).toBeNull()
  })

  it('stays closed once this week\'s plan exists', () => {
    render(<WeeklyPlanPrompt {...defaultProps} planDone />)

    expect(screen.queryByText('New week, Alex 🗓️')).toBeNull()
  })

  it('shows how many tasks are waiting', () => {
    render(<WeeklyPlanPrompt {...defaultProps} />)

    expect(screen.getByText('9 open tasks')).toBeTruthy()
  })

  it('reads naturally with a single open task', () => {
    render(<WeeklyPlanPrompt {...defaultProps} openTaskCount={1} />)

    expect(screen.getByText('1 open task')).toBeTruthy()
  })

  it('links to a new entry of the weekly plan template', () => {
    render(<WeeklyPlanPrompt {...defaultProps} />)

    const link = screen.getByRole('link', { name: 'Plan the week' })
    expect(link.getAttribute('href')).toBe(`/journal/new/${WEEKLY_PLAN_TEMPLATE_ID}`)
  })

  it('closes and remembers the dismissal for the rest of the week on "Not now"', () => {
    const { unmount } = render(<WeeklyPlanPrompt {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('New week, Alex 🗓️')).toBeNull()
    expect(
      window.localStorage.getItem(`lifequest-weekly-plan-dismissed-${WEEK_START}`)
    ).toBe('1')

    unmount()
    render(<WeeklyPlanPrompt {...defaultProps} />)
    expect(screen.queryByText('New week, Alex 🗓️')).toBeNull()
  })

  it('reopens in a new week even if last week was dismissed', () => {
    window.localStorage.setItem('lifequest-weekly-plan-dismissed-2026-09-14', '1')

    render(<WeeklyPlanPrompt {...defaultProps} />)

    expect(screen.getByText('New week, Alex 🗓️')).toBeTruthy()
  })
})

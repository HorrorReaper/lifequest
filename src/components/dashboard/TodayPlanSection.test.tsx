import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TodayPlanSection,
  type DashboardPlanBlock,
} from '@/components/dashboard/TodayPlanSection'

function block(overrides: Partial<DashboardPlanBlock> = {}): DashboardPlanBlock {
  return {
    id: 'block-1',
    startTime: '09:00',
    endTime: '10:00',
    title: 'Deep work',
    category: 'deep_work',
    missionType: null,
    ...overrides,
  }
}

/** 12:30, i.e. inside the 12:00-13:00 block of the fixture day. */
const MIDDAY = 12 * 60 + 30

function day(): DashboardPlanBlock[] {
  return [
    block({ id: 'b1', startTime: '07:00', endTime: '08:00', title: 'Morning pages' }),
    block({ id: 'b2', startTime: '08:00', endTime: '09:00', title: 'Gym', category: 'exercise' }),
    block({ id: 'b3', startTime: '09:00', endTime: '12:00', title: 'Deep work' }),
    block({ id: 'b4', startTime: '12:00', endTime: '13:00', title: 'Lunch', category: 'break' }),
    block({ id: 'b5', startTime: '13:00', endTime: '14:00', title: 'Standup', category: 'meeting' }),
    block({ id: 'b6', startTime: '14:00', endTime: '16:00', title: 'Review' }),
    block({ id: 'b7', startTime: '16:00', endTime: '17:00', title: 'Inbox' }),
    block({ id: 'b8', startTime: '19:00', endTime: '20:00', title: 'Reading' }),
  ]
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('TodayPlanSection', () => {
  it('leads with the block happening right now', () => {
    render(<TodayPlanSection blocks={day()} nowMinutes={MIDDAY} />)

    expect(screen.getByText('Lunch')).toBeTruthy()
    expect(screen.getByText('Now')).toBeTruthy()
  })

  it('hides the blocks already behind you', () => {
    render(<TodayPlanSection blocks={day()} nowMinutes={MIDDAY} />)

    expect(screen.queryByText('Morning pages')).toBeNull()
    expect(screen.queryByText('Gym')).toBeNull()
  })

  it('shows only the next few upcoming blocks while collapsed', () => {
    render(<TodayPlanSection blocks={day()} nowMinutes={MIDDAY} />)

    expect(screen.getByText('Standup')).toBeTruthy()
    expect(screen.getByText('Review')).toBeTruthy()
    expect(screen.getByText('Inbox')).toBeTruthy()
    expect(screen.queryByText('Reading')).toBeNull()
  })

  it('reveals the whole day, morning included, when expanded', () => {
    render(<TodayPlanSection blocks={day()} nowMinutes={MIDDAY} />)

    fireEvent.click(screen.getByRole('button', { name: /show full day/i }))

    expect(screen.getByText('Morning pages')).toBeTruthy()
    expect(screen.getByText('Reading')).toBeTruthy()
  })

  it('says how many blocks the collapsed view is holding back', () => {
    render(<TodayPlanSection blocks={day()} nowMinutes={MIDDAY} />)

    expect(screen.getByRole('button', { name: /3 earlier/i })).toBeTruthy()
  })

  it('leads with the next block when the gap between blocks is now', () => {
    // 18:00 sits between the 16:00-17:00 and 19:00-20:00 blocks.
    render(<TodayPlanSection blocks={day()} nowMinutes={18 * 60} />)

    expect(screen.getByText('Next')).toBeTruthy()
    expect(screen.getByText('Reading')).toBeTruthy()
    expect(screen.queryByText('Now')).toBeNull()
  })

  it('counts what is still ahead', () => {
    render(<TodayPlanSection blocks={day()} nowMinutes={MIDDAY} />)

    expect(screen.getByText('5 left')).toBeTruthy()
  })

  it('moves the highlight on as the day passes, without a reload', () => {
    vi.useFakeTimers()
    // 12:59 -- one minute before Lunch ends and Standup takes over.
    render(<TodayPlanSection blocks={day()} nowMinutes={12 * 60 + 59} />)

    expect(screen.getByText('Lunch').closest('li')?.textContent).toContain('Now')

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(screen.getByText('Standup').closest('li')?.textContent).toContain('Now')
  })

  it('offers a way to plan when the day is empty', () => {
    render(<TodayPlanSection blocks={[]} nowMinutes={MIDDAY} />)

    expect(screen.getByRole('link', { name: /plan my day/i })).toBeTruthy()
  })

  it('does not offer to expand a day that fits on screen', () => {
    render(
      <TodayPlanSection
        blocks={[block({ id: 'b1', startTime: '13:00', endTime: '14:00', title: 'Standup' })]}
        nowMinutes={MIDDAY}
      />
    )

    expect(screen.queryByRole('button', { name: /show full day/i })).toBeNull()
  })

  it('lets you look back over a day that is entirely spent', () => {
    render(<TodayPlanSection blocks={day()} nowMinutes={23 * 60} />)

    expect(screen.getByText(/every block is behind you/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /show full day/i }))
    expect(screen.getByText('Morning pages')).toBeTruthy()
  })
})

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {} }),
}))

import { useUserStore } from '@/lib/stores/user-store'
import type { StreakCelebration } from '@/lib/streak'
import { StreakOverlay, describeStreakExtension } from './streak-overlay'
import { LevelUpOverlay } from './level-up-overlay'
import { ChallengeDayOverlay } from '@/components/challenges/ChallengeDayOverlay'

const oneToTwo: StreakCelebration = { from: 1, to: 2, usedFreeze: false, bonusXp: 0 }

beforeEach(() => {
  useUserStore.setState({ pendingStreak: null, pendingChallengeDay: null, pendingLevelUp: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('describeStreakExtension', () => {
  it('names the new length and the way to the next milestone', () => {
    expect(describeStreakExtension(oneToTwo)).toEqual({
      eyebrow: 'Streak extended!',
      title: '2 days',
      subtitle: '5 days to your 7-day bonus',
    })
  })

  it('counts the last day before a milestone in the singular', () => {
    expect(describeStreakExtension({ ...oneToTwo, from: 5, to: 6 }).subtitle).toBe(
      '1 day to your 7-day bonus'
    )
  })

  it('names the bonus on the day a milestone is reached', () => {
    expect(describeStreakExtension({ from: 6, to: 7, usedFreeze: false, bonusXp: 50 }).subtitle).toBe(
      '+50 XP streak bonus'
    )
  })

  it('says when a freeze carried the streak', () => {
    expect(describeStreakExtension({ from: 3, to: 4, usedFreeze: true, bonusXp: 0 }).subtitle).toBe(
      'Streak freeze used · 3 days to your 7-day bonus'
    )
  })

  it('keeps going past the last milestone', () => {
    expect(describeStreakExtension({ from: 120, to: 121, usedFreeze: false, bonusXp: 0 }).subtitle).toBe(
      'Keep the flame alive.'
    )
  })
})

describe('StreakOverlay', () => {
  it('shows when a streak is reported and closes on a tap', () => {
    render(<StreakOverlay />)
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => useUserStore.getState().notifyStreakExtended(oneToTwo))

    const dialog = screen.getByRole('dialog', { name: 'Streak extended!' })
    expect(dialog.textContent).toContain('2 days')
    fireEvent.click(dialog)
    expect(useUserStore.getState().pendingStreak).toBeNull()
  })

  it('counts up from the old streak to the new one', () => {
    vi.useFakeTimers()
    render(<StreakOverlay />)

    act(() => useUserStore.getState().notifyStreakExtended(oneToTwo))
    expect(screen.getByTestId('streak-count').textContent).toBe('1')

    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByTestId('streak-count').textContent).toBe('2')
  })

  it('waits for a challenge day and holds a level-up back until it is closed', () => {
    render(
      <>
        <ChallengeDayOverlay />
        <StreakOverlay />
        <LevelUpOverlay />
      </>
    )

    act(() => {
      useUserStore.getState().notifyChallengeDay({
        enrollmentId: 'enrollment-1',
        challengeTitle: 'Morning pages',
        dayNumber: 2,
        totalDays: 14,
        challengeCompleted: false,
      })
      useUserStore.getState().notifyStreakExtended(oneToTwo)
      useUserStore.getState().notifyLevelUp(5)
    })
    expect(screen.getByRole('dialog', { name: 'Day complete!' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Streak extended!' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Level Up!' })).toBeNull()

    act(() => useUserStore.getState().clearChallengeDay())
    expect(screen.getByRole('dialog', { name: 'Streak extended!' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Level Up!' })).toBeNull()

    act(() => useUserStore.getState().clearStreakExtended())
    expect(screen.getByRole('dialog', { name: 'Level Up!' })).toBeTruthy()
  })
})

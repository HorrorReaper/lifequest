import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {} }),
}))

import { useUserStore, type ChallengeDayCelebration } from '@/lib/stores/user-store'
import { ChallengeDayOverlay, describeChallengeDay } from './ChallengeDayOverlay'
import { ChallengeCompletionNotifier } from './ChallengeCompletionNotifier'
import { LevelUpOverlay } from '@/components/ui/level-up-overlay'

const day3: ChallengeDayCelebration = {
  enrollmentId: 'enrollment-1',
  challengeTitle: '14 Days to Unfuck Your Life',
  dayNumber: 3,
  totalDays: 14,
  challengeCompleted: false,
  xpReward: 1000,
  coinReward: 500,
}

function installSessionStorageStub() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'sessionStorage', {
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
  installSessionStorageStub()
  useUserStore.setState({ pendingChallengeDay: null, pendingLevelUp: null })
})

afterEach(cleanup)

describe('describeChallengeDay', () => {
  it('names the day and how far along the challenge is', () => {
    expect(describeChallengeDay(day3)).toEqual({
      eyebrow: 'Day complete!',
      title: '14 Days to Unfuck Your Life',
      subtitle: '3 of 14 days',
    })
  })

  it('celebrates the whole challenge on its last day, with the rewards when known', () => {
    expect(describeChallengeDay({ ...day3, dayNumber: 14, challengeCompleted: true })).toMatchObject({
      eyebrow: 'Challenge complete!',
      subtitle: '+1000 XP · +500 coins',
    })
    expect(
      describeChallengeDay({ ...day3, challengeCompleted: true, xpReward: undefined, coinReward: undefined })
    ).toMatchObject({ subtitle: 'All 14 days done.' })
  })
})

describe('ChallengeDayOverlay', () => {
  it('shows when a day is reported and closes on a tap', () => {
    render(<ChallengeDayOverlay />)
    expect(screen.queryByRole('dialog')).toBeNull()

    act(() => useUserStore.getState().notifyChallengeDay(day3))

    const dialog = screen.getByRole('dialog', { name: 'Day complete!' })
    expect(dialog.textContent).toContain('3 of 14 days')
    fireEvent.click(dialog)
    expect(useUserStore.getState().pendingChallengeDay).toBeNull()
  })

  it('holds a level-up back until the challenge celebration is closed', () => {
    render(
      <>
        <ChallengeDayOverlay />
        <LevelUpOverlay />
      </>
    )

    act(() => {
      useUserStore.getState().notifyChallengeDay({ ...day3, dayNumber: 14, challengeCompleted: true })
      useUserStore.getState().notifyLevelUp(5)
    })
    expect(screen.getByRole('dialog', { name: 'Challenge complete!' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Level Up!' })).toBeNull()

    act(() => useUserStore.getState().clearChallengeDay())
    expect(screen.getByRole('dialog', { name: 'Level Up!' })).toBeTruthy()
  })
})

describe('ChallengeCompletionNotifier', () => {
  it('celebrates a day the page load completed', () => {
    render(<ChallengeCompletionNotifier celebrations={[day3]} />)
    expect(useUserStore.getState().pendingChallengeDay).toEqual(day3)
  })

  it('does not celebrate the same day twice in one tab, as on back navigation', () => {
    const first = render(<ChallengeCompletionNotifier celebrations={[day3]} />)
    act(() => useUserStore.getState().clearChallengeDay())
    first.unmount()

    render(<ChallengeCompletionNotifier celebrations={[day3]} />)
    expect(useUserStore.getState().pendingChallengeDay).toBeNull()
  })

  it('does nothing when the load completed nothing', () => {
    render(<ChallengeCompletionNotifier celebrations={[]} />)
    expect(useUserStore.getState().pendingChallengeDay).toBeNull()
  })
})

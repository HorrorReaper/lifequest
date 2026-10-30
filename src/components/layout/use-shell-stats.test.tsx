import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useUserStore } from '@/lib/stores/user-store'
import { getDefaultShellStats, type ShellStats } from '@/lib/shell-stats'
import { useShellStats } from './use-shell-stats'

const server: ShellStats = {
  totalXp: 300,
  streak: 4,
  coins: 25,
  equippedItems: { hat: 'trail-cap', jacket: null, backpack: null, boots: null },
}

beforeEach(() => {
  useUserStore.setState({
    totalXp: 0,
    currentStreak: 0,
    coins: 0,
    equippedItems: getDefaultShellStats().equippedItems,
    shellSynced: false,
  })
})

afterEach(cleanup)

describe('useShellStats', () => {
  it('carries the server values into the store and reads them back', () => {
    const { result } = renderHook(() => useShellStats(server))

    expect(result.current).toEqual(server)
    expect(useUserStore.getState().totalXp).toBe(300)
    expect(useUserStore.getState().currentStreak).toBe(4)
    expect(useUserStore.getState().coins).toBe(25)
    expect(useUserStore.getState().equippedItems.hat).toBe('trail-cap')
  })

  it('follows the store when something earns XP or coins elsewhere in the app', () => {
    const { result } = renderHook(() => useShellStats(server))

    act(() => {
      useUserStore.getState().addXp(50, 300)
      useUserStore.getState().setCoins(30)
      useUserStore.getState().updateStreak(5)
      useUserStore.getState().setEquippedItems({ ...server.equippedItems, hat: 'sun-hat' })
    })

    expect(result.current.totalXp).toBe(350)
    expect(result.current.coins).toBe(30)
    expect(result.current.streak).toBe(5)
    expect(result.current.equippedItems.hat).toBe('sun-hat')
  })

  it('re-syncs when the server hands down fresh values, as after router.refresh()', () => {
    const { result, rerender } = renderHook(({ stats }) => useShellStats(stats), {
      initialProps: { stats: server },
    })

    rerender({ stats: { ...server, totalXp: 900, coins: 10 } })

    expect(result.current.totalXp).toBe(900)
    expect(result.current.coins).toBe(10)
  })
})

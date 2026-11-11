import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchShellStats, getDefaultShellStats } from './shell-stats'

type Result = { data: unknown; error?: unknown }

/** A client whose every `.from(table)...maybeSingle()` resolves to `tables[table]`. */
function fakeClient(tables: Record<string, Result>) {
  return {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => tables[table] ?? { data: null, error: null },
      }
      return chain
    },
  } as unknown as SupabaseClient
}

describe('fetchShellStats', () => {
  it('reads XP and streak from the profile, coins from the city row, items from the avatar row', async () => {
    const stats = await fetchShellStats(
      fakeClient({
        profiles: {
          data: {
            total_xp: 640,
            current_streak: 5,
            last_journal_date: '2026-07-24',
            streak_freezes: 0,
            timezone: 'Europe/Berlin',
          },
        },
        city_states: { data: { coins: 120 } },
        avatar_states: {
          data: { unlocked_item_ids: ['sun-hat'], equipped_items: { hat: 'sun-hat' } },
        },
      }),
      'user-1',
      new Date('2026-07-25T10:00:00Z')
    )

    expect(stats).toEqual({
      totalXp: 640,
      streak: 5,
      coins: 120,
      equippedItems: { hat: 'sun-hat', jacket: null, backpack: null, boots: null },
    })
  })

  it('shows a streak that a missed day has broken as 0, not as the stored length', async () => {
    const stats = await fetchShellStats(
      fakeClient({
        profiles: {
          data: {
            total_xp: 640,
            current_streak: 5,
            last_journal_date: '2026-07-20',
            streak_freezes: 1,
            timezone: 'Europe/Berlin',
          },
        },
      }),
      'user-1',
      new Date('2026-07-25T10:00:00Z')
    )

    expect(stats.streak).toBe(0)
  })

  it('falls back to defaults for a user with no rows yet', async () => {
    expect(await fetchShellStats(fakeClient({}), 'user-1')).toEqual(getDefaultShellStats())
  })

  it('keeps the rest when the avatar read fails, instead of throwing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stats = await fetchShellStats(
      fakeClient({
        profiles: { data: { total_xp: 50, current_streak: 1 } },
        city_states: { data: { coins: 7 } },
        avatar_states: { data: null, error: new Error('boom') },
      }),
      'user-1'
    )

    expect(stats.totalXp).toBe(50)
    expect(stats.coins).toBe(7)
    expect(stats.equippedItems).toEqual(getDefaultShellStats().equippedItems)
    consoleError.mockRestore()
  })
})

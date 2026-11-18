import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordStreakDay } from '@/lib/streak-day'

interface Profile {
  total_xp: number
  current_streak: number
  best_streak: number
  last_journal_date: string | null
  streak_freezes: number
}

/** Just enough of the Supabase client for the profile read and the writes. */
function fakeClient(profile: Profile) {
  const inserts: Record<string, Record<string, unknown>[]> = {}
  const updates: Record<string, Record<string, unknown>[]> = {}
  let current = { ...profile }
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            single: async () => {
              if (table === 'profiles') return { data: current, error: null }
              throw new Error(`unexpected select on ${table}`)
            },
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          ;(inserts[table] ??= []).push(payload)
          return Promise.resolve({ data: null, error: null })
        },
        update: (payload: Record<string, unknown>) => {
          ;(updates[table] ??= []).push(payload)
          if (table === 'profiles') current = { ...current, ...payload }
          return { eq: async () => ({ data: null, error: null }) }
        },
      }
    },
  } as unknown as SupabaseClient
  return { client, inserts, updates, profile: () => current }
}

const BASE: Profile = {
  total_xp: 100,
  current_streak: 4,
  best_streak: 4,
  last_journal_date: '2026-07-24',
  streak_freezes: 0,
}

describe('recordStreakDay', () => {
  it('continues the streak from yesterday without XP of its own', async () => {
    const fake = fakeClient(BASE)
    const result = await recordStreakDay(fake.client, { userId: 'u1', today: '2026-07-25' })

    expect(result).toMatchObject({ streak: 5, xpEarned: 0, totalXp: 100 })
    expect(result.celebration).not.toBeNull()
    expect(fake.profile()).toMatchObject({
      current_streak: 5,
      best_streak: 5,
      last_journal_date: '2026-07-25',
      total_xp: 100,
    })
  })

  it('changes nothing on a second call the same day', async () => {
    const fake = fakeClient({ ...BASE, last_journal_date: '2026-07-25' })
    const result = await recordStreakDay(fake.client, { userId: 'u1', today: '2026-07-25' })

    expect(result).toMatchObject({ streak: 4, xpEarned: 0, celebration: null })
    expect(fake.profile().current_streak).toBe(4)
    expect(fake.inserts.xp_events).toBeUndefined()
  })

  it('pays a milestone bonus against the source it was given', async () => {
    const fake = fakeClient({ ...BASE, current_streak: 6, best_streak: 6 })
    const result = await recordStreakDay(fake.client, {
      userId: 'u1',
      today: '2026-07-25',
      sourceId: 'plan-1',
    })

    expect(result.streak).toBe(7)
    expect(fake.inserts.xp_events).toEqual([
      expect.objectContaining({ source_type: 'streak_bonus', source_id: 'plan-1', xp_amount: 50 }),
    ])
    expect(result).toMatchObject({ xpEarned: 50, totalXp: 150 })
  })
})

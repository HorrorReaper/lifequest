import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchProfileStreak } from './profile-streak'

function fakeClient(result: { data: unknown; error?: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ error: null, ...result }),
  }
  return { from: () => chain } as unknown as SupabaseClient
}

const now = new Date('2026-07-25T10:00:00Z')

describe('fetchProfileStreak', () => {
  it('returns the streak as it stands today and the stored best streak', async () => {
    const streak = await fetchProfileStreak(
      fakeClient({
        data: {
          current_streak: 9,
          best_streak: 12,
          last_journal_date: '2026-07-24',
          streak_freezes: 0,
          timezone: 'Europe/Berlin',
        },
      }),
      'user-1',
      now
    )

    expect(streak).toEqual({ current: 9, best: 12 })
  })

  it('reports a broken streak as 0 but keeps the best streak', async () => {
    const streak = await fetchProfileStreak(
      fakeClient({
        data: {
          current_streak: 9,
          best_streak: 12,
          last_journal_date: '2026-07-21',
          streak_freezes: 1,
          timezone: 'Europe/Berlin',
        },
      }),
      'user-1',
      now
    )

    expect(streak).toEqual({ current: 0, best: 12 })
  })

  it('returns zeros without a profile row', async () => {
    expect(await fetchProfileStreak(fakeClient({ data: null }), 'user-1', now)).toEqual({
      current: 0,
      best: 0,
    })
  })

  it('throws when the read fails', async () => {
    await expect(
      fetchProfileStreak(fakeClient({ data: null, error: new Error('boom') }), 'user-1', now)
    ).rejects.toThrow('boom')
  })
})

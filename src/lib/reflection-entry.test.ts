import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { saveReflectionEntry } from '@/lib/reflection-entry'
import { DAILY_REFLECTION_FIELD_ID, DAILY_REFLECTION_TEMPLATE_ID } from '@/lib/daily-reflection'

interface Profile {
  total_xp: number
  current_streak: number
  best_streak: number
  last_journal_date: string | null
  streak_freezes: number
}

/**
 * A minimal stand-in for the Supabase client, built just far enough to carry
 * the handful of chains `saveReflectionEntry` calls. It records every insert
 * and update by table name so a test can assert on the sequence of writes
 * without a real database.
 */
function fakeClient({
  profile,
  template = { name: 'Daily Reflection', xp_reward: 10 },
}: {
  profile: Profile
  template?: { name: string; xp_reward: number }
}) {
  const inserts: Record<string, unknown[]> = {}
  const updates: Record<string, unknown[]> = {}
  const nextEntryId = 'entry-1'
  let currentProfile = { ...profile }

  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            single: async () => {
              if (table === 'journal_templates') return { data: template, error: null }
              if (table === 'profiles') return { data: currentProfile, error: null }
              throw new Error(`unexpected select on ${table}`)
            },
          }),
        }),
        insert: (payload: unknown) => {
          const rows = Array.isArray(payload) ? payload : [payload]
          ;(inserts[table] ??= []).push(...rows)
          if (table === 'journal_entries') {
            return {
              select: () => ({
                single: async () => ({ data: { id: nextEntryId }, error: null }),
              }),
            }
          }
          return Promise.resolve({ data: null, error: null })
        },
        update: (payload: Record<string, unknown>) => {
          ;(updates[table] ??= []).push(payload)
          if (table === 'profiles') currentProfile = { ...currentProfile, ...payload }
          return { eq: async () => ({ data: null, error: null }) }
        },
      }
    },
  } as unknown as SupabaseClient

  return { client, inserts, updates, entryId: nextEntryId }
}

const FRESH_PROFILE: Profile = {
  total_xp: 100,
  current_streak: 0,
  best_streak: 3,
  last_journal_date: null,
  streak_freezes: 1,
}

describe('saveReflectionEntry', () => {
  it('writes the entry and its one response against the reflection template', async () => {
    const { client, inserts } = fakeClient({ profile: FRESH_PROFILE })

    await saveReflectionEntry(client, {
      userId: 'user-1',
      timezone: 'UTC',
      text: 'Grateful for a slow morning.',
      now: new Date('2026-01-06T12:00:00Z'),
    })

    expect(inserts.journal_entries).toEqual([
      {
        user_id: 'user-1',
        template_id: DAILY_REFLECTION_TEMPLATE_ID,
        entry_date: '2026-01-06',
        is_complete: true,
        xp_earned: 10,
      },
    ])
    expect(inserts.journal_responses).toEqual([
      {
        entry_id: 'entry-1',
        field_id: DAILY_REFLECTION_FIELD_ID,
        value_text: 'Grateful for a slow morning.',
        value_number: null,
        value_boolean: null,
        value_json: null,
        insight_type: null,
        topic_tags: [],
        insight_marked_at: null,
        insight_is_favorite: false,
      },
    ])
  })

  it('trims the answer before writing it', async () => {
    const { client, inserts } = fakeClient({ profile: FRESH_PROFILE })

    await saveReflectionEntry(client, { userId: 'user-1', timezone: 'UTC', text: '  hi  \n' })

    expect(inserts.journal_responses[0]).toMatchObject({ value_text: 'hi' })
  })

  it('refuses to write nothing', async () => {
    const { client, inserts } = fakeClient({ profile: FRESH_PROFILE })

    await expect(
      saveReflectionEntry(client, { userId: 'user-1', timezone: 'UTC', text: '   ' })
    ).rejects.toThrow()
    expect(inserts.journal_entries).toBeUndefined()
  })

  it('records the template completion as an XP event', async () => {
    const { client, inserts } = fakeClient({ profile: FRESH_PROFILE })

    await saveReflectionEntry(client, { userId: 'user-1', timezone: 'UTC', text: 'hi' })

    expect(inserts.xp_events).toEqual([
      {
        user_id: 'user-1',
        source_type: 'journal',
        source_id: 'entry-1',
        xp_amount: 10,
        description: 'Completed Daily Reflection',
      },
    ])
  })

  it('starts a streak on a first-ever reflection and reports the new totals', async () => {
    const { client, updates } = fakeClient({ profile: FRESH_PROFILE })

    const result = await saveReflectionEntry(client, {
      userId: 'user-1',
      timezone: 'UTC',
      text: 'hi',
    })

    expect(updates.profiles).toEqual([
      expect.objectContaining({
        total_xp: 110,
        current_streak: 1,
        best_streak: 3,
      }),
    ])
    expect(result).toMatchObject({ entryId: 'entry-1', xpEarned: 10, totalXp: 110, streak: 1 })
  })

  it('pays the streak milestone bonus and records it as its own XP event', async () => {
    const { client, inserts, updates } = fakeClient({
      profile: {
        total_xp: 500,
        current_streak: 6,
        best_streak: 6,
        last_journal_date: '2026-01-05', // one day before "today" injected below
        streak_freezes: 0,
      },
    })

    const result = await saveReflectionEntry(client, {
      userId: 'user-1',
      timezone: 'UTC',
      text: 'hi',
      now: new Date('2026-01-06T12:00:00Z'),
    })

    expect(inserts.xp_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source_type: 'streak_bonus', xp_amount: 50, description: '7-day streak bonus!' }),
      ])
    )
    expect(updates.profiles[0]).toMatchObject({
      total_xp: 500 + 10 + 50,
      current_streak: 7,
      best_streak: 7,
    })
    expect(result).toMatchObject({ xpEarned: 60, streak: 7 })
  })

  it('spends a freeze to bridge one missed day', async () => {
    const { client, updates } = fakeClient({
      profile: {
        total_xp: 200,
        current_streak: 4,
        best_streak: 4,
        last_journal_date: '2026-01-04',
        streak_freezes: 2,
      },
    })

    await saveReflectionEntry(client, {
      userId: 'user-1',
      timezone: 'UTC',
      text: 'hi',
      now: new Date('2026-01-06T12:00:00Z'), // one full day missed
    })

    expect(updates.profiles).toEqual(
      expect.arrayContaining([expect.objectContaining({ streak_freezes: 1 })])
    )
  })

  it('leaves the streak unchanged when a second reflection lands the same day', async () => {
    const { client } = fakeClient({
      profile: {
        total_xp: 100,
        current_streak: 2,
        best_streak: 2,
        last_journal_date: '2026-01-06',
        streak_freezes: 0,
      },
    })

    const result = await saveReflectionEntry(client, {
      userId: 'user-1',
      timezone: 'UTC',
      text: 'hi',
      now: new Date('2026-01-06T12:00:00Z'),
    })

    expect(result.streak).toBe(2)
  })
})

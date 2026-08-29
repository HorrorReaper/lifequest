import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import {
  awardFocusSessionXp,
  secondsLabel,
  sessionMinutes,
  summarizeFocusDay,
} from './focus-session'

function session(overrides: Partial<FocusSessionRow> = {}): FocusSessionRow {
  return {
    id: 'session-1',
    user_id: 'user',
    task_id: null,
    planned_minutes: 25,
    status: 'completed',
    started_at: '2026-08-27T09:00:00.000Z',
    ended_at: '2026-08-27T09:25:00.000Z',
    actual_seconds: 25 * 60,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('secondsLabel', () => {
  it('formats minutes and seconds', () => {
    expect(secondsLabel(90)).toBe('01:30')
  })

  it('clamps a negative remaining time to zero rather than showing a minus sign', () => {
    expect(secondsLabel(-5)).toBe('00:00')
  })
})

describe('sessionMinutes', () => {
  it('converts recorded seconds to whole minutes', () => {
    expect(sessionMinutes(session({ actual_seconds: 25 * 60 }))).toBe(25)
  })

  it('rounds down, so a part-minute never pays for a minute not served', () => {
    expect(sessionMinutes(session({ actual_seconds: 25 * 60 + 59 }))).toBe(25)
  })

  it('treats an unrecorded duration as zero', () => {
    expect(sessionMinutes(session({ actual_seconds: null }))).toBe(0)
  })
})

describe('summarizeFocusDay', () => {
  it('adds up the minutes actually focused', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a', actual_seconds: 25 * 60 }),
      session({ id: 'b', actual_seconds: 50 * 60 }),
    ])
    expect(summary.focusedMinutes).toBe(75)
  })

  it('leaves cancelled sessions out of the focused total', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a', actual_seconds: 25 * 60 }),
      session({ id: 'b', status: 'cancelled', actual_seconds: 30 * 60 }),
    ])
    expect(summary.focusedMinutes).toBe(25)
  })

  it('leaves a session still running out of the totals', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a', actual_seconds: 25 * 60 }),
      session({ id: 'b', status: 'active', actual_seconds: null, ended_at: null }),
    ])
    expect(summary.focusedMinutes).toBe(25)
    expect(summary.completedCount).toBe(1)
  })

  it('counts completed and cancelled sessions separately', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a' }),
      session({ id: 'b' }),
      session({ id: 'c', status: 'cancelled' }),
    ])
    expect(summary).toMatchObject({ completedCount: 2, cancelledCount: 1 })
  })

  it('reports the average completed session', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a', actual_seconds: 20 * 60 }),
      session({ id: 'b', actual_seconds: 40 * 60 }),
    ])
    expect(summary.averageMinutes).toBe(30)
  })

  it('reports the longest single stretch', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a', actual_seconds: 20 * 60 }),
      session({ id: 'b', actual_seconds: 45 * 60 }),
    ])
    expect(summary.longestMinutes).toBe(45)
  })

  it('measures adherence as time served against time blocked out', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a', planned_minutes: 50, actual_seconds: 25 * 60 }),
    ])
    expect(summary.plannedMinutes).toBe(50)
    expect(summary.adherence).toBeCloseTo(0.5)
  })

  it('groups focused time by the task it went to, biggest first', () => {
    const summary = summarizeFocusDay([
      session({ id: 'a', task_id: 'task-1', actual_seconds: 25 * 60 }),
      session({ id: 'b', task_id: 'task-2', actual_seconds: 50 * 60 }),
      session({ id: 'c', task_id: 'task-1', actual_seconds: 10 * 60 }),
    ])
    expect(summary.byTask).toEqual([
      { taskId: 'task-2', minutes: 50 },
      { taskId: 'task-1', minutes: 35 },
    ])
  })

  it('keeps sessions with no task under their own heading', () => {
    const summary = summarizeFocusDay([session({ id: 'a', task_id: null, actual_seconds: 25 * 60 })])
    expect(summary.byTask).toEqual([{ taskId: null, minutes: 25 }])
  })

  it('reports XP that matches the focused minutes exactly', () => {
    // The panel would otherwise claim a different number from the one the
    // XP award actually wrote, since both round per session.
    const sessions = [
      session({ id: 'a', actual_seconds: 25 * 60 + 40 }),
      session({ id: 'b', actual_seconds: 12 * 60 + 55 }),
    ]
    const summary = summarizeFocusDay(sessions)
    expect(summary.xpEarned).toBe(summary.focusedMinutes)
    expect(summary.xpEarned).toBe(37)
  })

  it('returns a zeroed summary for a day with no sessions', () => {
    expect(summarizeFocusDay([])).toMatchObject({
      focusedMinutes: 0,
      completedCount: 0,
      averageMinutes: 0,
      longestMinutes: 0,
      adherence: 0,
      byTask: [],
    })
  })

  it('does not divide by zero when nothing was planned', () => {
    const summary = summarizeFocusDay([session({ planned_minutes: 0, actual_seconds: 0 })])
    expect(summary.adherence).toBe(0)
  })
})

describe('awardFocusSessionXp', () => {
  function stubClient(options: { existingEvents?: unknown[]; totalXp?: number } = {}) {
    const eventInsert = vi.fn(async () => ({ error: null }))
    const profileUpdateBuilder = { eq: vi.fn(async () => ({ error: null })) }
    const profileUpdate = vi.fn(() => profileUpdateBuilder)

    const xpBuilder = {
      select: () => xpBuilder,
      eq: () => xpBuilder,
      limit: async () => ({ data: options.existingEvents ?? [], error: null }),
      insert: eventInsert,
    }
    const profileBuilder = {
      select: () => profileBuilder,
      eq: () => profileBuilder,
      single: async () => ({ data: { total_xp: options.totalXp ?? 0 }, error: null }),
      update: profileUpdate,
    }
    const client = {
      from: (table: string) => (table === 'xp_events' ? xpBuilder : profileBuilder),
    } as unknown as SupabaseClient

    return { client, eventInsert, profileUpdate }
  }

  it('pays one XP per focused minute', async () => {
    const { client, profileUpdate } = stubClient({ totalXp: 100 })
    await expect(
      awardFocusSessionXp(client, 'user-1', session({ actual_seconds: 25 * 60 }))
    ).resolves.toEqual({ awarded: true, xpAwarded: 25, previousTotal: 100, newTotal: 125 })
    expect(profileUpdate).toHaveBeenCalledWith({ total_xp: 125 })
  })

  it('records the session as the source, so the award can be traced back', async () => {
    const { client, eventInsert } = stubClient()
    await awardFocusSessionXp(client, 'user-1', session({ id: 'session-7' }))
    expect(eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'focus_session', source_id: 'session-7' })
    )
  })

  it('pays nothing twice for the same session', async () => {
    // Ending a session can be retried, and a double-tap on Complete is easy.
    const { client, eventInsert, profileUpdate } = stubClient({ existingEvents: [{ id: 'event-1' }] })
    await expect(awardFocusSessionXp(client, 'user-1', session())).resolves.toMatchObject({
      awarded: false,
      xpAwarded: 0,
    })
    expect(eventInsert).not.toHaveBeenCalled()
    expect(profileUpdate).not.toHaveBeenCalled()
  })

  it('writes nothing at all for a session too short to earn a minute', async () => {
    // Tapping Complete immediately is what stops this being farmable; it
    // must not leave a zero-XP event behind either.
    const { client, eventInsert, profileUpdate } = stubClient()
    await expect(
      awardFocusSessionXp(client, 'user-1', session({ actual_seconds: 20 }))
    ).resolves.toMatchObject({ awarded: false, xpAwarded: 0 })
    expect(eventInsert).not.toHaveBeenCalled()
    expect(profileUpdate).not.toHaveBeenCalled()
  })

  it('refuses to pay for a cancelled session', async () => {
    const { client, eventInsert } = stubClient()
    await expect(
      awardFocusSessionXp(client, 'user-1', session({ status: 'cancelled' }))
    ).resolves.toMatchObject({ awarded: false })
    expect(eventInsert).not.toHaveBeenCalled()
  })

  it('surfaces a failed write rather than reporting a phantom award', async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: async () => ({ data: null, error: { message: 'denied' } }),
    }
    const failing = { from: () => builder } as unknown as SupabaseClient
    await expect(awardFocusSessionXp(failing, 'user-1', session())).rejects.toBeTruthy()
  })
})

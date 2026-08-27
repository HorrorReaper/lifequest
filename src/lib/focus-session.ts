import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusSessionRow } from '@/lib/supabase/database.types'

export function secondsLabel(seconds: number) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * Whole minutes actually served. Rounded down deliberately: this is the
 * number XP is paid on, and a part-minute should never pay for a minute
 * that was not served.
 */
export function sessionMinutes(session: Pick<FocusSessionRow, 'actual_seconds'>) {
  return Math.floor((session.actual_seconds ?? 0) / 60)
}

export interface FocusDaySummary {
  focusedMinutes: number
  completedCount: number
  cancelledCount: number
  averageMinutes: number
  longestMinutes: number
  plannedMinutes: number
  /** Time served divided by time blocked out; 0 when nothing was planned. */
  adherence: number
  byTask: { taskId: string | null; minutes: number }[]
  xpEarned: number
}

/**
 * Only completed sessions count towards focused time. A cancelled session
 * still happened, so it is reported separately rather than hidden, but it
 * did not earn its minutes and neither did a session still running.
 */
export function summarizeFocusDay(sessions: FocusSessionRow[]): FocusDaySummary {
  const completed = sessions.filter((session) => session.status === 'completed')
  const minutes = completed.map(sessionMinutes)
  const focusedMinutes = minutes.reduce((sum, value) => sum + value, 0)
  const plannedMinutes = completed.reduce((sum, session) => sum + session.planned_minutes, 0)

  const byTaskId = new Map<string | null, number>()
  for (const session of completed) {
    byTaskId.set(session.task_id, (byTaskId.get(session.task_id) ?? 0) + sessionMinutes(session))
  }

  return {
    focusedMinutes,
    completedCount: completed.length,
    cancelledCount: sessions.filter((session) => session.status === 'cancelled').length,
    averageMinutes: completed.length ? Math.round(focusedMinutes / completed.length) : 0,
    longestMinutes: minutes.length ? Math.max(...minutes) : 0,
    plannedMinutes,
    adherence: plannedMinutes ? focusedMinutes / plannedMinutes : 0,
    byTask: [...byTaskId.entries()]
      .map(([taskId, taskMinutes]) => ({ taskId, minutes: taskMinutes }))
      .sort((a, b) => b.minutes - a.minutes),
    // Equal to focusedMinutes by construction: both round per session, so
    // the panel can never claim a different number from the one awarded.
    xpEarned: focusedMinutes,
  }
}

export interface FocusXpAwardResult {
  awarded: boolean
  xpAwarded: number
  previousTotal: number
  newTotal: number
}

const NO_AWARD: FocusXpAwardResult = {
  awarded: false,
  xpAwarded: 0,
  previousTotal: 0,
  newTotal: 0,
}

/**
 * Pays one XP per whole minute actually focused, once per session.
 *
 * Mirrors awardTaskCompletionXp: the xp_events row is the record of record,
 * and its (source_type, source_id) pair is what makes a retry or a
 * double-tapped Complete button safe to run twice.
 *
 * Nothing is written for a session worth zero minutes, which is what keeps
 * start → complete → start from farming XP: "completed" only means the
 * button was pressed, not that the planned time was served.
 */
export async function awardFocusSessionXp(
  supabase: SupabaseClient,
  userId: string,
  session: FocusSessionRow
): Promise<FocusXpAwardResult> {
  if (session.status !== 'completed') return NO_AWARD

  const award = sessionMinutes(session)
  if (award <= 0) return NO_AWARD

  const { data: existing, error: existingError } = await supabase
    .from('xp_events')
    .select('id')
    .eq('user_id', userId)
    .eq('source_type', 'focus_session')
    .eq('source_id', session.id)
    .limit(1)

  if (existingError) throw existingError
  if (existing && existing.length > 0) return NO_AWARD

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('total_xp')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError
  const previousTotal = typeof profile?.total_xp === 'number' ? profile.total_xp : 0

  const { error: eventError } = await supabase.from('xp_events').insert({
    user_id: userId,
    source_type: 'focus_session',
    source_id: session.id,
    xp_amount: award,
    description: `Focused for ${award} minute${award === 1 ? '' : 's'}`,
  })
  if (eventError) throw eventError

  const newTotal = previousTotal + award
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ total_xp: newTotal })
    .eq('id', userId)

  if (updateError) throw updateError
  return { awarded: true, xpAwarded: award, previousTotal, newTotal }
}

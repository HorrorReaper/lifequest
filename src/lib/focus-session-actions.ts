import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import type { FocusXpAwardResult } from './focus-session'

export async function startFocusSession(
  supabase: SupabaseClient,
  minutes: number,
  taskId?: string,
): Promise<FocusSessionRow> {
  const { data, error } = await supabase.rpc('start_focus_session', {
    p_planned_minutes: minutes,
    p_task_id: taskId ?? null,
  })
  if (error) throw error
  return data as FocusSessionRow
}

export async function finishFocusSession(
  supabase: SupabaseClient,
  sessionId: string,
  status: 'completed' | 'cancelled',
): Promise<FocusXpAwardResult> {
  const { data, error } = await supabase.rpc('finish_focus_session', {
    p_session_id: sessionId,
    p_status: status,
  })
  if (error) throw error
  return data as FocusXpAwardResult
}

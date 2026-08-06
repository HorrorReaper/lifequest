import type { SupabaseClient } from '@supabase/supabase-js'

// Thin, tool-agnostic access layer over the tool_entries table. Every tool
// reads and writes through this, so a new tool needs no data code of its own.

export interface ToolEntry<TPayload = unknown> {
  id: string
  toolId: string
  runId: string | null
  payload: TPayload
  createdAt: string
  updatedAt: string
}

interface ToolEntryRow {
  id: string
  tool_id: string
  run_id: string | null
  payload: unknown
  created_at: string
  updated_at: string
}

function toEntry<TPayload>(row: ToolEntryRow): ToolEntry<TPayload> {
  return {
    id: row.id,
    toolId: row.tool_id,
    runId: row.run_id,
    payload: row.payload as TPayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchToolEntries<TPayload>(
  supabase: SupabaseClient,
  userId: string,
  toolId: string,
  options: { runId?: string; limit?: number } = {}
): Promise<ToolEntry<TPayload>[]> {
  let query = supabase
    .from('tool_entries')
    .select('id, tool_id, run_id, payload, created_at, updated_at')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .order('created_at', { ascending: false })

  if (options.runId) query = query.eq('run_id', options.runId)
  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as ToolEntryRow[]).map((row) => toEntry<TPayload>(row))
}

/** The newest entry, i.e. the current value for single-value tools like Vision. */
export async function fetchLatestToolEntry<TPayload>(
  supabase: SupabaseClient,
  userId: string,
  toolId: string
): Promise<ToolEntry<TPayload> | null> {
  const entries = await fetchToolEntries<TPayload>(supabase, userId, toolId, { limit: 1 })
  return entries[0] ?? null
}

export async function createToolEntry<TPayload>(
  supabase: SupabaseClient,
  userId: string,
  toolId: string,
  payload: TPayload,
  runId?: string
): Promise<ToolEntry<TPayload>> {
  const { data, error } = await supabase
    .from('tool_entries')
    .insert({
      user_id: userId,
      tool_id: toolId,
      run_id: runId ?? null,
      payload: payload as never,
    })
    .select('id, tool_id, run_id, payload, created_at, updated_at')
    .single()

  if (error) throw error
  return toEntry<TPayload>(data as ToolEntryRow)
}

export async function updateToolEntry<TPayload>(
  supabase: SupabaseClient,
  entryId: string,
  payload: TPayload
): Promise<void> {
  const { error } = await supabase
    .from('tool_entries')
    .update({ payload: payload as never, updated_at: new Date().toISOString() })
    .eq('id', entryId)

  if (error) throw error
}

export async function deleteToolEntry(
  supabase: SupabaseClient,
  entryId: string
): Promise<void> {
  const { error } = await supabase.from('tool_entries').delete().eq('id', entryId)
  if (error) throw error
}

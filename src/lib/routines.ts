import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Habit, RoutineItemWithHabit, RoutineProgress, RoutineWithItems } from '@/lib/types'

type AppSupabase = SupabaseClient

type RawRoutineItem = Database['public']['Tables']['routine_items']['Row'] & {
  habits?: Habit | Habit[] | null
}

type RawRoutine = Database['public']['Tables']['routines']['Row'] & {
  routine_items?: RawRoutineItem[] | null
}

interface RoutineInput {
  name: string
  emoji?: string
  description?: string | null
  habitIds: string[]
}

function normalizeHabit(habit: Habit | Habit[] | null | undefined) {
  return Array.isArray(habit) ? habit[0] ?? null : habit ?? null
}

function normalizeRoutine(row: RawRoutine): RoutineWithItems {
  const items = (row.routine_items ?? [])
    .map((item): RoutineItemWithHabit | null => {
      const habit = normalizeHabit(item.habits)
      if (!habit) return null

      return {
        id: item.id,
        routine_id: item.routine_id,
        habit_id: item.habit_id,
        sort_order: item.sort_order,
        created_at: item.created_at,
        habit,
      }
    })
    .filter((item): item is RoutineItemWithHabit => item !== null)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    is_archived: row.is_archived,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
    items,
  }
}

function uniqueHabitIds(habitIds: string[]) {
  return Array.from(new Set(habitIds.filter(Boolean)))
}

export function calculateRoutineProgress(
  routine: RoutineWithItems,
  completedHabitIds: Set<string>
): RoutineProgress {
  const completedHabitIdsForRoutine = routine.items
    .filter((item) => completedHabitIds.has(item.habit_id))
    .map((item) => item.habit_id)

  return {
    routineId: routine.id,
    completed: completedHabitIdsForRoutine.length,
    total: routine.items.length,
    completedHabitIds: completedHabitIdsForRoutine,
  }
}

export async function fetchRoutines(
  supabase: AppSupabase,
  userId: string,
  includeArchived = false
): Promise<RoutineWithItems[]> {
  let query = supabase
    .from('routines')
    .select(
      `
      *,
      routine_items(
        id,
        routine_id,
        habit_id,
        sort_order,
        created_at,
        habits(*)
      )
    `
    )
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!includeArchived) query = query.eq('is_archived', false)

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as unknown as RawRoutine[]).map(normalizeRoutine)
}

export async function fetchRoutine(
  supabase: AppSupabase,
  userId: string,
  routineId: string
): Promise<RoutineWithItems | null> {
  const { data, error } = await supabase
    .from('routines')
    .select(
      `
      *,
      routine_items(
        id,
        routine_id,
        habit_id,
        sort_order,
        created_at,
        habits(*)
      )
    `
    )
    .eq('user_id', userId)
    .eq('id', routineId)
    .maybeSingle()

  if (error) throw error
  return data ? normalizeRoutine(data as unknown as RawRoutine) : null
}

export async function createRoutine(
  supabase: AppSupabase,
  userId: string,
  input: RoutineInput
): Promise<RoutineWithItems> {
  const { data, error } = await supabase
    .from('routines')
    .insert({
      user_id: userId,
      name: input.name.trim(),
      emoji: input.emoji ?? '🌅',
      description: input.description?.trim() || null,
    })
    .select('*')
    .single()

  if (error) throw error

  await replaceRoutineItems(supabase, data.id, input.habitIds)
  const routine = await fetchRoutine(supabase, userId, data.id)
  if (!routine) throw new Error('Routine was created but could not be loaded.')
  return routine
}

export async function updateRoutine(
  supabase: AppSupabase,
  userId: string,
  routineId: string,
  input: RoutineInput
): Promise<RoutineWithItems> {
  const { error } = await supabase
    .from('routines')
    .update({
      name: input.name.trim(),
      emoji: input.emoji ?? '🌅',
      description: input.description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', routineId)
    .eq('user_id', userId)

  if (error) throw error

  await replaceRoutineItems(supabase, routineId, input.habitIds)
  const routine = await fetchRoutine(supabase, userId, routineId)
  if (!routine) throw new Error('Routine was updated but could not be loaded.')
  return routine
}

export async function archiveRoutine(
  supabase: AppSupabase,
  userId: string,
  routineId: string,
  archived: boolean
) {
  const { error } = await supabase
    .from('routines')
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq('id', routineId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function deleteRoutine(supabase: AppSupabase, userId: string, routineId: string) {
  const { error } = await supabase
    .from('routines')
    .delete()
    .eq('id', routineId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function replaceRoutineItems(
  supabase: AppSupabase,
  routineId: string,
  habitIds: string[]
) {
  const { error: deleteError } = await supabase
    .from('routine_items')
    .delete()
    .eq('routine_id', routineId)

  if (deleteError) throw deleteError

  const rows = uniqueHabitIds(habitIds).map((habitId, index) => ({
    routine_id: routineId,
    habit_id: habitId,
    sort_order: index,
  }))

  if (rows.length === 0) return

  const { error } = await supabase.from('routine_items').insert(rows)
  if (error) throw error
}

export async function fetchCompletedHabitIdsForDate(
  supabase: AppSupabase,
  userId: string,
  date: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('habit_id')
    .eq('user_id', userId)
    .eq('log_date', date)
    .eq('completed', true)

  if (error) throw error
  return new Set(((data ?? []) as { habit_id: string }[]).map((row) => row.habit_id))
}

export async function completeRoutineHabitStep(
  supabase: AppSupabase,
  userId: string,
  habitId: string,
  date: string
) {
  const { error } = await supabase
    .from('habit_logs')
    .upsert(
      {
        user_id: userId,
        habit_id: habitId,
        log_date: date,
        completed: true,
        entry_id: null,
      },
      { onConflict: 'user_id,habit_id,log_date' }
    )

  if (error) throw error
}

export type { RoutineInput }

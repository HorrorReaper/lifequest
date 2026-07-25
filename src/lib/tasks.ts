import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskPriority = 'low' | 'medium' | 'high'

export interface ManagedTask {
  id: string
  user_id: string
  title: string
  description: string | null
  is_completed: boolean
  due_date: string | null
  priority: TaskPriority
  created_at: string
  updated_at: string
}

export interface TaskDraft {
  title: string
  description?: string | null
  due_date?: string | null
  priority?: TaskPriority
}

const TASK_SELECT =
  'id,user_id,title,description,is_completed,due_date,priority,created_at,updated_at'

function normalizeTask(value: unknown): ManagedTask {
  const task = value as Partial<ManagedTask>
  return {
    id: String(task.id ?? ''),
    user_id: String(task.user_id ?? ''),
    title: String(task.title ?? ''),
    description: typeof task.description === 'string' ? task.description : null,
    is_completed: task.is_completed === true,
    due_date: typeof task.due_date === 'string' ? task.due_date : null,
    priority:
      task.priority === 'high' || task.priority === 'low'
        ? task.priority
        : 'medium',
    created_at: typeof task.created_at === 'string' ? task.created_at : '',
    updated_at: typeof task.updated_at === 'string' ? task.updated_at : '',
  }
}

export async function fetchTasks(
  supabase: SupabaseClient,
  userId: string,
  options?: { onlyOpen?: boolean; limit?: number }
): Promise<ManagedTask[]> {
  let query = supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('user_id', userId)
    .order('is_completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (options?.onlyOpen) query = query.eq('is_completed', false)
  if (options?.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(normalizeTask)
}

export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  input: TaskDraft
): Promise<ManagedTask> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      due_date: input.due_date || null,
      priority: input.priority ?? 'medium',
    })
    .select(TASK_SELECT)
    .single()

  if (error) throw error
  return normalizeTask(data)
}

export async function toggleTask(
  supabase: SupabaseClient,
  taskId: string,
  isCompleted: boolean
): Promise<ManagedTask> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ is_completed: isCompleted })
    .eq('id', taskId)
    .select(TASK_SELECT)
    .single()

  if (error) throw error
  return normalizeTask(data)
}

export async function updateTask(
  supabase: SupabaseClient,
  taskId: string,
  patch: Partial<
    Pick<
      ManagedTask,
      'title' | 'description' | 'due_date' | 'priority' | 'is_completed'
    >
  >
): Promise<ManagedTask> {
  const cleanPatch = {
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.description !== undefined
      ? { description: patch.description?.trim() || null }
      : {}),
    ...(patch.due_date !== undefined ? { due_date: patch.due_date || null } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.is_completed !== undefined
      ? { is_completed: patch.is_completed }
      : {}),
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(cleanPatch)
    .eq('id', taskId)
    .select(TASK_SELECT)
    .single()

  if (error) throw error
  return normalizeTask(data)
}

export async function deleteTask(supabase: SupabaseClient, taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}

export interface TaskXpAwardResult {
  awarded: boolean
  previousTotal: number
  newTotal: number
}

export async function awardTaskCompletionXp(
  supabase: SupabaseClient,
  userId: string,
  task: Pick<ManagedTask, 'id' | 'title'>,
  award = 5
): Promise<TaskXpAwardResult> {
  const { data: existing, error: existingError } = await supabase
    .from('xp_events')
    .select('id')
    .eq('user_id', userId)
    .eq('source_type', 'task')
    .eq('source_id', task.id)
    .limit(1)

  if (existingError) throw existingError
  if (existing && existing.length > 0) {
    return { awarded: false, previousTotal: 0, newTotal: 0 }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('total_xp')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError
  const previousTotal =
    typeof profile?.total_xp === 'number' ? profile.total_xp : 0

  const { error: eventError } = await supabase.from('xp_events').insert({
    user_id: userId,
    source_type: 'task',
    source_id: task.id,
    xp_amount: award,
    description: `Completed task: ${task.title}`,
  })
  if (eventError) throw eventError

  const newTotal = previousTotal + award
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ total_xp: newTotal })
    .eq('id', userId)

  if (updateError) throw updateError
  return { awarded: true, previousTotal, newTotal }
}

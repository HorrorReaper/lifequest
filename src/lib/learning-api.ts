import type { SupabaseClient } from '@supabase/supabase-js'
import {
  validateLearningCatalog,
  type LearningCatalog,
  type LearningProgress,
} from '@/lib/learning-paths'
import type { Database, Json } from '@/lib/supabase/database.types'

interface LearningRpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>
}

function learningRpcClient(supabase: SupabaseClient<Database>) {
  return supabase as unknown as LearningRpcClient
}

export interface ExerciseSubmissionResult {
  correct: boolean
  explanation: string | null
  completed: boolean
  rewarded: boolean
  mistakes: number
  score: number | null
  masteryPoints: number
  xpAwarded: number
  coinsAwarded: number
}

function assertCatalog(value: unknown, answersRequired: boolean): LearningCatalog {
  if (!validateLearningCatalog(value, { answersRequired })) {
    throw new Error('The learning catalog returned by the database is invalid.')
  }
  return value
}

function assertProgress(value: unknown): LearningProgress {
  if (!value || typeof value !== 'object') throw new Error('Learning progress is invalid.')
  const progress = value as Partial<LearningProgress>
  if (progress.version !== 1 || !progress.completions || !progress.reflections) {
    throw new Error('Learning progress is invalid.')
  }
  return progress as LearningProgress
}

export async function fetchLearningCatalog(
  supabase: SupabaseClient<Database>
): Promise<LearningCatalog> {
  const { data, error } = await learningRpcClient(supabase).rpc('get_published_learning_catalog')
  if (error) throw error
  return assertCatalog(data, false)
}

export async function fetchLearningProgress(
  supabase: SupabaseClient<Database>
): Promise<LearningProgress> {
  const { data, error } = await learningRpcClient(supabase).rpc('get_learning_progress')
  if (error) throw error
  return assertProgress(data)
}

export async function fetchLearningExperience(supabase: SupabaseClient<Database>) {
  const [catalog, progress] = await Promise.all([
    fetchLearningCatalog(supabase),
    fetchLearningProgress(supabase),
  ])
  return { catalog, progress }
}

export async function submitLearningExercise(
  supabase: SupabaseClient<Database>,
  lessonId: string,
  exerciseId: string,
  response: Record<string, Json | undefined>
): Promise<ExerciseSubmissionResult> {
  const { data, error } = await learningRpcClient(supabase).rpc('submit_learning_exercise', {
    p_lesson_slug: lessonId,
    p_exercise_slug: exerciseId,
    p_response: response,
  })
  if (error) throw error
  return data as unknown as ExerciseSubmissionResult
}

export async function fetchAdminLearningCatalog(supabase: SupabaseClient<Database>) {
  const { data, error } = await learningRpcClient(supabase).rpc('admin_get_learning_catalog')
  if (error) throw error
  return assertCatalog(data, true)
}

export async function saveAdminLearningCatalog(
  supabase: SupabaseClient<Database>,
  catalog: LearningCatalog,
  changeSummary?: string
) {
  const { data, error } = await learningRpcClient(supabase).rpc('admin_save_learning_catalog', {
    p_catalog: catalog as unknown as Json,
    p_change_summary: changeSummary || null,
  })
  if (error) throw error
  return assertCatalog(data, true)
}

export async function publishAdminLearningCatalog(
  supabase: SupabaseClient<Database>,
  changeSummary?: string
) {
  const { data, error } = await learningRpcClient(supabase).rpc('admin_publish_learning_catalog', {
    p_change_summary: changeSummary || null,
  })
  if (error) throw error
  return assertCatalog(data, true)
}

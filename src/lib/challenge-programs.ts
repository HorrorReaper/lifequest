import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ChallengeCompletionType,
  ChallengeDayProgressRow,
  ChallengeDayRow,
  ChallengeEnrollmentRow,
  ChallengeTemplateRow,
} from '@/lib/supabase/database.types'
import { getQuestErrorMessage } from '@/lib/quests'
import type { PersonalChallengeInput } from '@/lib/personal-challenge'

// Data access for challenge programs (/challenges, the dashboard card, the
// public landing page): the ones admins publish and the personal ones users
// create for themselves, which share every table and RPC.

export interface ChallengeProgram {
  template: ChallengeTemplateRow
  days: ChallengeDayRow[]
  /** The active enrollment, else the most recent one, else null. */
  enrollment: ChallengeEnrollmentRow | null
  progress: ChallengeDayProgressRow[]
}

/** One row per active enrollment, from sync_challenge_progress. */
export interface ChallengeSyncState {
  enrollment_id: string
  day_number: number
  completion_type: ChallengeCompletionType
  progress: number
  target: number
  met: boolean
  /** First calendar day the current challenge day can be completed on. */
  available_from: string
  completed_now: boolean
  challenge_completed: boolean
}

export interface ChallengeDayCompletionResult {
  completed_day: number
  completed_days: number
  total_days: number
  completion_date: string
  challenge_completed: boolean
  total_xp: number
  coins: number
}

export interface PublicChallenge {
  id: string
  slug: string
  title: string
  tagline: string | null
  description: string | null
  duration_days: number
  schedule_mode: 'sequential' | 'strict'
  xp_reward: number
  coin_reward: number
  cover_image_url: string | null
  days: { day_number: number; title: string; automatic: boolean; image_url: string | null }[]
}

interface RpcResult<T> {
  data: T | null
  error: unknown
}

interface ChallengeRpcClient {
  rpc(fn: 'sync_challenge_progress'): PromiseLike<RpcResult<ChallengeSyncState[]>>
  rpc(fn: 'get_public_challenge', args: { p_slug: string }): PromiseLike<RpcResult<PublicChallenge | null>>
  rpc(
    fn: 'start_challenge_program' | 'restart_challenge_program',
    args: { p_template_id: string }
  ): PromiseLike<RpcResult<{ enrollment_id: string; start_date: string; status: string }[]>>
  rpc(
    fn: 'create_personal_challenge',
    args: { p_title: string; p_task: string; p_days: number; p_description: string | null; p_schedule_mode: 'sequential' | 'strict' }
  ): PromiseLike<RpcResult<{ template_id: string; enrollment_id: string }[]>>
  rpc(fn: 'delete_personal_challenge', args: { p_template_id: string }): PromiseLike<RpcResult<null>>
  rpc(fn: 'abandon_challenge_program', args: { p_enrollment_id: string }): PromiseLike<RpcResult<null>>
  rpc(
    fn: 'complete_challenge_program_day',
    args: { p_enrollment_id: string; p_note?: string | null }
  ): PromiseLike<RpcResult<ChallengeDayCompletionResult[]>>
}

function rpcClient(supabase: SupabaseClient): ChallengeRpcClient {
  return supabase as unknown as ChallengeRpcClient
}

function firstRow<T>(data: T[] | T | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

/**
 * Completes every automatic day whose rule is now met and reports where each
 * active challenge stands. Call it before reading programs so the read sees
 * what the sync just completed.
 *
 * Never throws: a challenge surface must still render when the sync is
 * unavailable, it just shows the last stored state.
 */
export async function syncChallengeProgress(supabase: SupabaseClient): Promise<ChallengeSyncState[]> {
  try {
    const { data, error } = await rpcClient(supabase).rpc('sync_challenge_progress')
    if (error) {
      console.error('sync_challenge_progress failed', error)
      return []
    }
    return data ?? []
  } catch (error) {
    console.error('sync_challenge_progress failed', error)
    return []
  }
}

/**
 * Programs the user can see: every published one plus any they have been
 * enrolled in (so an unpublished challenge does not vanish mid-way).
 */
export async function fetchChallengePrograms(
  supabase: SupabaseClient,
  userId: string,
  options: { templateId?: string } = {}
): Promise<ChallengeProgram[]> {
  let templatesQuery = supabase.from('challenge_templates').select('*').order('created_at', { ascending: false })
  let daysQuery = supabase.from('challenge_days').select('*').order('day_number')
  let enrollmentsQuery = supabase
    .from('challenge_enrollments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (options.templateId) {
    templatesQuery = templatesQuery.eq('id', options.templateId)
    daysQuery = daysQuery.eq('template_id', options.templateId)
    enrollmentsQuery = enrollmentsQuery.eq('template_id', options.templateId)
  }

  const [templatesRes, daysRes, enrollmentsRes, progressRes] = await Promise.all([
    templatesQuery,
    daysQuery,
    enrollmentsQuery,
    supabase.from('challenge_day_progress').select('*').eq('user_id', userId).order('day_number'),
  ])

  const templates = (templatesRes.data as ChallengeTemplateRow[] | null) ?? []
  const days = (daysRes.data as ChallengeDayRow[] | null) ?? []
  const enrollments = (enrollmentsRes.data as ChallengeEnrollmentRow[] | null) ?? []
  const progress = (progressRes.data as ChallengeDayProgressRow[] | null) ?? []

  return buildChallengePrograms(templates, days, enrollments, progress)
}

export function buildChallengePrograms(
  templates: ChallengeTemplateRow[],
  days: ChallengeDayRow[],
  enrollments: ChallengeEnrollmentRow[],
  progress: ChallengeDayProgressRow[]
): ChallengeProgram[] {
  return templates
    .filter((template) => template.is_published || enrollments.some((item) => item.template_id === template.id))
    .map((template) => {
      const enrollment =
        enrollments.find((item) => item.template_id === template.id && item.status === 'active') ??
        enrollments.find((item) => item.template_id === template.id) ??
        null
      return {
        template,
        days: days.filter((day) => day.template_id === template.id).sort((a, b) => a.day_number - b.day_number),
        enrollment,
        progress: enrollment ? progress.filter((item) => item.enrollment_id === enrollment.id) : [],
      }
    })
}

/** Sync first, then read, so the page shows what the sync just completed. */
export async function loadChallengesForUser(
  supabase: SupabaseClient,
  userId: string,
  options: { templateId?: string } = {}
) {
  const sync = await syncChallengeProgress(supabase)
  const programs = await fetchChallengePrograms(supabase, userId, options)
  return { programs, sync }
}

export async function fetchPublicChallenge(
  supabase: SupabaseClient,
  slug: string
): Promise<PublicChallenge | null> {
  const { data, error } = await rpcClient(supabase).rpc('get_public_challenge', { p_slug: slug })
  if (error) {
    console.error('get_public_challenge failed', error)
    return null
  }
  return data ?? null
}

export async function startChallengeProgram(supabase: SupabaseClient, templateId: string) {
  const { data, error } = await rpcClient(supabase).rpc('start_challenge_program', { p_template_id: templateId })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not start this challenge.'))
  const result = firstRow(data)
  if (!result?.enrollment_id) throw new Error('Challenge started, but the enrollment state was invalid.')
  return result
}

export async function restartChallengeProgram(supabase: SupabaseClient, templateId: string) {
  const { data, error } = await rpcClient(supabase).rpc('restart_challenge_program', { p_template_id: templateId })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not restart this challenge.'))
  const result = firstRow(data)
  if (!result?.enrollment_id) throw new Error('Challenge restarted, but the enrollment state was invalid.')
  return result
}

export async function completeChallengeProgramDay(
  supabase: SupabaseClient,
  enrollmentId: string,
  note?: string
): Promise<ChallengeDayCompletionResult> {
  const { data, error } = await rpcClient(supabase).rpc('complete_challenge_program_day', {
    p_enrollment_id: enrollmentId,
    p_note: note?.trim() || null,
  })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not complete today’s challenge.'))
  const result = firstRow(data)
  if (!result?.completed_day) throw new Error('Challenge day completed, but the progress state was invalid.')
  return result
}

/** Creates the challenge and starts it today. Returns the new template id. */
export async function createPersonalChallenge(supabase: SupabaseClient, input: PersonalChallengeInput): Promise<string> {
  const { data, error } = await rpcClient(supabase).rpc('create_personal_challenge', {
    p_title: input.title.trim(),
    p_task: input.task.trim(),
    p_days: input.days,
    p_description: input.description.trim() || null,
    p_schedule_mode: input.scheduleMode,
  })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not create this challenge.'))
  const result = firstRow(data)
  if (!result?.template_id) throw new Error('Challenge created, but the result was invalid.')
  return result.template_id
}

export async function deletePersonalChallenge(supabase: SupabaseClient, templateId: string): Promise<void> {
  const { error } = await rpcClient(supabase).rpc('delete_personal_challenge', { p_template_id: templateId })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not delete this challenge.'))
}

/** Stops a running challenge. Progress and earned XP stay; it can be started again. */
export async function abandonChallengeProgram(supabase: SupabaseClient, enrollmentId: string): Promise<void> {
  const { error } = await rpcClient(supabase).rpc('abandon_challenge_program', { p_enrollment_id: enrollmentId })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not stop this challenge.'))
}

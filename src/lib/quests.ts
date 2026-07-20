import type { SupabaseClient } from '@supabase/supabase-js'
import { getLevel } from '@/lib/gamification'
import type { ChallengeDayProgressRow, ChallengeDayRow, ChallengeEnrollmentRow, ChallengeTemplateRow } from '@/lib/supabase/database.types'

interface SupabaseResult<T> {
  data: T | null
  error: unknown
}

interface QueryBuilder<T> extends PromiseLike<SupabaseResult<T>> {
  select(columns?: string): QueryBuilder<T>
  insert(values: Record<string, unknown>): QueryBuilder<T>
  eq(column: string, value: unknown): QueryBuilder<T>
  order(column: string, options?: Record<string, unknown>): QueryBuilder<T>
  single(): QueryBuilder<T>
}

interface QuestSupabaseClient {
  rpc(
    fn: 'claim_system_quest_reward',
    args: { p_quest_key: string }
  ): PromiseLike<SupabaseResult<{ total_xp: number; coins: number }[]>>
  rpc(
    fn: 'complete_custom_quest_reward',
    args: { p_quest_id: string }
  ): PromiseLike<SupabaseResult<{ total_xp: number; coins: number }[]>>
  rpc(
    fn: 'check_in_daily_challenge_quest',
    args: { p_quest_id: string; p_note?: string | null }
  ): PromiseLike<SupabaseResult<ChallengeCheckInResult[]>>
  rpc(
    fn: 'start_challenge_program',
    args: { p_template_id: string }
  ): PromiseLike<SupabaseResult<{ enrollment_id: string; start_date: string; status: string }[]>>
  rpc(
    fn: 'restart_challenge_program',
    args: { p_template_id: string }
  ): PromiseLike<SupabaseResult<{ enrollment_id: string; start_date: string; status: string }[]>>
  rpc(
    fn: 'complete_challenge_program_day',
    args: { p_enrollment_id: string; p_note?: string | null }
  ): PromiseLike<SupabaseResult<ChallengeDayCompletionResult[]>>
  from(table: string): QueryBuilder<unknown>
}

function questClient(supabase: SupabaseClient): QuestSupabaseClient {
  return supabase as unknown as QuestSupabaseClient
}

export interface QuestStats {
  totalEntries: number
  bestStreak: number
  totalBuildings: number
  level: number
}

export type QuestDifficulty = 'easy' | 'medium' | 'hard'

export interface DefaultQuest {
  key: string
  title: string
  description: string
  xp: number
  coins: number
  difficulty: QuestDifficulty
  progressLabel: string
  progressTarget: number
  getProgress: (stats: QuestStats) => number
}

export type QuestStatus = 'claimable' | 'locked' | 'claimed'

// Serializable: no function fields, safe to pass to Client Components.
export interface DefaultQuestWithStatus {
  key: string
  title: string
  description: string
  xp: number
  coins: number
  difficulty: QuestDifficulty
  progressLabel: string
  progressCurrent: number
  progressTarget: number
  status: QuestStatus
  completedAt?: string
}

export interface CustomQuest {
  id: string
  user_id: string
  title: string
  description: string | null
  xp_reward: number
  coin_reward: number
  quest_type: 'single' | 'daily_challenge'
  challenge_days: number | null
  challenge_task: string | null
  challenge_start_date: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  daily_logs?: QuestDailyLog[]
}

export interface QuestDailyLog {
  id: string
  quest_id: string
  user_id: string
  log_date: string
  note: string | null
  created_at: string
}

export interface ChallengeCheckInResult {
  log_date: string
  completed_days: number
  required_days: number
  ready_to_complete: boolean
}

export interface ChallengeProgram {
  template: ChallengeTemplateRow
  days: ChallengeDayRow[]
  enrollment: ChallengeEnrollmentRow | null
  progress: ChallengeDayProgressRow[]
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

interface QuestProfileStatsRow {
  total_xp: number | null
  best_streak: number | null
}

interface QuestCompletionRow {
  quest_key: string
  completed_at: string
}

export const DEFAULT_QUESTS: DefaultQuest[] = [
  {
    key: 'first_entry',
    title: 'First Steps',
    description: 'Complete your first journal entry',
    xp: 50,
    coins: 20,
    difficulty: 'easy',
    progressLabel: 'Journal entries',
    progressTarget: 1,
    getProgress: (s) => s.totalEntries,
  },
  {
    key: 'streak_3',
    title: 'On a Roll',
    description: 'Reach a 3-day journaling streak',
    xp: 75,
    coins: 30,
    difficulty: 'easy',
    progressLabel: 'Best streak',
    progressTarget: 3,
    getProgress: (s) => s.bestStreak,
  },
  {
    key: 'first_building',
    title: 'City Founder',
    description: 'Place your first building in the city',
    xp: 100,
    coins: 50,
    difficulty: 'easy',
    progressLabel: 'Buildings placed',
    progressTarget: 1,
    getProgress: (s) => s.totalBuildings,
  },
  {
    key: 'entries_10',
    title: 'Dedicated Writer',
    description: 'Write 10 journal entries',
    xp: 200,
    coins: 100,
    difficulty: 'medium',
    progressLabel: 'Journal entries',
    progressTarget: 10,
    getProgress: (s) => s.totalEntries,
  },
  {
    key: 'streak_7',
    title: 'Week Warrior',
    description: 'Maintain a 7-day journaling streak',
    xp: 150,
    coins: 75,
    difficulty: 'medium',
    progressLabel: 'Best streak',
    progressTarget: 7,
    getProgress: (s) => s.bestStreak,
  },
  {
    key: 'buildings_5',
    title: 'Urban Planner',
    description: 'Place 5 buildings in your city',
    xp: 200,
    coins: 100,
    difficulty: 'medium',
    progressLabel: 'Buildings placed',
    progressTarget: 5,
    getProgress: (s) => s.totalBuildings,
  },
  {
    key: 'level_5',
    title: 'Rising Star',
    description: 'Reach Level 5',
    xp: 300,
    coins: 150,
    difficulty: 'hard',
    progressLabel: 'Current level',
    progressTarget: 5,
    getProgress: (s) => s.level,
  },
  {
    key: 'entries_50',
    title: 'Prolific Writer',
    description: 'Write 50 journal entries',
    xp: 500,
    coins: 250,
    difficulty: 'hard',
    progressLabel: 'Journal entries',
    progressTarget: 50,
    getProgress: (s) => s.totalEntries,
  },
  {
    key: 'streak_30',
    title: 'Iron Will',
    description: 'Maintain a 30-day journaling streak',
    xp: 500,
    coins: 250,
    difficulty: 'hard',
    progressLabel: 'Best streak',
    progressTarget: 30,
    getProgress: (s) => s.bestStreak,
  },
]

export function annotateDefaultQuests(
  stats: QuestStats,
  claimedKeys: string[],
  completionTimes: Record<string, string>
): DefaultQuestWithStatus[] {
  return DEFAULT_QUESTS.map(({ getProgress, ...q }) => {
    const progressCurrent = Math.max(0, getProgress(stats))

    if (claimedKeys.includes(q.key)) {
      return {
        ...q,
        progressCurrent,
        status: 'claimed' as const,
        completedAt: completionTimes[q.key],
      }
    }

    return {
      ...q,
      progressCurrent,
      status: progressCurrent >= q.progressTarget ? ('claimable' as const) : ('locked' as const),
    }
  })
}

function getQuestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)

    if (parts.length > 0) return parts.join(' ')
    if (typeof value.code === 'string') return `${fallback} (${value.code})`
  }

  return fallback
}

export async function claimSystemQuest(
  supabase: SupabaseClient,
  quest: DefaultQuestWithStatus,
  callbacks: { setCoins: (c: number) => void; addXp: (x: number, previousTotalXp?: number) => void }
) {
  const client = questClient(supabase)
  const { data, error } = await client
    .rpc('claim_system_quest_reward', { p_quest_key: quest.key })

  if (error) {
    throw new Error(getQuestErrorMessage(error, 'Could not claim this quest reward.'))
  }

  const rewardState = Array.isArray(data) ? data[0] : data

  if (!rewardState || typeof rewardState.coins !== 'number') {
    throw new Error('Quest reward was claimed, but the reward state was invalid.')
  }

  callbacks.addXp(quest.xp, rewardState.total_xp - quest.xp)
  callbacks.setCoins(rewardState.coins)
}

export async function completeCustomQuest(
  supabase: SupabaseClient,
  quest: CustomQuest,
  callbacks: { setCoins: (c: number) => void; addXp: (x: number, previousTotalXp?: number) => void }
) {
  const client = questClient(supabase)
  const { data, error } = await client
    .rpc('complete_custom_quest_reward', { p_quest_id: quest.id })

  if (error) {
    throw new Error(getQuestErrorMessage(error, 'Could not complete this quest.'))
  }

  const rewardState = Array.isArray(data) ? data[0] : data

  if (!rewardState || typeof rewardState.coins !== 'number') {
    throw new Error('Quest was completed, but the reward state was invalid.')
  }

  callbacks.addXp(quest.xp_reward, rewardState.total_xp - quest.xp_reward)
  callbacks.setCoins(rewardState.coins)
}

export async function checkInDailyChallengeQuest(
  supabase: SupabaseClient,
  questId: string,
  note?: string
): Promise<ChallengeCheckInResult> {
  const client = questClient(supabase)
  const { data, error } = await client.rpc('check_in_daily_challenge_quest', {
    p_quest_id: questId,
    p_note: note?.trim() || null,
  })

  if (error) {
    throw new Error(getQuestErrorMessage(error, 'Could not check in for this challenge.'))
  }

  const result = Array.isArray(data) ? data[0] : data

  if (!result?.log_date) {
    throw new Error('Challenge check-in completed, but the progress state was invalid.')
  }

  return result
}

export async function startChallengeProgram(
  supabase: SupabaseClient,
  templateId: string,
  userId: string
): Promise<ChallengeEnrollmentRow> {
  const { data, error } = await questClient(supabase).rpc('start_challenge_program', { p_template_id: templateId })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not start this challenge.'))
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.enrollment_id) throw new Error('Challenge started, but the enrollment state was invalid.')
  const now = new Date().toISOString()
  return { id: result.enrollment_id, template_id: templateId, user_id: userId, start_date: result.start_date, status: result.status as ChallengeEnrollmentRow['status'], completed_at: null, created_at: now, updated_at: now }
}

export async function restartChallengeProgram(
  supabase: SupabaseClient,
  templateId: string,
  userId: string
): Promise<ChallengeEnrollmentRow> {
  const { data, error } = await questClient(supabase).rpc('restart_challenge_program', { p_template_id: templateId })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not restart this challenge.'))
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.enrollment_id) throw new Error('Challenge restarted, but the enrollment state was invalid.')
  const now = new Date().toISOString()
  return { id: result.enrollment_id, template_id: templateId, user_id: userId, start_date: result.start_date, status: result.status as ChallengeEnrollmentRow['status'], completed_at: null, created_at: now, updated_at: now }
}

export async function completeChallengeProgramDay(
  supabase: SupabaseClient,
  enrollmentId: string,
  note?: string
): Promise<ChallengeDayCompletionResult> {
  const { data, error } = await questClient(supabase).rpc('complete_challenge_program_day', {
    p_enrollment_id: enrollmentId,
    p_note: note?.trim() || null,
  })
  if (error) throw new Error(getQuestErrorMessage(error, 'Could not complete today’s challenge.'))
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.completed_day) throw new Error('Challenge day completed, but the progress state was invalid.')
  return result
}

export async function createCustomQuest(
  supabase: SupabaseClient,
  userId: string,
  data: {
    title: string
    description: string
    xp_reward: number
    coin_reward: number
    quest_type?: 'single' | 'daily_challenge'
    challenge_days?: number | null
    challenge_task?: string | null
    challenge_start_date?: string | null
  }
): Promise<CustomQuest> {
  const client = questClient(supabase)
  const { data: quest, error } = await client.from('quests').insert({
    user_id: userId,
    ...data,
  }).select().single()

  if (error) throw new Error(getQuestErrorMessage(error, 'Could not create this quest.'))
  return quest as CustomQuest
}

export async function fetchQuestPageData(supabase: SupabaseClient, userId: string) {
  const client = questClient(supabase)
  const [profileRes, entriesRes, buildingsRes, completionsRes, customQuestsRes, dailyLogsRes, templatesRes, challengeDaysRes, enrollmentsRes, challengeProgressRes] =
    await Promise.all([
      client.from('profiles').select('total_xp, best_streak').eq('id', userId).single(),
      client.from('journal_entries').select('id').eq('user_id', userId).eq('is_complete', true),
      client.from('city_buildings_placing').select('id').eq('user_id', userId),
      client.from('quest_completions').select('quest_key, completed_at').eq('user_id', userId),
      client.from('quests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('quest_daily_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }),
      client.from('challenge_templates').select('*').order('created_at', { ascending: false }),
      client.from('challenge_days').select('*').order('day_number'),
      client.from('challenge_enrollments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('challenge_day_progress').select('*').eq('user_id', userId).order('day_number'),
    ])

  const profile = (profileRes.data as QuestProfileStatsRow | null) ?? { total_xp: 0, best_streak: 0 }
  const stats: QuestStats = {
    totalEntries: ((entriesRes.data as unknown[] | null) ?? []).length,
    bestStreak: profile.best_streak ?? 0,
    totalBuildings: ((buildingsRes.data as unknown[] | null) ?? []).length,
    level: getLevel(profile.total_xp ?? 0),
  }

  const completions = ((completionsRes.data as QuestCompletionRow[] | null) ?? [])
  const claimedKeys = completions.map((c) => c.quest_key)
  const completionTimes: Record<string, string> = Object.fromEntries(
    completions.map((c) => [c.quest_key, c.completed_at])
  )

  const annotated = annotateDefaultQuests(stats, claimedKeys, completionTimes)
  const dailyLogs = ((dailyLogsRes.data as QuestDailyLog[] | null) ?? [])
  const customQuests = ((customQuestsRes.data as CustomQuest[] | null) ?? []).map((quest) => ({
    ...quest,
    quest_type: quest.quest_type ?? 'single',
    challenge_days: quest.challenge_days ?? null,
    challenge_task: quest.challenge_task ?? null,
    challenge_start_date: quest.challenge_start_date ?? null,
    daily_logs: dailyLogs.filter((log) => log.quest_id === quest.id),
  }))

  const challengeDays = (challengeDaysRes.data as ChallengeDayRow[] | null) ?? []
  const enrollments = (enrollmentsRes.data as ChallengeEnrollmentRow[] | null) ?? []
  const challengeProgress = (challengeProgressRes.data as ChallengeDayProgressRow[] | null) ?? []
  const visibleTemplates = ((templatesRes.data as ChallengeTemplateRow[] | null) ?? []).filter(
    (template) => template.is_published || enrollments.some((item) => item.template_id === template.id)
  )
  const challengePrograms: ChallengeProgram[] = visibleTemplates.map((template) => {
    const enrollment = enrollments.find((item) => item.template_id === template.id && item.status === 'active')
      ?? enrollments.find((item) => item.template_id === template.id)
      ?? null
    return {
      template,
      days: challengeDays.filter((day) => day.template_id === template.id),
      enrollment,
      progress: enrollment ? challengeProgress.filter((item) => item.enrollment_id === enrollment.id) : [],
    }
  })

  return { stats, annotated, customQuests, challengePrograms }
}

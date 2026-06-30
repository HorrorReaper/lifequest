import type { SupabaseClient } from '@supabase/supabase-js'
import { getLevel } from '@/lib/gamification'

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
  check: (stats: QuestStats) => boolean
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
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
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
    check: (s) => s.totalEntries >= 1,
  },
  {
    key: 'streak_3',
    title: 'On a Roll',
    description: 'Reach a 3-day journaling streak',
    xp: 75,
    coins: 30,
    difficulty: 'easy',
    check: (s) => s.bestStreak >= 3,
  },
  {
    key: 'first_building',
    title: 'City Founder',
    description: 'Place your first building in the city',
    xp: 100,
    coins: 50,
    difficulty: 'easy',
    check: (s) => s.totalBuildings >= 1,
  },
  {
    key: 'entries_10',
    title: 'Dedicated Writer',
    description: 'Write 10 journal entries',
    xp: 200,
    coins: 100,
    difficulty: 'medium',
    check: (s) => s.totalEntries >= 10,
  },
  {
    key: 'streak_7',
    title: 'Week Warrior',
    description: 'Maintain a 7-day journaling streak',
    xp: 150,
    coins: 75,
    difficulty: 'medium',
    check: (s) => s.bestStreak >= 7,
  },
  {
    key: 'buildings_5',
    title: 'Urban Planner',
    description: 'Place 5 buildings in your city',
    xp: 200,
    coins: 100,
    difficulty: 'medium',
    check: (s) => s.totalBuildings >= 5,
  },
  {
    key: 'level_5',
    title: 'Rising Star',
    description: 'Reach Level 5',
    xp: 300,
    coins: 150,
    difficulty: 'hard',
    check: (s) => s.level >= 5,
  },
  {
    key: 'entries_50',
    title: 'Prolific Writer',
    description: 'Write 50 journal entries',
    xp: 500,
    coins: 250,
    difficulty: 'hard',
    check: (s) => s.totalEntries >= 50,
  },
  {
    key: 'streak_30',
    title: 'Iron Will',
    description: 'Maintain a 30-day journaling streak',
    xp: 500,
    coins: 250,
    difficulty: 'hard',
    check: (s) => s.bestStreak >= 30,
  },
]

export function annotateDefaultQuests(
  stats: QuestStats,
  claimedKeys: string[],
  completionTimes: Record<string, string>
): DefaultQuestWithStatus[] {
  return DEFAULT_QUESTS.map(({ check, ...q }) => {
    if (claimedKeys.includes(q.key)) {
      return { ...q, status: 'claimed' as const, completedAt: completionTimes[q.key] }
    }
    return { ...q, status: check(stats) ? ('claimable' as const) : ('locked' as const) }
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
  callbacks: { setCoins: (c: number) => void; addXp: (x: number) => void }
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

  callbacks.addXp(quest.xp)
  callbacks.setCoins(rewardState.coins)
}

export async function completeCustomQuest(
  supabase: SupabaseClient,
  quest: CustomQuest,
  callbacks: { setCoins: (c: number) => void; addXp: (x: number) => void }
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

  callbacks.addXp(quest.xp_reward)
  callbacks.setCoins(rewardState.coins)
}

export async function createCustomQuest(
  supabase: SupabaseClient,
  userId: string,
  data: { title: string; description: string; xp_reward: number; coin_reward: number }
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
  const [profileRes, entriesRes, buildingsRes, completionsRes, customQuestsRes] =
    await Promise.all([
      client.from('profiles').select('total_xp, best_streak').eq('id', userId).single(),
      client.from('journal_entries').select('id').eq('user_id', userId).eq('is_complete', true),
      client.from('city_buildings_placing').select('id').eq('user_id', userId),
      client.from('quest_completions').select('quest_key, completed_at').eq('user_id', userId),
      client.from('quests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
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
  const customQuests = ((customQuestsRes.data as CustomQuest[] | null) ?? [])

  return { stats, annotated, customQuests }
}

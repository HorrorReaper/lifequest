import type { SupabaseClient } from '@supabase/supabase-js'
import type { InsightType } from './types'
import { INSIGHT_TYPES, insightAnswerText, isInsightType } from './insights'

/** How many cards one insight rail carries before "see all" takes over. */
export const INSIGHT_RAIL_LIMIT = 12

export interface JournalInsightItem {
  id: string
  source: 'response' | 'legacy'
  sourceId: string
  entryId: string
  fieldId: string | null
  type: InsightType
  title: string | null
  answer: string
  prompt: string | null
  tags: string[]
  actionText: string | null
  isFavorite: boolean
  markedAt: string
  entryDate: string
  template: {
    id: string | null
    name: string | null
    icon: string | null
  } | null
}

export interface InsightRail {
  type: InsightType
  /** Plural label for the rail heading, e.g. "Learnings". */
  label: string
  /** Capped at INSIGHT_RAIL_LIMIT; `total` is the honest count. */
  insights: JournalInsightItem[]
  total: number
}

type MaybeArray<T> = T | T[] | null

interface JournalEntryJoin {
  entry_date: string
  journal_templates: MaybeArray<{
    id: string | null
    name: string | null
    icon: string | null
  }>
}

export interface ResponseInsightRow {
  id: string
  entry_id: string
  field_id: string
  value_text: string | null
  value_json: unknown
  insight_type: string | null
  topic_tags: string[] | null
  insight_marked_at: string | null
  insight_is_favorite: boolean
  created_at: string
  template_fields: MaybeArray<{ label: string | null }>
  journal_entries: MaybeArray<JournalEntryJoin>
}

export interface LegacyLearningRow {
  id: string
  entry_id: string
  field_id: string | null
  title: string
  note: string
  tags: string[]
  action_text: string | null
  is_favorite: boolean
  created_at: string
  updated_at: string
  journal_entries: MaybeArray<JournalEntryJoin>
}

function one<T>(value: MaybeArray<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Folds both places an insight can live into one list, newest first.
 *
 * `journal_learnings` predates marking a response as an insight. A learning
 * that has since been re-saved as a response exists in both tables, so the
 * response wins and the legacy row is dropped rather than shown twice.
 */
export function mapInsightRows(
  responseRows: ResponseInsightRow[],
  legacyRows: LegacyLearningRow[]
): JournalInsightItem[] {
  const responseKeys = new Set(
    responseRows.map((response) => `${response.entry_id}:${response.field_id}`)
  )

  const responseInsights: JournalInsightItem[] = responseRows.flatMap((response) => {
    if (!isInsightType(response.insight_type)) return []
    const entry = one(response.journal_entries)
    if (!entry) return []
    const answer = insightAnswerText(response.value_text, response.value_json)
    if (!answer) return []
    const valueJson =
      response.value_json && typeof response.value_json === 'object' && !Array.isArray(response.value_json)
        ? response.value_json as { title?: unknown; action_text?: unknown }
        : null

    return [{
      id: `response:${response.id}`,
      source: 'response',
      sourceId: response.id,
      entryId: response.entry_id,
      fieldId: response.field_id,
      type: response.insight_type,
      title: typeof valueJson?.title === 'string' ? valueJson.title : null,
      answer,
      prompt: one(response.template_fields)?.label ?? null,
      tags: response.topic_tags ?? [],
      actionText: typeof valueJson?.action_text === 'string' ? valueJson.action_text : null,
      isFavorite: response.insight_is_favorite,
      markedAt: response.insight_marked_at ?? response.created_at,
      entryDate: entry.entry_date,
      template: one(entry.journal_templates),
    }]
  })

  const legacyInsights: JournalInsightItem[] = legacyRows
    .filter((learning) => !responseKeys.has(`${learning.entry_id}:${learning.field_id}`))
    .flatMap((learning) => {
      const entry = one(learning.journal_entries)
      if (!entry) return []

      return [{
        id: `legacy:${learning.id}`,
        source: 'legacy',
        sourceId: learning.id,
        entryId: learning.entry_id,
        fieldId: learning.field_id,
        type: 'learning',
        title: learning.title,
        answer: learning.note,
        prompt: null,
        tags: learning.tags,
        actionText: learning.action_text,
        isFavorite: learning.is_favorite,
        markedAt: learning.updated_at ?? learning.created_at,
        entryDate: entry.entry_date,
        template: one(entry.journal_templates),
      }]
    })

  return [...responseInsights, ...legacyInsights].sort(
    (a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime()
  )
}

/** Every insight this user has marked while journaling, newest first. */
export async function fetchJournalInsights(
  supabase: SupabaseClient,
  userId: string
): Promise<JournalInsightItem[]> {
  const [{ data: responseData, error: responseError }, { data: legacyData, error: legacyError }] =
    await Promise.all([
      supabase
        .from('journal_responses')
        .select(`
          id,
          entry_id,
          field_id,
          value_text,
          value_json,
          insight_type,
          topic_tags,
          insight_marked_at,
          insight_is_favorite,
          created_at,
          template_fields(label),
          journal_entries!inner(
            entry_date,
            journal_templates(id, name, icon)
          )
        `)
        .eq('journal_entries.user_id', userId)
        .not('insight_type', 'is', null)
        .order('insight_marked_at', { ascending: false }),
      supabase
        .from('journal_learnings')
        .select('*, journal_entries(entry_date, journal_templates(id, name, icon))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

  if (responseError) console.error('Failed to fetch journal insights', responseError)
  if (legacyError) console.error('Failed to fetch legacy journal learnings', legacyError)

  return mapInsightRows(
    (responseData ?? []) as unknown as ResponseInsightRow[],
    (legacyData ?? []) as unknown as LegacyLearningRow[]
  )
}

const PLURAL_LABELS: Record<InsightType, string> = {
  learning: 'Learnings',
  problem: 'Problems',
  idea: 'Ideas',
  decision: 'Decisions',
  win: 'Wins',
}

/**
 * Splits insights into one rail per type, the fullest rail first.
 *
 * Favorites lead each rail, then the newest: a rail is a reminder of what is
 * worth rereading, not a complete archive -- that is what the insights page is.
 */
export function groupInsightsByType(insights: JournalInsightItem[]): InsightRail[] {
  const byType = new Map<InsightType, JournalInsightItem[]>()
  for (const item of insights) {
    const bucket = byType.get(item.type)
    if (bucket) bucket.push(item)
    else byType.set(item.type, [item])
  }

  const definitionOrder = INSIGHT_TYPES.map((type) => type.value)

  return [...byType.entries()]
    .map(([type, items]) => ({
      type,
      label: PLURAL_LABELS[type],
      total: items.length,
      insights: [...items]
        .sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
          return new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime()
        })
        .slice(0, INSIGHT_RAIL_LIMIT),
    }))
    .sort(
      (a, b) =>
        b.total - a.total || definitionOrder.indexOf(a.type) - definitionOrder.indexOf(b.type)
    )
}

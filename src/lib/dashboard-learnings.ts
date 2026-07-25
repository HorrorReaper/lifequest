import type { SupabaseClient } from '@supabase/supabase-js'
import { insightAnswerText } from '@/lib/insights'

type MaybeArray<T> = T | T[] | null

interface DashboardLearningRow {
  id: string
  value_text: string | null
  value_json: unknown
  topic_tags: string[] | null
  insight_marked_at: string | null
  insight_is_favorite: boolean
  template_fields: MaybeArray<{
    label: string | null
  }>
  journal_entries: MaybeArray<{
    id: string
    entry_date: string
    journal_templates: MaybeArray<{
      name: string | null
      icon: string | null
    }>
  }>
}

export interface DashboardLearning {
  id: string
  answer: string
  prompt: string | null
  tags: string[]
  isFavorite: boolean
  markedAt: string | null
  entryId: string
  entryDate: string
  templateName: string | null
  templateIcon: string | null
}

function one<T>(value: MaybeArray<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchDashboardLearnings(
  supabase: SupabaseClient,
  userId: string
): Promise<DashboardLearning[]> {
  const { data, error } = await supabase
    .from('journal_responses')
    .select(`
      id,
      value_text,
      value_json,
      topic_tags,
      insight_marked_at,
      insight_is_favorite,
      template_fields(label),
      journal_entries!inner(
        id,
        entry_date,
        journal_templates(name, icon)
      )
    `)
    .eq('insight_type', 'learning')
    .eq('journal_entries.user_id', userId)
    .order('insight_is_favorite', { ascending: false })
    .order('insight_marked_at', { ascending: true, nullsFirst: false })
    .limit(40)

  if (error) {
    console.error('Failed to fetch dashboard learnings', error)
    return []
  }

  return ((data ?? []) as unknown as DashboardLearningRow[]).flatMap((row) => {
    const entry = one(row.journal_entries)
    const answer = insightAnswerText(row.value_text, row.value_json)

    if (!entry || !answer) return []

    const template = one(entry.journal_templates)

    return [{
      id: row.id,
      answer,
      prompt: one(row.template_fields)?.label ?? null,
      tags: row.topic_tags ?? [],
      isFavorite: row.insight_is_favorite,
      markedAt: row.insight_marked_at,
      entryId: entry.id,
      entryDate: entry.entry_date,
      templateName: template?.name ?? null,
      templateIcon: template?.icon ?? null,
    }]
  })
}

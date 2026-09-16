import type { InsightType } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  Trophy,
  type LucideIcon,
} from 'lucide-react'

export const INSIGHT_TYPES: Array<{
  value: InsightType
  label: string
  description: string
}> = [
  {
    value: 'learning',
    label: 'Learning',
    description: 'Something worth remembering.',
  },
  {
    value: 'problem',
    label: 'Problem',
    description: 'Something unresolved or blocking you.',
  },
  {
    value: 'idea',
    label: 'Idea',
    description: 'Something worth exploring.',
  },
  {
    value: 'decision',
    label: 'Decision',
    description: 'A choice or commitment you made.',
  },
  {
    value: 'win',
    label: 'Win',
    description: 'A win worth remembering, for when you need the reminder.',
  },
]

/** One icon and one colour per insight type, shared by every view. */
export const INSIGHT_TYPE_ICONS: Record<InsightType, LucideIcon> = {
  learning: BookOpenCheck,
  problem: CircleAlert,
  idea: Lightbulb,
  decision: CheckCircle2,
  win: Trophy,
}

export const INSIGHT_TYPE_STYLES: Record<InsightType, string> = {
  learning: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  problem: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  idea: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  decision: 'bg-primary/10 text-primary',
  win: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
}

export function isInsightType(value: unknown): value is InsightType {
  return INSIGHT_TYPES.some((type) => type.value === value)
}

export function normalizeInsightTags(value: string | string[]): string[] {
  const tags = Array.isArray(value) ? value : value.split(',')

  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
    ),
  ].slice(0, 5)
}

export function insightAnswerText(valueText: string | null, valueJson: unknown): string {
  if (valueText?.trim()) return valueText.trim()
  if (!valueJson || typeof valueJson !== 'object' || Array.isArray(valueJson)) return ''

  const candidate = valueJson as {
    title?: unknown
    note?: unknown
    action_text?: unknown
  }
  const parts = [candidate.note, candidate.title, candidate.action_text]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())

  return parts.join(' ')
}

export function insightTypeLabel(type: InsightType) {
  return INSIGHT_TYPES.find((item) => item.value === type)?.label ?? type
}

export async function fetchInsightTagSuggestions(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('journal_responses(topic_tags)')
    .eq('user_id', userId)
    .eq('is_complete', true)
    .order('entry_date', { ascending: false })
    .limit(50)

  if (error) return []

  const entries = (data ?? []) as unknown as Array<{
    journal_responses?: Array<{ topic_tags?: string[] | null }> | null
  }>

  return normalizeInsightTags(
    entries.flatMap((entry) =>
      (entry.journal_responses ?? []).flatMap((response) => response.topic_tags ?? [])
    )
  )
}

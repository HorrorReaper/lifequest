import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BookOpenCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { insightAnswerText, isInsightType } from '@/lib/insights'
import {
  JournalInsights,
  type JournalInsightItem,
} from '@/components/journal/journal-insights'
import { Button } from '@/components/ui/button'

type MaybeArray<T> = T | T[] | null

interface ResponseInsightRow {
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
  template_fields: MaybeArray<{
    label: string | null
  }>
  journal_entries: MaybeArray<{
    entry_date: string
    journal_templates: MaybeArray<{
      id: string
      name: string | null
      icon: string | null
    }>
  }>
}

interface LegacyLearningRow {
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
  journal_entries: MaybeArray<{
    entry_date: string
    journal_templates: MaybeArray<{
      id: string
      name: string | null
      icon: string | null
    }>
  }>
}

function one<T>(value: MaybeArray<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default async function JournalInsightsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: responseData }, { data: legacyData }] = await Promise.all([
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
      .eq('journal_entries.user_id', user.id)
      .not('insight_type', 'is', null)
      .order('insight_marked_at', { ascending: false }),
    supabase
      .from('journal_learnings')
      .select('*, journal_entries(entry_date, journal_templates(id, name, icon))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const responseRows = (responseData ?? []) as unknown as ResponseInsightRow[]
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

  const legacyInsights: JournalInsightItem[] = ((legacyData ?? []) as unknown as LegacyLearningRow[])
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

  const insights = [...responseInsights, ...legacyInsights].sort(
    (a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime()
  )

  return (
    <div className="min-h-svh bg-background px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href="/journal">
              <ArrowLeft className="size-3.5" />
              Journal
            </Link>
          </Button>
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BookOpenCheck className="size-5" />
            </span>
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight">Journal Insights</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Find the learnings, problems, ideas, and decisions you marked while reflecting.
              </p>
            </div>
          </div>
        </header>

        <JournalInsights insights={insights} />
      </div>
    </div>
  )
}

// src/app/journal/[entryId]/page.tsx

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { EntryForm } from '@/components/journal/entry-form'
import { JournalTemplate, TemplateField, FieldValue } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { fetchInsightTagSuggestions, isInsightType } from '@/lib/insights'

interface PageProps {
  params: Promise<{ entryId: string }>
}

export default async function ViewEntryPage({ params }: PageProps) {
  const { entryId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch entry with template
  const { data } = await supabase
    .from('journal_entries')
    .select('*, journal_templates(*)')
    .eq('id', entryId)
    .eq('user_id', user.id)
    .single()

  const entry = data as
    | (Database['public']['Tables']['journal_entries']['Row'] & {
        journal_templates?: Database['public']['Tables']['journal_templates']['Row'] | null
      })
    | null

  if (!entry) redirect('/journal')

  const template = entry.journal_templates as unknown as JournalTemplate

  const [{ data: fields }, { data: responsesData }, suggestedInsightTags] = await Promise.all([
    supabase
      .from('template_fields')
      .select('*')
      .eq('template_id', template.id)
      .order('sort_order'),
    supabase
      .from('journal_responses')
      .select('*')
      .eq('entry_id', entryId),
    fetchInsightTagSuggestions(supabase, user.id),
  ])
  const responses = responsesData as Database['public']['Tables']['journal_responses']['Row'][] | null

  // Map responses to field values
  const existingResponses: Record<string, FieldValue> = {}
  for (const response of responses ?? []) {
    existingResponses[response.field_id] = {
      field_id: response.field_id,
      value_text: response.value_text,
      value_number: response.value_number,
      value_boolean: response.value_boolean,
      value_json: response.value_json,
      insight_type: isInsightType(response.insight_type) ? response.insight_type : null,
      topic_tags: response.topic_tags ?? [],
      insight_marked_at: response.insight_marked_at,
      insight_is_favorite: response.insight_is_favorite,
    }
  }

  const entryDate = new Date(entry.entry_date)

  return (
    <div className="min-h-svh bg-background px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Back + Date Header */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/journal">← Back</Link>
          </Button>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {entryDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            {entry.xp_earned > 0 && (
              <p className="text-xs font-medium text-primary">
                +{entry.xp_earned} XP earned
              </p>
            )}
          </div>
        </div>

        <EntryForm
          template={template}
          fields={(fields as TemplateField[]) ?? []}
          existingEntryId={entry.id}
          existingResponses={existingResponses}
          suggestedInsightTags={suggestedInsightTags}
        />
      </div>
    </div>
  )
}

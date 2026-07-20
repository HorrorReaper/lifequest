// src/app/journal/new/[templateId]/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EntryForm } from '@/components/journal/entry-form'
import { JournalTemplate, TemplateField } from '@/lib/types'
import type { Database } from '@/lib/supabase/database.types'
import { fetchInsightTagSuggestions } from '@/lib/insights'

interface PageProps {
  params: Promise<{ templateId: string }>
}

export default async function NewEntryPage({ params }: PageProps) {
  const { templateId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch template
  const { data } = await supabase
    .from('journal_templates')
    .select('*')
    .eq('id', templateId)
    .single()
  const template = data as Database['public']['Tables']['journal_templates']['Row'] | null

  if (!template) redirect('/journal')

  // Verify access: system template or user's own
  if (!template.is_system && template.user_id !== user.id) {
    redirect('/journal')
  }

  const [{ data: fields }, suggestedInsightTags] = await Promise.all([
    supabase
      .from('template_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order'),
    fetchInsightTagSuggestions(supabase, user.id),
  ])

  return (
    <div className="min-h-svh bg-background px-4 pb-24 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl">
        <EntryForm
          template={template as JournalTemplate}
          fields={(fields as TemplateField[]) ?? []}
          suggestedInsightTags={suggestedInsightTags}
        />
      </div>
    </div>
  )
}

// src/app/journal/new/[templateId]/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EntryForm } from '@/components/journal/entry-form'
import { JournalTemplate, TemplateField } from '@/lib/types'

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
  const { data: template } = await supabase
    .from('journal_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (!template) redirect('/journal')

  // Verify access: system template or user's own
  if (!template.is_system && template.user_id !== user.id) {
    redirect('/journal')
  }

  // Fetch fields
  const { data: fields } = await supabase
    .from('template_fields')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order')

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <EntryForm
          template={template as JournalTemplate}
          fields={(fields as TemplateField[]) ?? []}
        />
      </div>
    </div>
  )
}

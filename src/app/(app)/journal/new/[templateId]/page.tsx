// src/app/journal/new/[templateId]/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EntryForm } from '@/components/journal/entry-form'
import { JournalTemplate, TemplateField } from '@/lib/types'
import type { Database } from '@/lib/supabase/database.types'
import { fetchInsightTagSuggestions } from '@/lib/insights'
import { findReflectionPrompt } from '@/lib/daily-reflection'
import { fetchChallengeContext } from '@/lib/challenge-context'
import { CHALLENGE_REFLECTION_TEMPLATE_ID } from '@/lib/challenge-rules'
import type { SupabaseClient } from '@supabase/supabase-js'

interface PageProps {
  params: Promise<{ templateId: string }>
  searchParams: Promise<{ firstEntry?: string; prompt?: string; challenge?: string }>
}

export default async function NewEntryPage({ params, searchParams }: PageProps) {
  const { templateId } = await params
  const { firstEntry, prompt, challenge: challengeParam } = await searchParams
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

  const [{ data: fields }, suggestedInsightTags, { data: profileData }, challenge] = await Promise.all([
    supabase
      .from('template_fields')
      .select('*')
      .eq('template_id', templateId)
      .order('sort_order'),
    fetchInsightTagSuggestions(supabase, user.id),
    supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle(),
    // Opened from a challenge day: show that day's question on a reflection
    // day and lead back to the challenge once saved.
    fetchChallengeContext(supabase as unknown as SupabaseClient, user.id, challengeParam),
  ])
  const challengePrompt =
    challenge?.day?.completion_type === 'reflection' && templateId === CHALLENGE_REFLECTION_TEMPLATE_ID
      ? challenge.day.reflection_prompt
      : null
  const timezone = (profileData as { timezone?: string | null } | null)?.timezone ?? 'UTC'

  return (
    <div className="min-h-svh bg-background px-4 pb-24 pt-5 max-md:p-0 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl">
        <EntryForm
          userId={user.id}
          template={template as JournalTemplate}
          fields={(fields as TemplateField[]) ?? []}
          suggestedInsightTags={suggestedInsightTags}
          timezone={timezone}
          firstEntry={firstEntry === '1'}
          prompt={challengePrompt ?? findReflectionPrompt(prompt)?.text ?? null}
          returnTo={challenge ? { href: `/challenges/${challenge.templateId}`, label: 'Back to the challenge' } : null}
        />
      </div>
    </div>
  )
}

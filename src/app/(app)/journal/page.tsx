// src/app/journal/page.tsx

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TemplatePicker } from '@/components/journal/template-picker'
import { EntryTimeline } from '@/components/journal/entry-timeline'
import { JournalTemplate, JournalEntry } from '@/lib/types'
import { LayoutTemplate } from 'lucide-react'

export default async function JournalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all available templates (system + user's own)
  const { data: templates } = await supabase
    .from('journal_templates')
    .select('*')
    .or(`user_id.eq.${user.id},is_system.eq.true`)
    .eq('is_active', true)
    .order('sort_order')

  // Fetch recent entries (last 30)
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*, journal_templates(*)')
    .eq('user_id', user.id)
    .eq('is_complete', true)
    .order('entry_date', { ascending: false })
    .limit(30)

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Journal</h1>
            <p className="text-sm text-muted-foreground">
              Choose a template to start today&apos;s entry.
            </p>
          </div>
          <Link
            href="/journal/templates"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
          >
            <LayoutTemplate className="size-3.5" />
            Templates
          </Link>
        </div>

        {/* Template Picker */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            New Entry
          </h2>
          <TemplatePicker templates={(templates as JournalTemplate[]) ?? []} />
        </section>

        {/* Past Entries */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Entries
          </h2>
          <EntryTimeline entries={(entries as JournalEntry[]) ?? []} />
        </section>
      </div>
    </div>
  )
}

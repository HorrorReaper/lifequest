import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  EntryArchive,
  type JournalArchiveEntry,
  type JournalArchiveTemplate,
} from '@/components/journal/entry-archive'

export default async function JournalEntriesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: entries }, { data: templates }] = await Promise.all([
    supabase
      .from('journal_entries')
      .select(
        `
        id,
        entry_date,
        xp_earned,
        journal_templates(id, name, icon),
        journal_responses(
          value_text,
          value_number,
          value_boolean,
          value_json,
          insight_type,
          topic_tags,
          template_fields(label)
        )
      `
      )
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .order('entry_date', { ascending: false }),
    supabase
      .from('journal_templates')
      .select('id, name, icon')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Journal Entries</h1>
            <p className="text-sm text-muted-foreground">
              Search your reflections and filter your full journal history.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/journal">
              <ArrowLeft className="size-3.5" />
              Journal
            </Link>
          </Button>
        </div>

        <EntryArchive
          entries={(entries as unknown as JournalArchiveEntry[]) ?? []}
          templates={(templates as JournalArchiveTemplate[]) ?? []}
        />
      </div>
    </div>
  )
}

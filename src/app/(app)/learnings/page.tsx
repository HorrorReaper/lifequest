import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BookOpenCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LearningLibrary, type LearningLibraryItem } from '@/components/learnings/learning-library'
import { Button } from '@/components/ui/button'

export default async function LearningsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('journal_learnings')
    .select('*, journal_entries(entry_date, journal_templates(name, icon))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const learnings = (data ?? []) as unknown as LearningLibraryItem[]

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
              <Link href="/journal">
                <ArrowLeft className="size-3.5" />
                Journal
              </Link>
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BookOpenCheck className="size-6 text-primary" />
              Learning Library
            </h1>
            <p className="text-sm text-muted-foreground">
              Search the lessons you intentionally saved from everyday journaling.
            </p>
          </div>
        </div>

        <LearningLibrary learnings={learnings} />
      </div>
    </div>
  )
}

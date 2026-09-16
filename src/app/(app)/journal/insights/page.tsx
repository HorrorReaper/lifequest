import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, BookOpenCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchJournalInsights } from '@/lib/journal-insights'
import { JournalInsights } from '@/components/journal/journal-insights'
import { Button } from '@/components/ui/button'

export default async function JournalInsightsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const insights = await fetchJournalInsights(supabase, user.id)

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

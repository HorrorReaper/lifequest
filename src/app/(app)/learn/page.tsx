import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { annotateLessons } from '@/lib/lessons'
import { LearnPageClient } from '@/components/learn/LearnPageClient'
import { BookOpenCheck } from 'lucide-react'

interface LessonCompletion {
  lesson_id: string
  completed_at: string
}

interface LessonCompletionClient {
  from(table: 'lesson_completions'): {
    select(columns: string): {
      eq(column: 'user_id', value: string): Promise<{ data: LessonCompletion[] | null }>
    }
  }
}

export default async function LearnPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lessonClient = supabase as unknown as LessonCompletionClient
  const { data: completionsData } = await lessonClient
    .from('lesson_completions')
    .select('lesson_id, completed_at')
    .eq('user_id', user.id)

  const completions = completionsData ?? []
  const completedIds = completions.map((c) => c.lesson_id)
  const completionTimes: Record<string, string> = Object.fromEntries(
    completions.map((c) => [c.lesson_id, c.completed_at])
  )

  const lessons = annotateLessons(completedIds, completionTimes)

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Learn</h1>
            <p className="text-sm text-muted-foreground">
              Short lessons on journaling and personal growth. Finish the quiz to earn XP &amp; coins.
            </p>
          </div>
          <Link
            href="/journal/insights"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <BookOpenCheck className="size-3.5" />
            Journal Insights
          </Link>
        </div>
        <LearnPageClient lessons={lessons} />
      </div>
    </div>
  )
}

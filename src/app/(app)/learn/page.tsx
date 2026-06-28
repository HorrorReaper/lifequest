import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { annotateLessons } from '@/lib/lessons'
import { LearnPageClient } from '@/components/learn/LearnPageClient'

export default async function LearnPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: completionsData } = await (supabase as any)
    .from('lesson_completions')
    .select('lesson_id, completed_at')
    .eq('user_id', user.id)

  const completions: { lesson_id: string; completed_at: string }[] = completionsData ?? []
  const completedIds = completions.map((c) => c.lesson_id)
  const completionTimes: Record<string, string> = Object.fromEntries(
    completions.map((c) => [c.lesson_id, c.completed_at])
  )

  const lessons = annotateLessons(completedIds, completionTimes)

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Learn</h1>
          <p className="text-sm text-muted-foreground">
            Short lessons on journaling and personal growth. Finish the quiz to earn XP &amp; coins.
          </p>
        </div>
        <LearnPageClient lessons={lessons} />
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { annotateLessons, type LessonWithStatus } from '@/lib/lessons'
import { showAdminUi } from '@/lib/admin'
import { fetchJournalInsights } from '@/lib/journal-insights'
import { LearningPathLibrary } from '@/components/learn/LearningPathLibrary'
import { AcademyLibrary } from '@/components/learn/AcademyLibrary'
import { PageHeader } from '@/components/ui/page-header'

import { BookOpenCheck, Wrench } from 'lucide-react'
import { fetchLearningExperience } from '@/lib/learning-api'
import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
  type LearningPathId,
} from '@/lib/learning-paths'

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

function LearnPageShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-7">
        {/* "Library" everywhere: the tab, the + menu and this title used to
            say Library, Learn and Lifequest Academy for the same page. */}
        <PageHeader
          title={title}
          description="Short lessons and tools, a few minutes each."
          actions={
            <>
              <Link
                href="/learn/tools"
                className="flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <Wrench className="size-4" />
                Toolbox
              </Link>
              <Link
                href="/journal/insights"
                className="flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <BookOpenCheck className="size-4" />
                Journal Insights
              </Link>
            </>
          }
        />
        {children}
      </div>
    </div>
  )
}

/**
 * The interactive paths are still being authored, so only admins see them.
 * Everyone else gets the article library, which is the whole page for them
 * rather than an archive tucked under the paths.
 */
async function AdminAcademy({
  supabase,
  lessons,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  lessons: LessonWithStatus[]
  userId: string
}) {
  let catalog = DEFAULT_LEARNING_CATALOG
  let progress = EMPTY_LEARNING_PROGRESS
  let backendEnabled = false
  let publishedPathIds: LearningPathId[] = []
  try {
    const learning = await fetchLearningExperience(supabase)
    catalog = learning.catalog
    progress = learning.progress
    backendEnabled = true
    publishedPathIds = catalog.paths.map((path) => path.id)
  } catch (error) {
    console.error('Could not load the learning backend; using the authored fallback.', error)
  }

  return (
    <LearningPathLibrary
      catalog={catalog}
      progress={progress}
      backendEnabled={backendEnabled}
      legacyLessons={lessons}
      publishedPathIds={publishedPathIds}
      userId={userId}
    />
  )
}

export default async function LearnPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const showCourses = await showAdminUi(user)

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

  if (!showCourses) {
    // Only this half renders insights, so the admin page never pays for them.
    const insights = await fetchJournalInsights(supabase, user.id)

    return (
      <LearnPageShell title="Library">
        <AcademyLibrary lessons={lessons} insights={insights} />
      </LearnPageShell>
    )
  }

  return <AdminAcademy supabase={supabase} lessons={lessons} userId={user.id} />
}

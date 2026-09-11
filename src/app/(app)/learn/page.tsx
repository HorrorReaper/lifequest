import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { annotateLessons, type LessonWithStatus } from '@/lib/lessons'
import { showAdminUi } from '@/lib/admin'
import { LearningPathLibrary } from '@/components/learn/LearningPathLibrary'
import { LearnPageClient } from '@/components/learn/LearnPageClient'
import { BookOpenCheck, Wrench } from 'lucide-react'
import { fetchLearningExperience } from '@/lib/learning-api'
import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
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
  intro,
  children,
}: {
  title: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">LifeQuest Academy</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em]">{title}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{intro}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/learn/tools"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Wrench className="size-3.5" />
              Toolbox
            </Link>
            <Link
              href="/journal/insights"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <BookOpenCheck className="size-3.5" />
              Journal Insights
            </Link>
          </div>
        </div>
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
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  lessons: LessonWithStatus[]
}) {
  let catalog = DEFAULT_LEARNING_CATALOG
  let progress = EMPTY_LEARNING_PROGRESS
  let backendEnabled = false
  try {
    const learning = await fetchLearningExperience(supabase)
    catalog = learning.catalog
    progress = learning.progress
    backendEnabled = true
  } catch (error) {
    console.error('Could not load the learning backend; using the authored fallback.', error)
  }

  return (
    <LearningPathLibrary
      catalog={catalog}
      progress={progress}
      backendEnabled={backendEnabled}
      legacyLessons={lessons}
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
    return (
      <LearnPageShell
        title="Articles"
        intro="Short reads on habits, focus, and health — each one ends with a quiz that pays out XP and coins."
      >
        <LearnPageClient lessons={lessons} />
      </LearnPageShell>
    )
  }

  return (
    <LearnPageShell
      title="Learn by doing"
      intro="Build social confidence, founder judgment, and fitness knowledge through short interactive paths."
    >
      <AdminAcademy supabase={supabase} lessons={lessons} />
    </LearnPageShell>
  )
}

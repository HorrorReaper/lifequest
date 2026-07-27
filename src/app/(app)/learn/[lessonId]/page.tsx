'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { LESSONS } from '@/lib/lessons'
import { LessonReader } from '@/components/learn/LessonReader'
import { InteractiveLessonPlayer } from '@/components/learn/InteractiveLessonPlayer'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
  findPathLesson,
  isLessonUnlocked,
  type LearningCatalog,
  type LearningProgress,
} from '@/lib/learning-paths'
import { readLocalLearningCatalog, readLocalLearningProgress } from '@/lib/learning-local'
import { Button } from '@/components/ui/button'
import { fetchLearningExperience } from '@/lib/learning-api'

interface LessonCompletionLookup {
  from(table: 'lesson_completions'): {
    select(columns: 'id'): {
      eq(column: 'user_id', userId: string): {
        eq(column: 'lesson_id', lessonId: string): {
          maybeSingle(): Promise<{ data: { id: string } | null }>
        }
      }
    }
  }
}

export default function LessonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.lessonId as string
  const [catalog, setCatalog] = useState<LearningCatalog>(DEFAULT_LEARNING_CATALOG)
  const [progress, setProgress] = useState<LearningProgress>(EMPTY_LEARNING_PROGRESS)
  const [alreadyCompleted, setAlreadyCompleted] = useState(false)
  const [loadingLegacy, setLoadingLegacy] = useState(true)
  const [loadingLearning, setLoadingLearning] = useState(true)
  const [backendEnabled, setBackendEnabled] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const learning = await fetchLearningExperience(supabase)
        setCatalog(learning.catalog)
        setProgress(learning.progress)
        setBackendEnabled(true)
      } catch (error) {
        console.error('Could not load the learning backend; using local preview data.', error)
        setCatalog(readLocalLearningCatalog())
        setProgress(readLocalLearningProgress())
      } finally {
        setLoadingLearning(false)
      }
    })()
  }, [])

  const pathLesson = findPathLesson(catalog, lessonId)
  const legacyLesson = LESSONS.find((lesson) => lesson.id === lessonId)

  useEffect(() => {
    if (loadingLearning || pathLesson || !legacyLesson) return

    const supabase = createClient()
    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await (supabase as unknown as LessonCompletionLookup)
        .from('lesson_completions')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle()

      setAlreadyCompleted(Boolean(data))
      setLoadingLegacy(false)
    })()
  }, [legacyLesson, lessonId, loadingLearning, pathLesson, router])

  if (loadingLearning) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading lesson…</p>
      </div>
    )
  }

  if (!pathLesson && !legacyLesson) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Lesson not found.</p>
      </div>
    )
  }

  if (loadingLegacy && legacyLesson) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (pathLesson) {
    const unlocked = isLessonUnlocked(pathLesson.path, lessonId, progress)
    if (!unlocked && !progress.completions[lessonId]) {
      return (
        <div className="grid min-h-svh place-items-center bg-background p-4">
          <div className="max-w-sm rounded-[2rem] border bg-card p-8 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-muted">
              <LockKeyhole className="size-6 text-muted-foreground" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">Lesson locked</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Complete the previous lesson in {pathLesson.path.title} to unlock this one.
            </p>
            <Button className="mt-5 w-full" asChild>
              <Link href="/learn">Back to the path</Link>
            </Button>
          </div>
        </div>
      )
    }

    return (
      <InteractiveLessonPlayer
        catalog={catalog}
        path={pathLesson.path}
        lesson={pathLesson.lesson}
        progress={progress}
        backendEnabled={backendEnabled}
      />
    )
  }

  return <LessonReader lesson={legacyLesson!} alreadyCompleted={alreadyCompleted} />
}

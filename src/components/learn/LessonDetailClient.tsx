'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { LESSONS } from '@/lib/lessons'
import { LessonReader } from './LessonReader'
import { InteractiveLessonPlayer } from './InteractiveLessonPlayer'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
  findPathLesson,
  isLessonUnlocked,
  type LearningCatalog,
  type LearningProgress,
} from '@/lib/learning-paths'
import {
  readLearningDraftPreview,
  readLocalLearningCatalog,
  readLocalLearningProgress,
} from '@/lib/learning-local'
import { withPersonalLearningPath } from '@/lib/personal-learning'
import { Button } from '@/components/ui/button'
import {
  fetchAdminLearningCatalog,
  fetchLearningExperience,
} from '@/lib/learning-api'
import { mergePreviewProgress } from './use-preview-progress'

interface Props {
  lessonId: string
  coursesEnabled: boolean
  userId: string
  draftPreview?: boolean
}

export function LessonDetailClient({
  lessonId,
  coursesEnabled,
  userId,
  draftPreview = false,
}: Props) {
  const [learning, setLearning] = useState<{
    catalog: LearningCatalog
    progress: LearningProgress
    backend: boolean
    ready: boolean
  }>({
    catalog: DEFAULT_LEARNING_CATALOG,
    progress: EMPTY_LEARNING_PROGRESS,
    backend: false,
    ready: !coursesEnabled,
  })
  const [legacyComplete, setLegacyComplete] = useState<boolean | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const legacy = LESSONS.find((lesson) => lesson.id === lessonId)
  const pathLesson =
    coursesEnabled && !legacy
      ? findPathLesson(learning.catalog, lessonId)
      : null

  useEffect(() => {
    if (!coursesEnabled || legacy) return
    let active = true
    const client = createClient()
    void (async () => {
      try {
        if (draftPreview) {
          const catalog =
            readLearningDraftPreview() ??
            (await fetchAdminLearningCatalog(client))
          if (active)
            setLearning({
              catalog,
              progress: EMPTY_LEARNING_PROGRESS,
              backend: false,
              ready: true,
            })
          return
        }
        const response = await fetchLearningExperience(client)
        const catalog = withPersonalLearningPath(response.catalog)
        const publishedIds = response.catalog.paths.map((p) => p.id)
        const found = findPathLesson(catalog, lessonId)
        const progress = mergePreviewProgress(
          catalog,
          response.progress,
          readLocalLearningProgress(userId),
          publishedIds,
        )
        if (active)
          setLearning({
            catalog,
            progress,
            backend: !!found && publishedIds.includes(found.path.id),
            ready: true,
          })
      } catch (error) {
        if (draftPreview) {
          if (active)
            setLoadError(
              'Could not load this draft. Return to Learning Studio and open Preview draft again.',
            )
          return
        }
        console.error(
          'Learning backend unavailable; opening the labelled local preview.',
          error,
        )
        if (active)
          setLearning({
            catalog: withPersonalLearningPath(readLocalLearningCatalog()),
            progress: readLocalLearningProgress(userId),
            backend: false,
            ready: true,
          })
      }
    })()
    return () => {
      active = false
    }
  }, [coursesEnabled, draftPreview, legacy, lessonId, userId])

  useEffect(() => {
    if (!legacy) return
    let active = true
    void createClient()
      .from('lesson_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setLegacyComplete(!!data)
      })
    return () => {
      active = false
    }
  }, [legacy, lessonId, userId])

  if (legacy)
    return legacyComplete === null ? (
      <p className="p-8 text-sm text-muted-foreground">Loading…</p>
    ) : (
      <LessonReader lesson={legacy} alreadyCompleted={legacyComplete} />
    )
  if (loadError)
    return (
      <p className="p-8 text-destructive" role="alert">
        {loadError}
      </p>
    )
  if (!learning.ready)
    return <p className="p-8 text-sm text-muted-foreground">Loading lesson…</p>
  if (!pathLesson)
    return <p className="p-8 text-muted-foreground">Lesson not found.</p>
  if (
    !draftPreview &&
    !isLessonUnlocked(pathLesson.path, lessonId, learning.progress)
  )
    return (
      <div className="grid min-h-svh place-items-center p-6">
        <div className="max-w-sm space-y-4 text-center">
          <LockKeyhole className="mx-auto size-8" />
          <h1 className="text-xl font-medium">Lesson locked</h1>
          <p className="text-sm text-muted-foreground">
            Complete the previous lesson to unlock this one.
          </p>
          <Button asChild>
            <Link href={`/learn/courses/${pathLesson.path.id}`}>
              Back to the course
            </Link>
          </Button>
        </div>
      </div>
    )
  return (
    <InteractiveLessonPlayer
      key={lessonId}
      catalog={learning.catalog}
      path={pathLesson.path}
      lesson={pathLesson.lesson}
      progress={learning.progress}
      backendEnabled={learning.backend && !draftPreview}
      userId={userId}
      draftPreview={draftPreview}
    />
  )
}

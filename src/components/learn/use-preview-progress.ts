'use client'

import { useSyncExternalStore } from 'react'
import {
  LEARNING_PROGRESS_EVENT,
  learningProgressKey,
} from '@/lib/learning-local'
import {
  EMPTY_LEARNING_PROGRESS,
  type LearningCatalog,
  type LearningProgress,
} from '@/lib/learning-paths'

function subscribe(callback: () => void) {
  window.addEventListener(LEARNING_PROGRESS_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(LEARNING_PROGRESS_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function usePreviewProgress(userId?: string): LearningProgress {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return userId
          ? window.localStorage.getItem(learningProgressKey(userId))
          : null
      } catch {
        return null
      }
    },
    () => null,
  )
  try {
    const value = JSON.parse(raw ?? 'null') as LearningProgress | null
    return value?.version === 1 && value.completions && value.reflections
      ? value
      : EMPTY_LEARNING_PROGRESS
  } catch {
    return EMPTY_LEARNING_PROGRESS
  }
}

export function mergePreviewProgress(
  catalog: LearningCatalog,
  synced: LearningProgress,
  local: LearningProgress,
  publishedPathIds: readonly string[],
): LearningProgress {
  const previewLessons = catalog.paths
    .filter((p) => !publishedPathIds.includes(p.id))
    .flatMap((p) => p.units.flatMap((u) => u.lessons))
  const lessonIds = new Set(previewLessons.map((l) => l.id))
  const exerciseIds = new Set(
    previewLessons.flatMap((l) => l.exercises.map((e) => e.id)),
  )
  return {
    version: 1,
    completions: {
      ...synced.completions,
      ...Object.fromEntries(
        Object.entries(local.completions).filter(([id]) => lessonIds.has(id)),
      ),
    },
    reflections: {
      ...synced.reflections,
      ...Object.fromEntries(
        Object.entries(local.reflections).filter(([id]) => exerciseIds.has(id)),
      ),
    },
  }
}

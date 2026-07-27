import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
  validateLearningCatalog,
  type LearningCatalog,
  type LearningProgress,
  type LessonCompletion,
} from '@/lib/learning-paths'

export const LEARNING_CATALOG_STORAGE_KEY = 'lifequest.learning.catalog.v1'
export const LEARNING_PROGRESS_STORAGE_KEY = 'lifequest.learning.progress.v1'
export const LEARNING_CATALOG_EVENT = 'lifequest:learning-catalog-changed'

function cloneDefaultCatalog() {
  return structuredClone(DEFAULT_LEARNING_CATALOG)
}

export function readLocalLearningCatalog(): LearningCatalog {
  if (typeof window === 'undefined') return cloneDefaultCatalog()
  try {
    const stored = window.localStorage.getItem(LEARNING_CATALOG_STORAGE_KEY)
    if (!stored) return cloneDefaultCatalog()
    const parsed: unknown = JSON.parse(stored)
    return validateLearningCatalog(parsed, { answersRequired: true }) ? parsed : cloneDefaultCatalog()
  } catch {
    return cloneDefaultCatalog()
  }
}

export function writeLocalLearningCatalog(catalog: LearningCatalog) {
  if (typeof window === 'undefined') return
  if (!validateLearningCatalog(catalog, { answersRequired: true })) throw new Error('The learning catalog is invalid.')
  window.localStorage.setItem(LEARNING_CATALOG_STORAGE_KEY, JSON.stringify(catalog))
  window.dispatchEvent(new Event(LEARNING_CATALOG_EVENT))
}

export function resetLocalLearningCatalog() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LEARNING_CATALOG_STORAGE_KEY)
  window.dispatchEvent(new Event(LEARNING_CATALOG_EVENT))
}

export function readLocalLearningProgress(): LearningProgress {
  if (typeof window === 'undefined') return structuredClone(EMPTY_LEARNING_PROGRESS)
  try {
    const stored = window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY)
    if (!stored) return structuredClone(EMPTY_LEARNING_PROGRESS)
    const parsed = JSON.parse(stored) as Partial<LearningProgress>
    if (parsed.version !== 1 || !parsed.completions || !parsed.reflections) {
      return structuredClone(EMPTY_LEARNING_PROGRESS)
    }
    return parsed as LearningProgress
  } catch {
    return structuredClone(EMPTY_LEARNING_PROGRESS)
  }
}

export function completeLocalPathLesson(
  lessonId: string,
  score: number,
  mistakes: number,
  reflections: Record<string, string>
) {
  if (typeof window === 'undefined') return
  const progress = readLocalLearningProgress()
  const existing = progress.completions[lessonId]
  const completion: LessonCompletion = {
    lessonId,
    completedAt: existing?.completedAt ?? new Date().toISOString(),
    score: Math.max(existing?.score ?? 0, score),
    mistakes: existing ? Math.min(existing.mistakes, mistakes) : mistakes,
  }
  const next: LearningProgress = {
    version: 1,
    completions: { ...progress.completions, [lessonId]: completion },
    reflections: { ...progress.reflections, ...reflections },
  }
  window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(next))
}

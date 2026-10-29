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
export const LEARNING_PROGRESS_EVENT = 'lifequest:learning-preview-progress-changed'
export const LEARNING_DRAFT_PREVIEW_KEY = 'lifequest.learning.draft-preview.v1'

export function learningProgressKey(userId?: string) {
  return userId ? `${LEARNING_PROGRESS_STORAGE_KEY}:${userId}` : LEARNING_PROGRESS_STORAGE_KEY
}

export function writeLearningDraftPreview(catalog: LearningCatalog) {
  if (!validateLearningCatalog(catalog)) throw new Error('Invalid preview catalog.')
  window.sessionStorage.setItem(LEARNING_DRAFT_PREVIEW_KEY, JSON.stringify(catalog))
}

export function readLearningDraftPreview(): LearningCatalog | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(LEARNING_DRAFT_PREVIEW_KEY) ?? 'null')
    return validateLearningCatalog(value) ? value : null
  } catch { return null }
}

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

export function readLocalLearningProgress(userId?: string): LearningProgress {
  if (typeof window === 'undefined') return structuredClone(EMPTY_LEARNING_PROGRESS)
  try {
    const stored = window.localStorage.getItem(learningProgressKey(userId))
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
  reflections: Record<string, string>,
  userId?: string
) {
  if (typeof window === 'undefined') return
  const progress = readLocalLearningProgress(userId)
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
  window.localStorage.setItem(learningProgressKey(userId), JSON.stringify(next))
  window.dispatchEvent(new Event(LEARNING_PROGRESS_EVENT))
}

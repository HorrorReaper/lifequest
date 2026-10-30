import { beforeEach, describe, expect, it } from 'vitest'
import { installLocalStorageStub } from '../../test/local-storage-stub'
import {
  DEFAULT_LEARNING_CATALOG,
  getPathLessons,
  validateLearningCatalog,
} from './learning-paths'
import {
  PERSONAL_LEARNING_PATH,
  withPersonalLearningPath,
} from './personal-learning'
import {
  completeLocalPathLesson,
  readLocalLearningProgress,
} from './learning-local'

beforeEach(installLocalStorageStub)
describe('personal Business, Tech & AI course', () => {
  it('provides eight modules, 32 distinct lessons, both practice cases and eight separate assignments', () => {
    const catalog = withPersonalLearningPath(DEFAULT_LEARNING_CATALOG)
    expect(validateLearningCatalog(catalog)).toBe(true)
    expect(PERSONAL_LEARNING_PATH.units).toHaveLength(8)
    const lessons = getPathLessons(PERSONAL_LEARNING_PATH)
    expect(lessons).toHaveLength(32)
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(32)
    expect(
      lessons.every((lesson) =>
        lesson.exercises.some(
          (e) =>
            e.type === 'concept' &&
            e.perspectives?.product &&
            e.perspectives.company,
        ),
      ),
    ).toBe(true)
    expect(
      lessons
        .flatMap((l) => l.exercises)
        .filter((e) => e.type === 'reflection' && e.practiceMinutes),
    ).toHaveLength(8)
  })

  it('preserves a published or pinned personal path instead of replacing it with authored content', () => {
    const catalog = withPersonalLearningPath(DEFAULT_LEARNING_CATALOG)
    catalog.paths.at(-1)!.title = 'Pinned course title'
    expect(withPersonalLearningPath(catalog)).toBe(catalog)
    expect(catalog.paths.at(-1)!.title).toBe('Pinned course title')
    expect(DEFAULT_LEARNING_CATALOG.paths).toHaveLength(3)
  })

  it('rejects corrupt visual content and invalid options without throwing', () => {
    const catalog = withPersonalLearningPath(DEFAULT_LEARNING_CATALOG)
    const exercise = catalog.paths.at(-1)!.units[0].lessons[0].exercises[0]
    if (exercise.type !== 'concept') throw new Error('Expected concept')
    exercise.blocks = [
      { type: 'sequence', items: [{ title: '', body: 'Text' }] },
    ]
    expect(validateLearningCatalog(catalog)).toBe(false)
    const broken = structuredClone(DEFAULT_LEARNING_CATALOG)
    Object.assign(broken.paths[0].units[0].lessons[0].exercises[1], {
      options: null,
    })
    expect(validateLearningCatalog(broken)).toBe(false)
  })

  it('keeps preview reflections and progress isolated by signed-in account', () => {
    window.localStorage.clear()
    completeLocalPathLesson(
      'preview-lesson',
      100,
      0,
      { reflection: 'Private note' },
      'admin-a',
    )
    expect(
      readLocalLearningProgress('admin-a').completions['preview-lesson'],
    ).toBeDefined()
    expect(readLocalLearningProgress('admin-b').reflections).toEqual({})
    expect(readLocalLearningProgress().reflections).toEqual({})
  })
})

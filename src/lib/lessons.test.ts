import { describe, expect, it } from 'vitest'
import { LESSONS, annotateLessons, isArticleLessonId } from '@/lib/lessons'
import { DEFAULT_LEARNING_CATALOG, getPathLessons } from '@/lib/learning-paths'

describe('isArticleLessonId', () => {
  it('accepts every article in the library', () => {
    for (const lesson of LESSONS) {
      expect(isArticleLessonId(lesson.id)).toBe(true)
    }
  })

  it('rejects course lessons, which are the admin-only half of /learn/[lessonId]', () => {
    const courseLessonIds = DEFAULT_LEARNING_CATALOG.paths.flatMap((path) =>
      getPathLessons(path).map((lesson) => lesson.id)
    )

    expect(courseLessonIds.length).toBeGreaterThan(0)
    for (const lessonId of courseLessonIds) {
      expect(isArticleLessonId(lessonId)).toBe(false)
    }
  })

  it('rejects an unknown id', () => {
    expect(isArticleLessonId('not-a-lesson')).toBe(false)
  })
})

describe('annotateLessons', () => {
  it('marks the completed articles and carries their completion time', () => {
    const [first, second] = LESSONS
    const annotated = annotateLessons([first.id], {
      [first.id]: '2026-01-02T03:04:05.000Z',
    })

    const firstStatus = annotated.find((lesson) => lesson.id === first.id)
    const secondStatus = annotated.find((lesson) => lesson.id === second.id)

    expect(annotated).toHaveLength(LESSONS.length)
    expect(firstStatus?.status).toBe('completed')
    expect(firstStatus?.completedAt).toBe('2026-01-02T03:04:05.000Z')
    expect(secondStatus?.status).toBe('not-started')
    expect(secondStatus?.completedAt).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
  findPathLesson,
  getPathCompletion,
  getPathLessons,
  isLessonUnlocked,
  validateLearningCatalog,
  type LearningProgress,
} from '@/lib/learning-paths'

describe('learning path catalog', () => {
  it('ships the three requested paths with substantial interactive content', () => {
    expect(DEFAULT_LEARNING_CATALOG.paths.map((path) => path.id)).toEqual([
      'social-skills',
      'entrepreneurship',
      'fitness',
    ])

    const lessons = DEFAULT_LEARNING_CATALOG.paths.flatMap(getPathLessons)
    expect(lessons).toHaveLength(19)
    expect(lessons.every((lesson) => lesson.exercises.length >= 4)).toBe(true)
    expect(new Set(lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.type)))).toEqual(
      new Set(['concept', 'choice', 'scenario', 'order', 'reflection', 'tool'])
    )
  })

  it('has a structurally valid catalog and unique lesson ids', () => {
    expect(validateLearningCatalog(DEFAULT_LEARNING_CATALOG)).toBe(true)
    const lessonIds = DEFAULT_LEARNING_CATALOG.paths.flatMap(getPathLessons).map((lesson) => lesson.id)
    expect(new Set(lessonIds).size).toBe(lessonIds.length)
  })

  it('rejects malformed admin imports before they reach the learner', () => {
    const invalidAccent = structuredClone(DEFAULT_LEARNING_CATALOG)
    invalidAccent.paths[0].accent = 'blue' as typeof invalidAccent.paths[0]['accent']
    expect(validateLearningCatalog(invalidAccent)).toBe(false)

    const invalidAnswer = structuredClone(DEFAULT_LEARNING_CATALOG)
    const choice = invalidAnswer.paths[0].units[0].lessons[0].exercises[1]
    if (choice.type !== 'choice') throw new Error('Expected authored choice exercise')
    choice.correctIndex = 99
    expect(validateLearningCatalog(invalidAnswer)).toBe(false)
  })

  it('accepts a tool exercise and rejects one without a toolId', () => {
    const withTool = structuredClone(DEFAULT_LEARNING_CATALOG)
    withTool.paths[0].units[0].lessons[0].exercises.push({
      id: 'define-your-vision',
      type: 'tool',
      toolId: 'vision',
      prompt: 'Write your first version now.',
    })
    expect(validateLearningCatalog(withTool)).toBe(true)

    // A tool exercise is only a pointer, so an empty pointer is the one thing
    // that must not get through — it would render as an unresolvable tool.
    const missingToolId = structuredClone(withTool)
    const added = missingToolId.paths[0].units[0].lessons[0].exercises.at(-1)
    if (added?.type !== 'tool') throw new Error('Expected the appended tool exercise')
    added.toolId = '   '
    expect(validateLearningCatalog(missingToolId)).toBe(false)
  })

  it('unlocks lessons sequentially within each path', () => {
    const path = DEFAULT_LEARNING_CATALOG.paths[0]
    const lessons = getPathLessons(path)
    expect(isLessonUnlocked(path, lessons[0].id, EMPTY_LEARNING_PROGRESS)).toBe(true)
    expect(isLessonUnlocked(path, lessons[1].id, EMPTY_LEARNING_PROGRESS)).toBe(false)

    const progress: LearningProgress = {
      version: 1,
      completions: {
        [lessons[0].id]: {
          lessonId: lessons[0].id,
          completedAt: '2026-07-26T12:00:00.000Z',
          score: 90,
          mistakes: 1,
        },
      },
      reflections: {},
    }
    expect(isLessonUnlocked(path, lessons[1].id, progress)).toBe(true)
    expect(getPathCompletion(path, progress)).toEqual({
      completed: 1,
      total: lessons.length,
      percent: Math.round(100 / lessons.length),
    })
  })

  it('finds a lesson together with its path and unit', () => {
    const located = findPathLesson(DEFAULT_LEARNING_CATALOG, 'business-offer')
    expect(located?.path.id).toBe('entrepreneurship')
    expect(located?.unit.id).toBe('business-validation')
    expect(located?.lesson.title).toBe('Build an offer people understand')
  })
})

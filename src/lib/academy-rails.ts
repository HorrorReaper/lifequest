import type { LessonWithStatus } from './lessons'

/**
 * A topic needs at least this many unread articles to earn a rail of its own.
 *
 * Articles carry two or three topics each, so without a floor the Academy
 * turns into a dozen rails holding one card. Topics below it are not lost:
 * anything no rail picked up lands in `leftover`.
 */
export const MIN_RAIL_ARTICLES = 2

export interface AcademyRail {
  topic: string
  lessons: LessonWithStatus[]
}

export interface AcademyStats {
  total: number
  completed: number
  xpEarned: number
}

export interface AcademyRails {
  /** Topic rails, the fullest first. An article appears in each of its topics. */
  rails: AcademyRail[]
  /** Unread articles whose topics were all too thin for a rail. */
  leftover: LessonWithStatus[]
  /** Already-read articles, collected into their own rail. */
  completed: LessonWithStatus[]
  stats: AcademyStats
}

/**
 * Groups the article library into the rows the Academy shows.
 *
 * Completed articles leave the topic rails so each rail reads as what is
 * still worth reading; they stay reachable in the completed rail.
 */
export function buildAcademyRails(lessons: LessonWithStatus[]): AcademyRails {
  const completed = lessons.filter((lesson) => lesson.status === 'completed')
  const unread = lessons.filter((lesson) => lesson.status !== 'completed')

  const byTopic = new Map<string, LessonWithStatus[]>()
  for (const lesson of unread) {
    for (const topic of lesson.topics) {
      const bucket = byTopic.get(topic)
      if (bucket) bucket.push(lesson)
      else byTopic.set(topic, [lesson])
    }
  }

  const rails = [...byTopic.entries()]
    .filter(([, railLessons]) => railLessons.length >= MIN_RAIL_ARTICLES)
    .map(([topic, railLessons]) => ({ topic, lessons: railLessons }))
    .sort((a, b) => b.lessons.length - a.lessons.length || a.topic.localeCompare(b.topic))

  const railed = new Set(rails.flatMap((rail) => rail.lessons.map((lesson) => lesson.id)))
  const leftover = unread.filter((lesson) => !railed.has(lesson.id))

  return {
    rails,
    leftover,
    completed,
    stats: {
      total: lessons.length,
      completed: completed.length,
      xpEarned: completed.reduce((sum, lesson) => sum + lesson.xp_reward, 0),
    },
  }
}

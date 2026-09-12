import { describe, expect, it } from 'vitest'
import { buildAcademyRails, MIN_RAIL_ARTICLES } from '@/lib/academy-rails'
import type { LessonWithStatus } from '@/lib/lessons'

function article(
  id: string,
  topics: string[],
  status: LessonWithStatus['status'] = 'not-started'
): LessonWithStatus {
  return {
    id,
    title: id,
    description: '',
    icon: '',
    image: '',
    topics,
    xp_reward: 50,
    coin_reward: 5,
    difficulty: 'easy',
    estimatedMinutes: 3,
    suggestedHabits: [],
    suggestedTasks: [],
    status,
  }
}

describe('buildAcademyRails', () => {
  it('makes a rail per topic, the biggest first', () => {
    const { rails } = buildAcademyRails([
      article('a', ['Habits']),
      article('b', ['Journaling']),
      article('c', ['Habits']),
      article('d', ['Journaling']),
      article('e', ['Habits']),
    ])

    expect(rails.map((rail) => rail.topic)).toEqual(['Habits', 'Journaling'])
    expect(rails[0].lessons.map((lesson) => lesson.id)).toEqual(['a', 'c', 'e'])
  })

  it('lets an article appear in every one of its topics', () => {
    const { rails } = buildAcademyRails([
      article('a', ['Habits', 'Mindset']),
      article('b', ['Habits']),
      article('c', ['Mindset']),
    ])

    expect(rails.find((rail) => rail.topic === 'Habits')?.lessons.map((l) => l.id)).toEqual(['a', 'b'])
    expect(rails.find((rail) => rail.topic === 'Mindset')?.lessons.map((l) => l.id)).toEqual(['a', 'c'])
  })

  it('drops a topic too thin to fill a rail', () => {
    const { rails } = buildAcademyRails([
      article('a', ['Habits']),
      article('b', ['Habits']),
      article('c', ['Trivia']),
    ])

    expect(MIN_RAIL_ARTICLES).toBe(2)
    expect(rails.map((rail) => rail.topic)).toEqual(['Habits'])
  })

  it('catches an article no rail picked up in the leftover rail', () => {
    const { leftover } = buildAcademyRails([
      article('a', ['Habits']),
      article('b', ['Habits']),
      article('c', ['Trivia']),
    ])

    expect(leftover.map((lesson) => lesson.id)).toEqual(['c'])
  })

  it('leaves nothing over when every article reached a rail', () => {
    const { leftover } = buildAcademyRails([
      article('a', ['Habits', 'Trivia']),
      article('b', ['Habits']),
    ])

    expect(leftover).toEqual([])
  })

  it('moves completed articles out of the topic rails and into their own', () => {
    const { rails, completed } = buildAcademyRails([
      article('a', ['Habits']),
      article('b', ['Habits']),
      article('c', ['Habits'], 'completed'),
    ])

    expect(rails[0].lessons.map((lesson) => lesson.id)).toEqual(['a', 'b'])
    expect(completed.map((lesson) => lesson.id)).toEqual(['c'])
  })

  it('hides a rail whose articles have all been read', () => {
    const { rails, completed } = buildAcademyRails([
      article('a', ['Habits'], 'completed'),
      article('b', ['Habits'], 'completed'),
    ])

    expect(rails).toEqual([])
    expect(completed.map((lesson) => lesson.id)).toEqual(['a', 'b'])
  })

  it('does not count a completed article towards the leftover rail', () => {
    const { leftover } = buildAcademyRails([
      article('a', ['Habits']),
      article('b', ['Habits']),
      article('c', ['Trivia'], 'completed'),
    ])

    expect(leftover).toEqual([])
  })

  it('reports what has been read and the XP it earned', () => {
    const { stats } = buildAcademyRails([
      article('a', ['Habits'], 'completed'),
      article('b', ['Habits']),
      article('c', ['Habits']),
    ])

    expect(stats).toEqual({ total: 3, completed: 1, xpEarned: 50 })
  })

  it('copes with no articles at all', () => {
    expect(buildAcademyRails([])).toEqual({
      rails: [],
      leftover: [],
      completed: [],
      stats: { total: 0, completed: 0, xpEarned: 0 },
    })
  })
})

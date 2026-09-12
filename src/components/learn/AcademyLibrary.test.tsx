import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AcademyLibrary } from '@/components/learn/AcademyLibrary'
import type { LessonWithStatus } from '@/lib/lessons'
import type { JournalInsightItem } from '@/lib/journal-insights'
import type { InsightType } from '@/lib/types'

vi.mock('@/components/learn/ToolGrid', () => ({
  ToolGrid: () => <div data-testid="tools" />,
}))

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

afterEach(cleanup)

function article(
  id: string,
  topics: string[],
  status: LessonWithStatus['status'] = 'not-started'
): LessonWithStatus {
  return {
    id,
    title: `Article ${id}`,
    description: 'About something',
    icon: '📘',
    image: '/images/lessons/cover.jpg',
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

function insight(
  id: string,
  type: InsightType,
  { markedAt = '2026-01-01T00:00:00Z', isFavorite = false } = {}
): JournalInsightItem {
  return {
    id,
    source: 'response',
    sourceId: id,
    entryId: `entry-${id}`,
    fieldId: 'field',
    type,
    title: `Insight ${id}`,
    answer: `answer ${id}`,
    prompt: null,
    tags: ['work'],
    actionText: null,
    isFavorite,
    markedAt,
    entryDate: markedAt.slice(0, 10),
    template: { id: 'tpl', name: 'Evening', icon: '🌙' },
  }
}

const LIBRARY = [
  article('a', ['Habits', 'Mindset']),
  article('b', ['Habits']),
  article('c', ['Mindset']),
  article('d', ['Trivia']),
  article('e', ['Habits'], 'completed'),
]

describe('AcademyLibrary', () => {
  it('gives each topic a rail of its own, the fullest first', () => {
    render(<AcademyLibrary lessons={LIBRARY} insights={[]} />)

    const rails = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    expect(rails.slice(0, 2)).toEqual(['Habits', 'Mindset'])
  })

  it('shows the toolbox above the articles', () => {
    render(<AcademyLibrary lessons={LIBRARY} insights={[]} />)

    expect(screen.getByTestId('tools')).toBeTruthy()
  })

  it('collects an article no topic rail claimed', () => {
    render(<AcademyLibrary lessons={LIBRARY} insights={[]} />)

    const leftover = screen.getByRole('region', { name: /more articles/i })
    expect(within(leftover).getByText('Article d')).toBeTruthy()
  })

  it('keeps read articles out of the topic rails and in the completed one', () => {
    render(<AcademyLibrary lessons={LIBRARY} insights={[]} />)

    const habits = screen.getByRole('region', { name: 'Habits' })
    expect(within(habits).queryByText('Article e')).toBeNull()
    const done = screen.getByRole('region', { name: /completed/i })
    expect(within(done).getByText('Article e')).toBeTruthy()
  })

  it('reports reading progress and the XP it earned', () => {
    render(<AcademyLibrary lessons={LIBRARY} insights={[]} />)

    expect(screen.getByText('1 of 5')).toBeTruthy()
    // Exact, so the XP badge the cards carry cannot stand in for the total.
    expect(screen.getByText('50')).toBeTruthy()
  })

  it('leaves out the completed rail until something has been read', () => {
    render(<AcademyLibrary lessons={[article('a', ['Habits']), article('b', ['Habits'])]} insights={[]} />)

    expect(screen.queryByRole('region', { name: /completed/i })).toBeNull()
  })

  it('says so when there are no articles at all', () => {
    render(<AcademyLibrary lessons={[]} insights={[]} />)

    expect(screen.getByText(/no articles yet/i)).toBeTruthy()
  })
})

const INSIGHTS = [
  insight('a', 'learning', { markedAt: '2026-01-01T00:00:00Z' }),
  insight('b', 'learning', { markedAt: '2026-03-01T00:00:00Z' }),
  insight('c', 'learning', { markedAt: '2025-01-01T00:00:00Z', isFavorite: true }),
  insight('d', 'idea'),
  insight('e', 'idea'),
  insight('f', 'win'),
]

describe('AcademyLibrary journal insights', () => {
  it('gives each insight type a rail, the fullest first', () => {
    render(<AcademyLibrary lessons={[]} insights={INSIGHTS} />)

    const rails = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    expect(rails).toEqual(['Learnings', 'Ideas', 'Wins'])
  })

  it('leads a rail with the favorite, then the newest', () => {
    render(<AcademyLibrary lessons={[]} insights={INSIGHTS} />)

    const learnings = screen.getByRole('region', { name: 'Learnings' })
    const titles = within(learnings)
      .getAllByRole('link')
      .map((link) => link.textContent)
    expect(titles[0]).toContain('Insight c')
    expect(titles[1]).toContain('Insight b')
  })

  it('links an insight back to the reflection it came from', () => {
    render(<AcademyLibrary lessons={[]} insights={[insight('a', 'learning')]} />)

    const link = within(screen.getByRole('region', { name: 'Learnings' })).getByRole('link')
    expect(link.getAttribute('href')).toBe('/journal/entry-a')
  })

  it('sends you to the full insights page for the rest', () => {
    render(<AcademyLibrary lessons={[]} insights={INSIGHTS} />)

    const seeAll = screen.getByRole('link', { name: /see all/i })
    expect(seeAll.getAttribute('href')).toBe('/journal/insights')
  })

  it('asks for a first insight instead of showing empty rails', () => {
    render(<AcademyLibrary lessons={LIBRARY} insights={[]} />)

    expect(screen.getByText(/mark a learning/i)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Learnings' })).toBeNull()
  })

  it('keeps the completed articles last, below the journal rails', () => {
    render(<AcademyLibrary lessons={LIBRARY} insights={INSIGHTS} />)

    const rails = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))
    expect(rails.indexOf('Learnings')).toBeGreaterThan(rails.indexOf('Habits'))
    expect(rails.indexOf('Completed')).toBe(rails.length - 1)
  })
})

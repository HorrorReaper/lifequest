import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  admin: false,
  catalog: vi.fn(),
  insights: vi.fn(async () => []),
}))
vi.mock('@/lib/admin', () => ({ showAdminUi: async () => mocks.admin }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }),
  }),
}))
vi.mock('@/lib/journal-insights', () => ({
  fetchJournalInsights: mocks.insights,
}))
vi.mock('@/lib/learning-api', () => ({
  fetchLearningExperience: mocks.catalog,
}))
vi.mock('@/components/learn/AcademyLibrary', () => ({
  AcademyLibrary: () => (
    <div data-testid="public-library">Public articles and tools</div>
  ),
}))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`)
  },
  notFound: () => {
    throw new Error('not-found')
  },
}))
import LearnPage from '@/app/(app)/learn/page'
import CoursePage from '@/app/(app)/learn/courses/[pathId]/page'
import LessonPage from '@/app/(app)/learn/[lessonId]/page'

beforeEach(() => {
  mocks.admin = false
  mocks.catalog.mockClear()
  mocks.insights.mockClear()
})
afterEach(cleanup)
describe('public Library and admin Academy boundary', () => {
  it('keeps the public Library branch and never asks for a course catalog in user/preview mode', async () => {
    render(await LearnPage())
    expect(screen.getByTestId('public-library')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Library' })).toBeDefined()
    expect(mocks.catalog).not.toHaveBeenCalled()
    expect(mocks.insights).toHaveBeenCalledOnce()
  })
  it('rejects a direct course link before loading any curriculum', async () => {
    await expect(
      CoursePage({
        params: Promise.resolve({
          pathId: 'entrepreneurial-information-systems',
        }),
      }),
    ).rejects.toThrow('redirect:/learn')
    expect(mocks.catalog).not.toHaveBeenCalled()
  })
  it('rejects a direct lesson and draft-preview query for a normal user', async () => {
    await expect(
      LessonPage({
        params: Promise.resolve({ lessonId: 'wis-opportunities-problem' }),
        searchParams: Promise.resolve({ preview: 'draft' }),
      }),
    ).rejects.toThrow('redirect:/learn')
    expect(mocks.catalog).not.toHaveBeenCalled()
  })
})

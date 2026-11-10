import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LessonDetailClient } from './LessonDetailClient'
import { PERSONAL_LEARNING_PATH } from '@/lib/personal-learning'

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  draft: vi.fn(),
  published: vi.fn(),
}))
vi.mock('@/lib/learning-local', () => ({
  readLearningDraftPreview: mocks.preview,
  readLocalLearningCatalog: vi.fn(),
  readLocalLearningProgress: vi.fn(),
}))
vi.mock('@/lib/learning-api', () => ({
  fetchAdminLearningCatalog: mocks.draft,
  fetchLearningExperience: mocks.published,
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('./InteractiveLessonPlayer', () => ({
  InteractiveLessonPlayer: ({
    lesson,
    backendEnabled,
    draftPreview,
  }: {
    lesson: { title: string }
    backendEnabled: boolean
    draftPreview: boolean
  }) => (
    <div
      data-testid="player"
      data-backend={String(backendEnabled)}
      data-draft={String(draftPreview)}
    >
      {lesson.title}
    </div>
  ),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe('Studio draft preview', () => {
  it('uses the unsaved snapshot without calling learner or admin catalog RPCs', async () => {
    const path = structuredClone(PERSONAL_LEARNING_PATH)
    path.units[0].lessons[0].title = 'My edited draft title'
    mocks.preview.mockReturnValue({ version: 1, paths: [path] })
    render(
      <LessonDetailClient
        lessonId={path.units[0].lessons[0].id}
        coursesEnabled
        userId="admin-a"
        draftPreview
      />,
    )
    expect((await screen.findByTestId('player')).textContent).toBe(
      'My edited draft title',
    )
    expect(screen.getByTestId('player').getAttribute('data-backend')).toBe(
      'false',
    )
    expect(mocks.draft).not.toHaveBeenCalled()
    expect(mocks.published).not.toHaveBeenCalled()
  })
  it('reports an unavailable draft instead of substituting published/local content', async () => {
    mocks.preview.mockReturnValue(null)
    mocks.draft.mockRejectedValue(new Error('Unavailable'))
    render(
      <LessonDetailClient
        lessonId={PERSONAL_LEARNING_PATH.units[0].lessons[0].id}
        coursesEnabled
        userId="admin-a"
        draftPreview
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Could not load this draft/,
    )
    expect(screen.queryByTestId('player')).toBeNull()
    expect(mocks.published).not.toHaveBeenCalled()
  })
})

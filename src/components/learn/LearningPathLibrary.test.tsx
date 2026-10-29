import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installLocalStorageStub } from '../../../test/local-storage-stub'
import { LearningPathLibrary } from './LearningPathLibrary'
import {
  DEFAULT_LEARNING_CATALOG,
  EMPTY_LEARNING_PROGRESS,
} from '@/lib/learning-paths'
import { completeLocalPathLesson } from '@/lib/learning-local'
import { PERSONAL_LEARNING_PATH } from '@/lib/personal-learning'

beforeEach(installLocalStorageStub)
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
describe('personal Academy overview', () => {
  it('presents the personal course as a preview, supports module expansion, and preserves existing paths', async () => {
    const user = userEvent.setup()
    render(
      <LearningPathLibrary
        catalog={DEFAULT_LEARNING_CATALOG}
        progress={EMPTY_LEARNING_PROGRESS}
        backendEnabled
        publishedPathIds={DEFAULT_LEARNING_CATALOG.paths.map((p) => p.id)}
        legacyLessons={[]}
        userId="a"
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /Unternehmerisch denken/,
    )
    expect(screen.getByRole('status').textContent).toMatch(/Kursvorschau/)
    expect(
      screen
        .getByRole('link', { name: /Lektion starten/ })
        .getAttribute('href'),
    ).toBe(`/learn/${PERSONAL_LEARNING_PATH.units[0].lessons[0].id}`)
    await user.click(screen.getByRole('button', { name: /Weitere 4 Module/ }))
    expect(screen.getByRole('button', { name: /08 Einführen/ })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Social' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Social Intelligence',
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('continues local unpublished progress without replacing synchronized completions', () => {
    const lesson = PERSONAL_LEARNING_PATH.units[0].lessons[0]
    completeLocalPathLesson(lesson.id, 100, 0, {}, 'a')
    render(
      <LearningPathLibrary
        catalog={DEFAULT_LEARNING_CATALOG}
        progress={EMPTY_LEARNING_PROGRESS}
        backendEnabled
        legacyLessons={[]}
        userId="a"
      />,
    )
    expect(
      screen.getByRole('link', { name: /Weiterlernen/ }).getAttribute('href'),
    ).toBe(`/learn/${PERSONAL_LEARNING_PATH.units[0].lessons[1].id}`)
  })
})

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorageStub } from '../../../test/local-storage-stub'
import { InteractiveLessonPlayer } from './InteractiveLessonPlayer'
import { PERSONAL_LEARNING_PATH } from '@/lib/personal-learning'
import { EMPTY_LEARNING_PROGRESS, type PathLesson } from '@/lib/learning-paths'
import { readLocalLearningProgress } from '@/lib/learning-local'

const { submit } = vi.hoisted(() => ({ submit: vi.fn() }))
vi.mock('@/lib/learning-api', () => ({ submitLearningExercise: submit }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('./LessonToolExercise', () => ({
  LessonToolExercise: ({ onUsed }: { onUsed: () => void }) => (
    <button onClick={onUsed}>Save tool</button>
  ),
}))
beforeEach(installLocalStorageStub)
afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.clearAllMocks()
})

function mount(
  lesson: PathLesson,
  backendEnabled = false,
  draftPreview = false,
) {
  window.scrollTo = vi.fn()
  return render(
    <InteractiveLessonPlayer
      catalog={{ version: 1, paths: [PERSONAL_LEARNING_PATH] }}
      path={PERSONAL_LEARNING_PATH}
      lesson={lesson}
      progress={EMPTY_LEARNING_PROGRESS}
      backendEnabled={backendEnabled}
      userId="admin-a"
      draftPreview={draftPreview}
    />,
  )
}

describe('Academy lesson player', () => {
  it('inspects draft tool steps without mounting tools or changing their saved entries', async () => {
    const user = userEvent.setup()
    mount(
      {
        ...PERSONAL_LEARNING_PATH.units[0].lessons[0],
        exercises: [
          { id: 'tool', type: 'tool', toolId: 'vision', prompt: 'Use a tool' },
        ],
      },
      false,
      true,
    )
    expect(screen.queryByRole('button', { name: 'Save tool' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Preview tool step' }))
    await user.click(
      screen.getByRole('button', { name: 'Festhalten & abschließen' }),
    )
    expect(readLocalLearningProgress('admin-a').completions).toEqual({})
    expect(submit).not.toHaveBeenCalled()
  })
  it('runs both cases, rejects a wrong answer, and saves the completed preview only to its owner', async () => {
    const user = userEvent.setup()
    mount(PERSONAL_LEARNING_PATH.units[0].lessons[0])
    await user.click(
      screen.getByRole('button', { name: 'Unternehmen verbessern' }),
    )
    expect(screen.getByText(/Ein Service-Team durchsucht/)).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(
      (screen.getByRole('button', { name: 'Weiter' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await user.click(screen.getByRole('button', { name: /A Wir brauchen/ }))
    expect(screen.getByText('Hier lohnt sich ein zweiter Blick.')).toBeDefined()
    await user.click(screen.getByRole('button', { name: /B Unser Team/ }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.type(
      screen.getByRole('textbox'),
      'Ich prüfe die Suchschritte für drei konkrete Anfragen.',
    )
    await user.click(
      screen.getByRole('button', { name: 'Festhalten & abschließen' }),
    )
    expect(
      screen.getByRole('heading', { name: /Ein klarerer Blick/ }),
    ).toBeDefined()
    expect(
      Object.keys(readLocalLearningProgress('admin-a').completions),
    ).toHaveLength(1)
    expect(
      Object.keys(readLocalLearningProgress('admin-b').completions),
    ).toHaveLength(0)
    expect(submit).not.toHaveBeenCalled()
  })

  it('retains a server completion on a choice followed by a closing concept, including its actual reward', async () => {
    const user = userEvent.setup()
    const lesson: PathLesson = {
      ...PERSONAL_LEARNING_PATH.units[0].lessons[0],
      exercises: [
        {
          id: 'check',
          type: 'choice',
          prompt: 'Choose one',
          options: ['Yes', 'No'],
          explanation: 'Because.',
        },
        {
          id: 'closing',
          type: 'concept',
          title: 'Closing idea',
          body: 'A final thought.',
          takeaway: 'Keep it.',
        },
      ],
    }
    submit.mockResolvedValue({
      correct: true,
      completed: true,
      rewarded: true,
      mistakes: 0,
      score: 100,
      masteryPoints: 100,
      xpAwarded: 50,
      coinsAwarded: 20,
    })
    mount(lesson, true)
    await user.click(screen.getByRole('button', { name: /A Yes/ }))
    await user.click(screen.getByRole('button', { name: 'Weiter' }))
    await user.click(
      screen.getByRole('button', { name: 'Festhalten & abschließen' }),
    )
    expect(screen.getByText('+50 XP · +20 coins')).toBeDefined()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('blocks duplicate submissions, preserves a failed reflection for retry, and never silently downgrades to preview', async () => {
    let reject!: (reason: Error) => void
    submit.mockImplementationOnce(
      () =>
        new Promise((_, no) => {
          reject = no
        }),
    )
    const lesson: PathLesson = {
      ...PERSONAL_LEARNING_PATH.units[0].lessons[0],
      exercises: [
        {
          id: 'reflect',
          type: 'reflection',
          prompt: 'Your next step',
          placeholder: 'Write here',
        },
      ],
    }
    mount(lesson, true)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A concrete next step' },
    })
    const button = screen.getByRole('button', {
      name: 'Festhalten & abschließen',
    })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(submit).toHaveBeenCalledTimes(1)
    reject(new Error('Connection failed'))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Connection failed'),
    )
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'A concrete next step',
    )
    expect(readLocalLearningProgress('admin-a').completions).toEqual({})
  })

  it('does not write unsaved studio draft completions into learner preview progress', async () => {
    const user = userEvent.setup()
    mount(
      {
        ...PERSONAL_LEARNING_PATH.units[0].lessons[0],
        exercises: [
          {
            id: 'draft',
            type: 'concept',
            title: 'Draft',
            body: 'Text',
            takeaway: 'Idea',
          },
        ],
      },
      false,
      true,
    )
    await user.click(
      screen.getByRole('button', { name: 'Festhalten & abschließen' }),
    )
    expect(readLocalLearningProgress('admin-a').completions).toEqual({})
  })
})

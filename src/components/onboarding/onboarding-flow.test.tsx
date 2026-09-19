import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  birthYearFromAge,
  isValidAge,
  OnboardingFlow,
} from '@/components/onboarding/onboarding-flow'

const push = vi.fn()
const createGoal = vi.fn()
const fetchCityState = vi.fn()
const upsert = vi.fn()

// AnimatePresence mode="wait" holds the next step back until the exit
// animation finishes, which never happens in jsdom. The flow's behaviour is
// what is under test here, not its transitions.
vi.mock('framer-motion', () => {
  const passthrough = ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>
  return {
    motion: new Proxy({} as Record<string, unknown>, { get: () => passthrough }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => true,
  }
})

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/city/city', () => ({
  fetchCityState: (...a: unknown[]) => fetchCityState(...a),
}))
vi.mock('@/lib/goals', async () => {
  const actual = await vi.importActual<typeof import('@/lib/goals')>('@/lib/goals')
  return { ...actual, createGoal: (...a: unknown[]) => createGoal(...a) }
})
vi.mock('@/lib/supabase/helpers', () => ({
  supabaseFrom: () => ({ upsert: (...a: unknown[]) => upsert(...a) }),
}))

const templates = [
  {
    id: 'tpl-1',
    name: 'Daily check-in',
    description: 'A short look at the day.',
    icon: 'pencil',
    entry_type: 'daily',
    xp_reward: 20,
  },
]

const props = { userId: 'user-1', currentName: '', templates }

beforeEach(() => {
  push.mockReset()
  createGoal.mockReset().mockResolvedValue({ id: 'goal-1' })
  fetchCityState.mockReset().mockResolvedValue({})
  upsert.mockReset().mockReturnValue({
    select: () => Promise.resolve({ data: [{ id: 'user-1' }], error: null }),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const next = () => fireEvent.click(screen.getByRole('button', { name: /continue/i }))

/** Fills in everything up to, but not including, the template step. */
function answerThrough() {
  next()
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
  next()
  fireEvent.change(screen.getByLabelText('Your age'), { target: { value: '28' } })
  next()
  fireEvent.change(screen.getByLabelText('Your goal'), {
    target: { value: 'Run a half marathon' },
  })
  next()
}

describe('birthYearFromAge', () => {
  it('counts back from the current year', () => {
    expect(birthYearFromAge(28, new Date('2026-09-05T00:00:00Z'))).toBe(1998)
  })
})

describe('isValidAge', () => {
  it('accepts a plain age inside the range', () => {
    expect(isValidAge('28')).toBe(true)
    expect(isValidAge('13')).toBe(true)
    expect(isValidAge('120')).toBe(true)
  })

  it('rejects what is not an age', () => {
    expect(isValidAge('')).toBe(false)
    expect(isValidAge('12')).toBe(false)
    expect(isValidAge('121')).toBe(false)
    expect(isValidAge('2 8')).toBe(false)
    expect(isValidAge('twenty')).toBe(false)
  })
})

describe('OnboardingFlow', () => {
  it('asks one thing per step, in order', () => {
    render(<OnboardingFlow {...props} />)

    expect(screen.getByRole('heading', { name: /build your life like a city/i })).toBeTruthy()
    next()
    expect(screen.getByRole('heading', { name: /what should we call you/i })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    next()
    expect(screen.getByRole('heading', { name: /how old are you/i })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Your age'), { target: { value: '28' } })
    next()
    expect(screen.getByRole('heading', { name: /what do you want to change/i })).toBeTruthy()
  })

  it('will not move on without a name, an age, or a goal', () => {
    render(<OnboardingFlow {...props} />)
    next()

    const button = () => screen.getByRole('button', { name: /continue/i })
    expect(button()).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    expect(button()).toHaveProperty('disabled', false)
    next()

    expect(button()).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Your age'), { target: { value: '28' } })
    expect(button()).toHaveProperty('disabled', false)
    next()

    expect(button()).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Your goal'), { target: { value: 'Read more' } })
    expect(button()).toHaveProperty('disabled', false)
  })

  it('keeps non-digits out of the age field', () => {
    render(<OnboardingFlow {...props} />)
    next()
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    next()

    const field = screen.getByLabelText('Your age')
    fireEvent.change(field, { target: { value: '2a8!' } })

    expect(field).toHaveProperty('value', '28')
  })

  it('explains an age outside the range instead of just refusing', () => {
    render(<OnboardingFlow {...props} />)
    next()
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    next()
    fireEvent.change(screen.getByLabelText('Your age'), { target: { value: '9' } })

    expect(screen.getByText(/between 13 and 120/i)).toBeTruthy()
  })

  it('records the goal as a real goal, with the chosen category', async () => {
    render(<OnboardingFlow {...props} />)
    answerThrough()

    // Back up one step to choose a category other than the default.
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Learning' }))
    next()

    fireEvent.click(screen.getByRole('button', { name: /daily check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /start writing/i }))

    await waitFor(() =>
      expect(createGoal).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        expect.objectContaining({
          title: 'Run a half marathon',
          category: 'learning',
        })
      )
    )
  })

  it('saves the age as a birth year alongside the profile', async () => {
    render(<OnboardingFlow {...props} />)
    answerThrough()

    fireEvent.click(screen.getByRole('button', { name: /daily check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /start writing/i }))

    await waitFor(() => expect(upsert).toHaveBeenCalled())
    expect(upsert.mock.calls[0][0]).toMatchObject({
      username: 'Alex',
      birth_year: birthYearFromAge(28),
      onboarding_complete: true,
    })
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/journal/new/tpl-1?firstEntry=1')
    )
  })

  it('does not complete onboarding when the goal cannot be saved', async () => {
    createGoal.mockRejectedValue(new Error('offline'))
    render(<OnboardingFlow {...props} />)
    answerThrough()

    fireEvent.click(screen.getByRole('button', { name: /daily check-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /start writing/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    // The profile must still say onboarding is unfinished, so the answers are
    // asked for again rather than silently lost.
    expect(upsert).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})

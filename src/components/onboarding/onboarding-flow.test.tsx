import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

const push = vi.fn()
const fetchCityState = vi.fn()
const upsert = vi.fn()
const createGoal = vi.fn()
const enablePush = vi.fn()
const pushSupport = vi.fn()
const vapidPublicKey = vi.fn()

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
vi.mock('@/lib/goals', () => ({
  createGoal: (...a: unknown[]) => createGoal(...a),
}))
vi.mock('@/lib/push-client', () => ({
  enablePush: (...a: unknown[]) => enablePush(...a),
  pushSupport: () => pushSupport(),
  vapidPublicKey: () => vapidPublicKey(),
}))
vi.mock('@/lib/supabase/helpers', () => ({
  supabaseFrom: () => ({ upsert: (...a: unknown[]) => upsert(...a) }),
}))

const templates = [
  { id: 'morning', name: 'Morning Reflection', description: 'Start your day with gratitude.', entry_type: 'morning', xp_reward: 25, sort_order: 1 },
  { id: 'free', name: 'Free Write', description: 'Just write.', entry_type: 'free_write', xp_reward: 10, sort_order: 4 },
]

const props = {
  userId: 'user-1',
  currentName: 'Patrick',
  templates,
  reminderTimes: { daily_plan: '08:00', evening_review: '20:00' },
}

beforeEach(() => {
  push.mockReset()
  fetchCityState.mockReset().mockResolvedValue({})
  createGoal.mockReset().mockResolvedValue({ id: 'goal-1' })
  enablePush.mockReset().mockResolvedValue({ ok: true })
  pushSupport.mockReset().mockReturnValue('supported')
  vapidPublicKey.mockReset().mockReturnValue('public-key')
  upsert.mockReset().mockReturnValue({
    select: () => Promise.resolve({ data: [{ id: 'user-1' }], error: null }),
  })
})

afterEach(cleanup)

const primary = () =>
  screen.getByRole('button', { name: /start the adventure|continue|open the planner|start writing/i })

const heading = () => screen.getByRole('heading', { level: 1 }).textContent

/** Lets the mount-time push check settle, as a browser does before any tap. */
async function settle() {
  await act(async () => {})
}

async function answerUpToGoal() {
  await settle()
  fireEvent.click(primary())
  fireEvent.click(primary())
  fireEvent.change(screen.getByLabelText('Your age'), { target: { value: '30' } })
  fireEvent.click(primary())
  fireEvent.click(screen.getByRole('button', { name: 'Learning' }))
  fireEvent.change(screen.getByLabelText('Your goal'), { target: { value: 'Read 12 books' } })
  fireEvent.click(primary())
}

describe('OnboardingFlow', () => {
  it('opens on the adventure, then asks the name with the known one filled in', async () => {
    render(<OnboardingFlow {...props} />)
    await settle()
    expect(heading()).toBe('Build your life like an adventure.')

    fireEvent.click(primary())
    expect(heading()).toBe('What is your name?')
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Patrick')
    expect(screen.getByText('Step 1 of 5')).toBeTruthy()
  })

  it('has the avatar greet the user by first name once there is one', () => {
    render(<OnboardingFlow {...props} currentName="" />)
    fireEvent.click(primary())
    expect(screen.queryByText(/^Hey /)).toBeNull()

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex Morgan' } })
    expect(screen.getByText('Hey Alex!')).toBeTruthy()
  })

  it('asks for a name, an age in range and a goal before moving on', () => {
    render(<OnboardingFlow {...props} currentName="" />)
    fireEvent.click(primary())
    fireEvent.click(primary())
    expect(screen.getByRole('alert').textContent).toBe('Add the name we should greet you with.')

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex' } })
    fireEvent.click(primary())
    expect(heading()).toBe('How old are you?')

    fireEvent.change(screen.getByLabelText('Your age'), { target: { value: '12' } })
    fireEvent.click(primary())
    expect(screen.getByRole('alert').textContent).toBe('Enter an age between 13 and 120.')
    fireEvent.change(screen.getByLabelText('Your age'), { target: { value: '30' } })
    fireEvent.click(primary())

    expect(heading()).toBe('What do you want to improve?')
    expect(screen.getByLabelText('Your goal').getAttribute('placeholder')).toBe('Run a half marathon')
    fireEvent.click(screen.getByRole('button', { name: 'Finance' }))
    expect(screen.getByLabelText('Your goal').getAttribute('placeholder')).toBe('Save 3 months of expenses')
    fireEvent.click(primary())
    expect(screen.getByRole('alert').textContent).toBe('Write down one thing you want to improve.')
  })

  it('subscribes the reminders left on, from the tap on Continue', async () => {
    render(<OnboardingFlow {...props} />)
    await answerUpToGoal()

    expect(heading()).toBe('Should we remind you?')
    expect(screen.getByText('08:00')).toBeTruthy()
    expect(screen.getByText('20:00')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'Evening review' }))
    fireEvent.click(primary())

    await waitFor(() => expect(heading()).toBe('How do you want to start today?'))
    expect(enablePush).toHaveBeenCalledTimes(1)
    expect(enablePush).toHaveBeenCalledWith('daily_plan')
  })

  it('skips the reminders where this browser cannot get push', async () => {
    pushSupport.mockReturnValue('ios-needs-install')
    render(<OnboardingFlow {...props} />)
    await answerUpToGoal()

    expect(heading()).toBe('How do you want to start today?')
    expect(enablePush).not.toHaveBeenCalled()
  })

  it('offers the daily plan and every template, and one tap saves and shows day one', async () => {
    render(<OnboardingFlow {...props} />)
    await answerUpToGoal()
    fireEvent.click(primary())
    await waitFor(() => expect(heading()).toBe('How do you want to start today?'))

    expect(screen.getByRole('button', { name: /Plan today/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Morning Reflection.*\+25 XP/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Free Write/ }))

    await waitFor(() => expect(heading()).toBe('Patrick, your streak starts today.'))
    expect(screen.getByText('Finishing your Free Write counts as day one.')).toBeTruthy()
    expect(createGoal).toHaveBeenCalledWith({ client: true }, 'user-1', {
      title: 'Read 12 books',
      category: 'learning',
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        username: 'Patrick',
        birth_year: new Date().getFullYear() - 30,
        onboarding_complete: true,
      }),
      { onConflict: 'id' }
    )

    fireEvent.click(screen.getByRole('button', { name: /Start writing/ }))
    expect(push).toHaveBeenCalledWith('/journal/new/free?firstEntry=1')
  })

  it('leads the daily plan into the planner ritual', async () => {
    render(<OnboardingFlow {...props} />)
    await answerUpToGoal()
    fireEvent.click(primary())
    await waitFor(() => expect(heading()).toBe('How do you want to start today?'))
    fireEvent.click(screen.getByRole('button', { name: /Plan today/ }))

    await waitFor(() => expect(screen.getByText('Saving today’s plan counts as day one.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Open the planner/ }))
    expect(push).toHaveBeenCalledWith('/plan?step=ritual')
  })

  it('stays put when saving fails and does not save the goal twice on retry', async () => {
    upsert.mockReturnValueOnce({
      select: () => Promise.resolve({ data: null, error: { message: 'offline' } }),
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<OnboardingFlow {...props} />)
    await answerUpToGoal()
    fireEvent.click(primary())
    await waitFor(() => expect(heading()).toBe('How do you want to start today?'))

    fireEvent.click(screen.getByRole('button', { name: /Plan today/ }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/not saved/)
    expect(heading()).toBe('How do you want to start today?')

    fireEvent.click(screen.getByRole('button', { name: /Plan today/ }))
    await waitFor(() => expect(heading()).toBe('Patrick, your streak starts today.'))
    expect(createGoal).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledTimes(2)
  })

  it('saves once when an option is tapped twice quickly', async () => {
    let resolve: (value: unknown) => void = () => undefined
    createGoal.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<OnboardingFlow {...props} />)
    await answerUpToGoal()
    fireEvent.click(primary())
    await waitFor(() => expect(heading()).toBe('How do you want to start today?'))

    const option = screen.getByRole('button', { name: /Free Write/ })
    fireEvent.click(option)
    fireEvent.click(option)
    resolve({ id: 'goal-1' })

    await waitFor(() => expect(heading()).toBe('Patrick, your streak starts today.'))
    expect(createGoal).toHaveBeenCalledTimes(1)
  })
})

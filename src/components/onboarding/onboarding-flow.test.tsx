import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'

const push = vi.fn()
const fetchCityState = vi.fn()
const upsert = vi.fn()
const createTask = vi.fn()
const updateTask = vi.fn()
const fetchDayPlan = vi.fn()
const upsertDayPlan = vi.fn()

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
vi.mock('@/lib/tasks', () => ({
  createTask: (...a: unknown[]) => createTask(...a),
  updateTask: (...a: unknown[]) => updateTask(...a),
}))
vi.mock('@/lib/day-plans', () => ({
  fetchDayPlan: (...a: unknown[]) => fetchDayPlan(...a),
  upsertDayPlan: (...a: unknown[]) => upsertDayPlan(...a),
}))
vi.mock('@/lib/supabase/helpers', () => ({
  supabaseFrom: () => ({ upsert: (...a: unknown[]) => upsert(...a) }),
}))

const props = { userId: 'user-1', currentName: 'Patrick' }

beforeEach(() => {
  push.mockReset()
  fetchCityState.mockReset().mockResolvedValue({})
  createTask.mockReset().mockResolvedValue({ id: 'task-1', title: 'Pay the open bill' })
  updateTask.mockReset().mockResolvedValue({})
  fetchDayPlan.mockReset().mockResolvedValue(null)
  upsertDayPlan.mockReset().mockResolvedValue({})
  upsert.mockReset().mockReturnValue({
    select: () => Promise.resolve({ data: [{ id: 'user-1' }], error: null }),
  })
  window.sessionStorage.clear()
})

afterEach(cleanup)

function continueButton() {
  return screen.getByRole('button', { name: /continue|save task|plan it and finish/i })
}

async function reachTaskStep() {
  fireEvent.click(screen.getByRole('button', { name: 'Home and life admin' }))
  fireEvent.click(continueButton())
  await screen.findByLabelText('Your first task')
}

describe('OnboardingFlow', () => {
  it('has three steps and asks no age question', () => {
    render(<OnboardingFlow {...props} />)

    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
    expect(screen.queryByText(/how old are you/i)).toBeNull()
    expect(screen.queryByLabelText(/age/i)).toBeNull()
  })

  it('carries the existing name over and keeps the timezone change unobtrusive', () => {
    render(<OnboardingFlow {...props} />)

    expect(screen.getByText(/Hi Patrick\./)).toBeTruthy()
    expect(screen.queryByLabelText('Timezone')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Change timezone' }))
    expect(screen.getByLabelText('Timezone')).toBeTruthy()
  })

  it('suggests first tasks that fit the chosen focus', async () => {
    render(<OnboardingFlow {...props} />)
    await reachTaskStep()

    fireEvent.click(screen.getByRole('button', { name: 'Pay the open bill' }))
    expect((screen.getByLabelText('Your first task') as HTMLInputElement).value).toBe(
      'Pay the open bill'
    )
  })

  it('saves a real task due today, plans it, and finishes without a template choice', async () => {
    render(<OnboardingFlow {...props} />)
    await reachTaskStep()

    fireEvent.change(screen.getByLabelText('Your first task'), {
      target: { value: 'Pay the open bill' },
    })
    fireEvent.click(continueButton())

    await screen.findByLabelText('Start')
    expect(createTask).toHaveBeenCalledWith(
      { client: true },
      'user-1',
      expect.objectContaining({ title: 'Pay the open bill', priority: 'high' })
    )
    expect(createTask.mock.calls[0][2].due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '15:00' } })
    fireEvent.click(screen.getByRole('button', { name: '45 min' }))
    fireEvent.click(continueButton())

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard?welcome=1'))
    const plan = upsertDayPlan.mock.calls[0][2]
    expect(plan.blocks).toEqual([
      expect.objectContaining({
        id: 'onboarding-task-1',
        start_time: '15:00',
        end_time: '15:45',
        source_type: 'task',
        source_id: 'task-1',
        mission_type: 'main_quest',
      }),
    ])
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        username: 'Patrick',
        onboarding_complete: true,
      }),
      { onConflict: 'id' }
    )
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('birth_year')
  })

  it('reuses the saved task after going back, instead of creating a second one', async () => {
    render(<OnboardingFlow {...props} />)
    await reachTaskStep()

    fireEvent.change(screen.getByLabelText('Your first task'), {
      target: { value: 'Pay the open bill' },
    })
    fireEvent.click(continueButton())
    await screen.findByLabelText('Start')

    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    fireEvent.change(await screen.findByLabelText('Your first task'), {
      target: { value: 'Pay the electricity bill' },
    })
    fireEvent.click(continueButton())
    await screen.findByLabelText('Start')

    expect(createTask).toHaveBeenCalledTimes(1)
    expect(updateTask).toHaveBeenCalledWith(
      { client: true },
      'task-1',
      expect.objectContaining({ title: 'Pay the electricity bill' })
    )
  })

  it('picks the saved task back up after a reload', async () => {
    window.sessionStorage.setItem(
      'lifequest:onboarding:user-1',
      JSON.stringify({ taskId: 'task-9', title: 'Sort the mail' })
    )
    render(<OnboardingFlow {...props} />)
    fireEvent.click(continueButton())

    const field = (await screen.findByLabelText('Your first task')) as HTMLInputElement
    await waitFor(() => expect(field.value).toBe('Sort the mail'))
    fireEvent.click(continueButton())
    await screen.findByLabelText('Start')

    expect(createTask).not.toHaveBeenCalled()
  })

  it('creates only one task when Save task is pressed twice quickly', async () => {
    let resolve: (value: unknown) => void = () => undefined
    createTask.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<OnboardingFlow {...props} />)
    await reachTaskStep()

    fireEvent.change(screen.getByLabelText('Your first task'), { target: { value: 'One task' } })
    const button = continueButton()
    fireEvent.click(button)
    fireEvent.click(button)
    resolve({ id: 'task-1', title: 'One task' })

    await screen.findByLabelText('Start')
    expect(createTask).toHaveBeenCalledTimes(1)
  })

  it('keeps the typed task and says so at the field when saving fails', async () => {
    createTask.mockRejectedValue(new Error('offline'))
    render(<OnboardingFlow {...props} />)
    await reachTaskStep()

    fireEvent.change(screen.getByLabelText('Your first task'), { target: { value: 'Keep me' } })
    fireEvent.click(continueButton())

    expect((await screen.findByRole('alert')).textContent).toMatch(/not saved/i)
    expect((screen.getByLabelText('Your first task') as HTMLInputElement).value).toBe('Keep me')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('does not mark onboarding complete when the plan cannot be saved', async () => {
    upsertDayPlan.mockRejectedValue(new Error('offline'))
    render(<OnboardingFlow {...props} />)
    await reachTaskStep()
    fireEvent.change(screen.getByLabelText('Your first task'), { target: { value: 'A task' } })
    fireEvent.click(continueButton())
    await screen.findByLabelText('Start')

    fireEvent.click(continueButton())

    expect((await screen.findByRole('alert')).textContent).toMatch(/plan was not saved/i)
    expect(upsert).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('asks for a name when none is known yet', () => {
    render(<OnboardingFlow userId="user-1" currentName="" />)
    fireEvent.click(continueButton())

    expect(screen.getByText('Add the name we should greet you with.')).toBeTruthy()
    expect(screen.getByText('Step 1 of 3')).toBeTruthy()
  })
})

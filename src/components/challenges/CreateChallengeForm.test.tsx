import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
const push = vi.fn()
const rpc = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }))

const { CreateChallengeForm } = await import('@/components/challenges/CreateChallengeForm')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function openForm() {
  render(<CreateChallengeForm />)
  fireEvent.click(screen.getByRole('button', { name: /create your own challenge/i }))
}

describe('CreateChallengeForm', () => {
  it('creates the challenge and opens it', async () => {
    rpc.mockResolvedValue({ data: [{ template_id: 'tpl-1', enrollment_id: 'enr-1' }], error: null })
    openForm()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No sugar' } })
    fireEvent.change(screen.getByLabelText(/every day i will/i), { target: { value: 'Skip sugar' } })
    fireEvent.click(screen.getByRole('button', { name: '14' }))
    fireEvent.click(screen.getByLabelText(/start over/i))
    expect(screen.getByText('140 XP')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /start today/i }))

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('create_personal_challenge', {
        p_title: 'No sugar',
        p_task: 'Skip sugar',
        p_days: 14,
        p_description: null,
        p_schedule_mode: 'strict',
      })
    )
    await waitFor(() => expect(push).toHaveBeenCalledWith('/challenges/tpl-1'))
  })

  it('says what is missing instead of calling the server', () => {
    openForm()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No sugar' } })
    fireEvent.click(screen.getByRole('button', { name: /start today/i }))

    expect(screen.getByText('Describe what you will do each day.')).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('shows the server error when creating fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'You already have 10 personal challenges running. Finish or delete one first.' } })
    openForm()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'No sugar' } })
    fireEvent.change(screen.getByLabelText(/every day i will/i), { target: { value: 'Skip sugar' } })
    fireEvent.click(screen.getByRole('button', { name: /start today/i }))

    expect(await screen.findByText(/already have 10 personal challenges/)).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })
})

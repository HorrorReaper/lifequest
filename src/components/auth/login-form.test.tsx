import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from './login-form'

const push = vi.fn()
const refresh = vi.fn()
const signInWithPassword = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    },
  }),
}))

beforeEach(() => {
  push.mockReset()
  refresh.mockReset()
  signInWithPassword.mockReset()
})

afterEach(() => {
  cleanup()
})

async function submitSignIn() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'user@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'correct-horse-battery-staple' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
}

describe('LoginForm sign-in transition', () => {
  it('keeps the busy overlay up after a successful sign-in instead of resetting to idle', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    render(<LoginForm />)

    await submitSignIn()

    // router.push happens synchronously once the promise resolves, well before
    // the destination route actually paints (see auth-loading-overlay.tsx) — a
    // premature setLoading(false) here is exactly the bug being guarded against.
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))

    expect(screen.getByRole('status').textContent).toContain('Signing you in…')
    expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull()
    expect(
      (screen.getByRole('button', { name: /Working/ }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('clears loading and shows the error without navigating on failure', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    render(<LoginForm />)

    await submitSignIn()

    expect(await screen.findByText('Invalid login credentials')).toBeTruthy()

    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Sign In' }) as HTMLButtonElement).disabled
    ).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import { FullscreenFocusTimer } from './FullscreenFocusTimer'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  addXp: vi.fn(),
  rpc: vi.fn(),
}))

const activeSession: FocusSessionRow = {
  id: 'session-1',
  user_id: 'user',
  task_id: null,
  planned_minutes: 25,
  status: 'active',
  started_at: new Date().toISOString(),
  ended_at: null,
  actual_seconds: null,
  created_at: '',
  updated_at: '',
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}))

vi.mock('@/lib/stores/user-store', () => ({
  useUserStore: (selector: (state: { addXp: unknown }) => unknown) =>
    selector({ addXp: mocks.addXp }),
}))

vi.mock('@/lib/focus-quotes', () => ({ pickFocusQuote: () => 'Keep going.' }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: activeSession, error: null }),
    }
    return { from: () => builder, rpc: mocks.rpc }
  },
}))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.clearAllMocks()
  mocks.rpc.mockResolvedValue({ data: { awarded: false }, error: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function controls() {
  return screen.getByRole('button', { name: /complete/i })
    .parentElement as HTMLElement
}

async function renderTimer() {
  render(<FullscreenFocusTimer userId="user" />)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /complete/i })).toBeTruthy(),
  )
}

describe('FullscreenFocusTimer controls', () => {
  it('keeps the controls hidden until the screen is tapped', async () => {
    await renderTimer()
    expect(controls().className).toContain('pointer-events-none')
  })

  it('reveals the controls on a tap', async () => {
    await renderTimer()
    fireEvent.click(screen.getByText('Keep going.'))
    expect(controls().className).not.toContain('pointer-events-none')
  })

  it('keeps the controls up while the screen is still being tapped', async () => {
    // Tapping again is the natural thing to do while reaching for a button.
    // If that does not extend the window, the controls vanish mid-press.
    await renderTimer()
    fireEvent.click(screen.getByText('Keep going.'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    fireEvent.click(screen.getByText('Keep going.'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(controls().className).not.toContain('pointer-events-none')
  })
})

describe('FullscreenFocusTimer ending', () => {
  it('closes the session only once when Complete is pressed twice quickly', async () => {
    // Nothing disables the button while the write is in flight.
    await renderTimer()
    fireEvent.click(screen.getByText('Keep going.'))
    const complete = screen.getByRole('button', { name: /complete/i })
    fireEvent.click(complete)
    fireEvent.click(complete)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('finish_focus_session', {
      p_session_id: 'session-1',
      p_status: 'completed',
    })
  })

  it('returns Library users to the toolbox timer and updates their XP', async () => {
    mocks.rpc.mockResolvedValue({
      data: { awarded: true, xpAwarded: 25, previousTotal: 100, newTotal: 125 },
      error: null,
    })
    render(
      <FullscreenFocusTimer
        userId="user"
        returnHref="/learn/tools/focus-timer"
      />,
    )
    await waitFor(() => expect(screen.getByText('Keep going.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /complete/i }))
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/learn/tools/focus-timer'),
    )
    expect(mocks.addXp).toHaveBeenCalledWith(25, 100)
  })

  it('keeps a failed completion open for retry', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Offline' },
    })
    await renderTimer()
    fireEvent.click(screen.getByRole('button', { name: /complete/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'could not be closed',
      ),
    )
    expect(mocks.push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /complete/i }))
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/admin/productivity'),
    )
  })
})

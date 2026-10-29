import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { FocusTimerTool } from './FocusTimerTool'
import type { FocusSessionRow } from '@/lib/supabase/database.types'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rpc.mockResolvedValue({ data: { id: 'session' }, error: null })
})
afterEach(cleanup)

it('starts the selected duration through the server and prevents duplicate submission', async () => {
  render(<FocusTimerTool initialSession={null} />)
  fireEvent.click(screen.getByRole('button', { name: '50 min' }))
  const start = screen.getByRole('button', { name: 'Start focus session' })
  fireEvent.click(start)
  fireEvent.click(start)
  await waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith('/learn/tools/focus-timer/run'),
  )
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('start_focus_session', {
    p_planned_minutes: 50,
    p_task_id: null,
  })
})

it('resumes an existing session without starting another', () => {
  render(
    <FocusTimerTool
      initialSession={{ planned_minutes: 25 } as FocusSessionRow}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Resume session' }))
  expect(mocks.push).toHaveBeenCalledWith('/learn/tools/focus-timer/run')
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Custom duration')).toBeNull()
})

it('validates custom minutes and lets a failed start be retried', async () => {
  render(<FocusTimerTool initialSession={null} />)
  fireEvent.change(screen.getByLabelText('Custom duration'), {
    target: { value: '241' },
  })
  expect(
    (
      screen.getByRole('button', {
        name: 'Start focus session',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true)
  fireEvent.change(screen.getByLabelText('Custom duration'), {
    target: { value: '10' },
  })
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'Offline' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Start focus session' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'could not be started',
    ),
  )
  expect(mocks.push).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Start focus session' }))
  await waitFor(() => expect(mocks.push).toHaveBeenCalled())
})

it('does not offer a new session after a failed load', () => {
  render(<FocusTimerTool initialSession={null} loadFailed />)
  expect(
    screen.queryByRole('button', { name: 'Start focus session' }),
  ).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(mocks.refresh).toHaveBeenCalled()
})

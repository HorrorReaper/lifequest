import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWorkContext } from './context'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), showAdminUi: vi.fn(), maybeSingle: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`) },
  notFound: () => { throw new Error('not-found') },
}))
vi.mock('@/lib/admin', () => ({ showAdminUi: mocks.showAdminUi }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
}) }))

beforeEach(() => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mocks.showAdminUi.mockResolvedValue(true)
  mocks.maybeSingle.mockResolvedValue({ data: { timezone: 'Asia/Kathmandu' }, error: null })
})
afterEach(() => vi.useRealTimers())

describe('Work access and day context', () => {
  it('requires sign-in before loading work data', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    await expect(getWorkContext()).rejects.toThrow('redirect:/login')
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
  })
  it('rejects normal users and admin preview mode', async () => {
    mocks.showAdminUi.mockResolvedValue(false)
    await expect(getWorkContext()).rejects.toThrow('not-found')
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
  })
  it('uses the profile timezone for both the date and timeline clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T20:30:00Z'))
    const context = await getWorkContext()
    expect(context.today).toBe('2026-09-24')
    expect(context.nowMinutes).toBe(2 * 60 + 15)
  })
  it('does not replace failed profile reads with a potentially wrong date', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: 'offline' } })
    await expect(getWorkContext()).rejects.toThrow('could not be loaded')
  })
})

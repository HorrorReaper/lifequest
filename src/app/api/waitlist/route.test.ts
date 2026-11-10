import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { insert, rpc, createPublicRouteClient } = vi.hoisted(() => {
  const insert = vi.fn()
  const rpc = vi.fn()
  return {
    insert,
    rpc,
    createPublicRouteClient: vi.fn(() => ({ from: () => ({ insert }), rpc })),
  }
})

vi.mock('@/lib/supabase/public-route-client', () => ({ createPublicRouteClient }))

import { POST } from './route'

let ipCounter = 0

function signup(body: Record<string, unknown>) {
  return new NextRequest('https://lifequest.app/api/waitlist', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      'x-forwarded-for': `198.51.100.${++ipCounter}`,
    },
  })
}

describe('POST /api/waitlist landing event', () => {
  beforeEach(() => {
    insert.mockResolvedValue({ error: null })
    rpc.mockResolvedValue({ error: null })
  })

  it('records a waitlist_signup landing event without the address', async () => {
    const response = await POST(signup({ email: 'Someone@Example.com', source: 'hero' }))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('record_landing_event')
    expect(args).toMatchObject({ p_event: 'waitlist_signup', p_device: 'mobile', p_cta: 'hero' })
    expect(JSON.stringify(args)).not.toContain('example.com')
  })

  it('does not record one for a duplicate address', async () => {
    insert.mockResolvedValue({ error: { code: '23505' } })
    const response = await POST(signup({ email: 'dup@example.com' }))
    expect(response.status).toBe(409)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('still confirms the signup when the landing event fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rpc.mockResolvedValue({ error: { message: 'function does not exist' } })
    const response = await POST(signup({ email: 'ok@example.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})

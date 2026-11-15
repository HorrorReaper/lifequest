import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { state, sendPush, vapidConfig, createClient } = vi.hoisted(() => {
  const state = {
    rows: [] as Array<{ user_id: string; template_id: string; endpoint: string; p256dh: string; auth: string }>,
    claimError: null as unknown,
    rpcArgs: [] as unknown[],
    deleted: [] as string[][],
    updated: [] as string[][],
  }
  const client = {
    rpc: async (name: string, args: unknown) => {
      state.rpcArgs.push([name, args])
      return { data: state.rows, error: state.claimError }
    },
    from: () => ({
      delete: () => ({
        in: async (_: string, endpoints: string[]) => {
          state.deleted.push(endpoints)
          return { error: null }
        },
      }),
      update: () => ({
        in: async (_: string, endpoints: string[]) => {
          state.updated.push(endpoints)
          return { error: null }
        },
      }),
    }),
  }
  return { state, sendPush: vi.fn(), vapidConfig: vi.fn(), createClient: vi.fn(() => client) }
})

vi.mock('@/lib/push-server', () => ({ sendPush, vapidConfig }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { GET, POST } from './route'

const config = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ops@example.com' }
const row = (user: string, n: number) => ({
  user_id: user,
  template_id: 'tpl-1',
  endpoint: `https://push.example/${n}`,
  p256dh: 'p',
  auth: 'a',
})
const call = (method: 'GET' | 'POST', authorization?: string) => {
  const request = new Request('https://lifequest.app/api/push/evening-review', {
    method,
    headers: authorization ? { authorization } : {},
  })
  return method === 'GET' ? GET(request) : POST(request)
}

describe('/api/push/evening-review', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'service-key')
    vapidConfig.mockReturnValue(config)
    state.rows = []
    state.claimError = null
    state.rpcArgs = []
    state.deleted = []
    state.updated = []
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses a call without the cron secret', async () => {
    expect((await call('POST')).status).toBe(401)
    expect((await call('POST', 'Bearer wrong')).status).toBe(401)
    expect(state.rpcArgs).toEqual([])
  })

  it('answers 503 while CRON_SECRET, VAPID or the Supabase secret key is missing', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call('POST', 'Bearer ')).status).toBe(503)
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vapidConfig.mockReturnValue(null)
    expect((await call('POST', 'Bearer cron-secret')).status).toBe(503)
    vapidConfig.mockReturnValue(config)
    vi.stubEnv('SUPABASE_SECRET_KEY', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect((await call('POST', 'Bearer cron-secret')).status).toBe(503)
  })

  it('claims due reminders and sends each device the evening review payload', async () => {
    state.rows = [row('u1', 1), row('u1', 2), row('u2', 3)]
    sendPush.mockResolvedValue([
      { endpoint: 'https://push.example/1', status: 'sent' },
      { endpoint: 'https://push.example/2', status: 'gone' },
      { endpoint: 'https://push.example/3', status: 'sent' },
    ])

    const response = await call('POST', 'Bearer cron-secret')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ users: 2, sent: 2, removed: 1, failed: 0 })
    expect(state.rpcArgs).toEqual([['claim_evening_review_reminders', { p_grace_minutes: 120 }]])

    const [, devices, payload] = sendPush.mock.calls[0]
    expect(devices).toHaveLength(3)
    expect(payload).toMatchObject({ url: '/journal/new/tpl-1', tag: 'evening-review' })
    expect(state.deleted).toEqual([['https://push.example/2']])
    expect(state.updated).toEqual([['https://push.example/1', 'https://push.example/3']])
  })

  it('accepts a GET, as Vercel Cron sends, and does nothing when nobody is due', async () => {
    const response = await call('GET', 'Bearer cron-secret')
    expect(await response.json()).toEqual({ users: 0, sent: 0, removed: 0, failed: 0 })
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('answers 500 when the claim fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.claimError = { message: 'function does not exist' }
    expect((await call('POST', 'Bearer cron-secret')).status).toBe(500)
  })
})

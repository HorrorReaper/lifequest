import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { user_id: string; template_id?: string; endpoint: string; p256dh: string; auth: string }

const { state, sendPush, vapidConfig, createClient } = vi.hoisted(() => {
  const state = {
    rows: {} as Record<string, Row[]>,
    claimErrors: {} as Record<string, unknown>,
    rpcArgs: [] as unknown[],
    deleted: [] as string[][],
    updated: [] as string[][],
  }
  const client = {
    rpc: async (name: string, args: unknown) => {
      state.rpcArgs.push([name, args])
      return { data: state.rows[name] ?? [], error: state.claimErrors[name] ?? null }
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
import * as legacy from '../evening-review/route'

const config = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ops@example.com' }
const evening = (user: string, n: number): Row => ({
  user_id: user,
  template_id: 'tpl-1',
  endpoint: `https://push.example/${n}`,
  p256dh: 'p',
  auth: 'a',
})
const morning = (user: string, n: number): Row => ({
  user_id: user,
  endpoint: `https://push.example/${n}`,
  p256dh: 'p',
  auth: 'a',
})
const call = (method: 'GET' | 'POST', authorization?: string) => {
  const request = new Request('https://lifequest.app/api/push/reminders', {
    method,
    headers: authorization ? { authorization } : {},
  })
  return method === 'GET' ? GET(request) : POST(request)
}

describe('/api/push/reminders', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'service-key')
    vapidConfig.mockReturnValue(config)
    sendPush.mockReset()
    state.rows = {}
    state.claimErrors = {}
    state.rpcArgs = []
    state.deleted = []
    state.updated = []
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
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

  it('claims both reminders and sends each device its own payload', async () => {
    state.rows = {
      claim_daily_plan_reminders: [morning('u3', 4)],
      claim_evening_review_reminders: [evening('u1', 1), evening('u1', 2), evening('u2', 3)],
    }
    sendPush.mockImplementation(async (_config: unknown, devices: Row[]) =>
      devices.map((device) => ({
        endpoint: device.endpoint,
        status: device.endpoint.endsWith('/2') ? 'gone' : 'sent',
      }))
    )

    const response = await call('POST', 'Bearer cron-secret')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ users: 3, sent: 3, removed: 1, failed: 0 })
    expect(state.rpcArgs).toEqual([
      ['claim_daily_plan_reminders', { p_grace_minutes: 120 }],
      ['claim_evening_review_reminders', { p_grace_minutes: 120 }],
    ])

    const payloadFor = (endpoint: string) =>
      sendPush.mock.calls.find(([, devices]) => (devices as Row[]).some((device) => device.endpoint === endpoint))?.[2]
    expect(payloadFor('https://push.example/4')).toMatchObject({ url: '/plan', tag: 'daily-plan' })
    expect(payloadFor('https://push.example/1')).toMatchObject({ url: '/journal/new/tpl-1', tag: 'evening-review' })
    expect(state.deleted).toEqual([['https://push.example/2']])
    expect(state.updated).toEqual([['https://push.example/4', 'https://push.example/1', 'https://push.example/3']])
  })

  it('accepts a GET, as Vercel Cron sends, and does nothing when nobody is due', async () => {
    const response = await call('GET', 'Bearer cron-secret')
    expect(await response.json()).toEqual({ users: 0, sent: 0, removed: 0, failed: 0 })
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('still sends what one claim returned when the other fails, then answers 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.claimErrors = { claim_daily_plan_reminders: { message: 'function does not exist' } }
    state.rows = { claim_evening_review_reminders: [evening('u1', 1)] }
    sendPush.mockResolvedValue([{ endpoint: 'https://push.example/1', status: 'sent' }])

    const response = await call('POST', 'Bearer cron-secret')
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ users: 1, sent: 1 })
    expect(sendPush).toHaveBeenCalledTimes(1)
  })

  it('keeps answering on the address the scheduler was first set up with', () => {
    expect(legacy.POST).toBe(POST)
    expect(legacy.GET).toBe(GET)
  })
})

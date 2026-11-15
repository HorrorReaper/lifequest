import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, sendPush, vapidConfig } = vi.hoisted(() => ({
  state: {
    user: { id: 'user-1' } as { id: string } | null,
    rows: [] as Array<{ endpoint: string; p256dh: string; auth: string }>,
    selectError: null as unknown,
    deleted: [] as string[][],
    updated: [] as string[][],
  },
  sendPush: vi.fn(),
  vapidConfig: vi.fn(),
}))

vi.mock('@/lib/push-server', () => ({ sendPush, vapidConfig }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: async () => ({ data: state.rows, error: state.selectError }),
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
  }),
}))

import { POST } from './route'

const config = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ops@example.com' }
const row = (n: number) => ({ endpoint: `https://push.example/${n}`, p256dh: 'p', auth: 'a' })
const post = (headers: Record<string, string> = {}) =>
  POST(new Request('https://lifequest.app/api/push/test', { method: 'POST', headers }))

describe('POST /api/push/test', () => {
  beforeEach(() => {
    state.user = { id: 'user-1' }
    state.rows = [row(1)]
    state.selectError = null
    state.deleted = []
    state.updated = []
    vapidConfig.mockReturnValue(config)
    sendPush.mockResolvedValue([{ endpoint: 'https://push.example/1', status: 'sent' }])
  })

  it('needs a signed-in user', async () => {
    state.user = null
    expect((await post()).status).toBe(401)
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('refuses a request from another origin', async () => {
    expect((await post({ origin: 'https://evil.example' })).status).toBe(403)
  })

  it('answers 503 while VAPID keys are not configured', async () => {
    vapidConfig.mockReturnValue(null)
    expect((await post()).status).toBe(503)
  })

  it('answers 409 when the user has no device opted in', async () => {
    state.rows = []
    expect((await post()).status).toBe(409)
  })

  it('sends to each device, removes dropped ones and marks the rest sent', async () => {
    state.rows = [row(1), row(2)]
    sendPush.mockResolvedValue([
      { endpoint: 'https://push.example/1', status: 'sent' },
      { endpoint: 'https://push.example/2', status: 'gone' },
    ])

    const response = await post()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: 1, removed: 1 })
    expect(sendPush.mock.calls[0][2]).toMatchObject({ url: '/dashboard', tag: 'test' })
    expect(state.deleted).toEqual([['https://push.example/2']])
    expect(state.updated).toEqual([['https://push.example/1']])
  })

  it('answers 502 when no push was accepted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sendPush.mockResolvedValue([{ endpoint: 'https://push.example/1', status: 'failed', statusCode: 500 }])
    expect((await post()).status).toBe(502)
  })
})

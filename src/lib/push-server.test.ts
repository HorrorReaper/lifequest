import { afterEach, describe, expect, it, vi } from 'vitest'

const { sendNotification } = vi.hoisted(() => ({ sendNotification: vi.fn() }))
vi.mock('web-push', () => ({ default: { sendNotification } }))

import { sendPush, vapidConfig } from '@/lib/push-server'

const config = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ops@example.com' }
const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, p256dh: 'p', auth: 'a' })

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('vapidConfig', () => {
  it('is null until all three variables are set', () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv')
    vi.stubEnv('VAPID_SUBJECT', '')
    expect(vapidConfig()).toBeNull()
    vi.stubEnv('VAPID_SUBJECT', 'mailto:ops@example.com')
    expect(vapidConfig()).toEqual(config)
  })
})

describe('sendPush', () => {
  it('sends the payload as JSON with the VAPID details and a one-hour TTL', async () => {
    sendNotification.mockResolvedValue({ statusCode: 201 })
    const results = await sendPush(config, [sub(1)], { title: 'T', body: 'B', url: '/dashboard', tag: 'test' })

    expect(results).toEqual([{ endpoint: 'https://push.example/1', status: 'sent' }])
    const [target, body, options] = sendNotification.mock.calls[0]
    expect(target).toEqual({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } })
    expect(JSON.parse(body)).toEqual({ title: 'T', body: 'B', url: '/dashboard', tag: 'test' })
    expect(options).toMatchObject({
      TTL: 3600,
      topic: 'test',
      vapidDetails: { subject: 'mailto:ops@example.com', publicKey: 'pub', privateKey: 'priv' },
    })
  })

  it('reports dropped subscriptions as gone and other errors as failed, without throwing', async () => {
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('Rate limited'), { statusCode: 429 }))
      .mockResolvedValueOnce({ statusCode: 201 })

    const results = await sendPush(config, [sub(1), sub(2), sub(3)], { title: 'T', body: 'B', url: '/' })
    expect(results.map((result) => result.status)).toEqual(['gone', 'failed', 'sent'])
  })
})

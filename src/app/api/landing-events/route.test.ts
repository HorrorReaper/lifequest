import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, createPublicRouteClient } = vi.hoisted(() => {
  const rpc = vi.fn()
  return { rpc, createPublicRouteClient: vi.fn(() => ({ rpc })) }
})

vi.mock('@/lib/supabase/public-route-client', () => ({ createPublicRouteClient }))

import { POST } from './route'

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

let ipCounter = 0

function post(body: unknown, { ua = CHROME, ip, headers = {} }: { ua?: string; ip?: string; headers?: Record<string, string> } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new NextRequest('https://lifequest.app/api/landing-events', {
    method: 'POST',
    body: raw,
    headers: {
      'content-type': 'application/json',
      host: 'lifequest.app',
      'user-agent': ua,
      // A fresh address per request unless a test wants the same one, so the
      // module-level rate limiter does not leak between tests.
      'x-forwarded-for': ip ?? `203.0.113.${++ipCounter}`,
      ...headers,
    },
  })
}

describe('POST /api/landing-events', () => {
  beforeEach(() => {
    rpc.mockResolvedValue({ error: null })
  })

  it('records a page view with only a hash of the visitor, never the address or agent', async () => {
    const response = await POST(
      post(
        { event: 'pageview', path: '/', referrer: 'https://news.ycombinator.com/item?id=1', utm_source: 'HN' },
        { ua: IPHONE, ip: '198.51.100.7' }
      )
    )

    expect(response.status).toBe(204)
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('record_landing_event')
    expect(args).toMatchObject({
      p_event: 'pageview',
      p_path: '/',
      p_device: 'mobile',
      p_referrer_host: 'news.ycombinator.com',
      p_utm_source: 'hn',
      p_cta: null,
    })
    expect(args.p_fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(args)).not.toContain('198.51.100.7')
    expect(JSON.stringify(args)).not.toContain('iPhone')
  })

  it('records a CTA click with its placement', async () => {
    await POST(post({ event: 'cta_click', cta: 'sticky' }))
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_event: 'cta_click', p_cta: 'sticky', p_device: 'desktop' })
  })

  it('answers 400 to malformed JSON and to events it does not know', async () => {
    expect((await POST(post('{not json'))).status).toBe(400)
    expect((await POST(post({ event: 'waitlist_signup' }))).status).toBe(400)
    expect((await POST(post({ event: 'pageview', path: '/admin' }))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('answers 413 to a body over the size limit', async () => {
    const response = await POST(post({ event: 'pageview', utm_campaign: 'x'.repeat(3000) }))
    expect(response.status).toBe(413)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('drops bots and prefetches silently, with the same answer as a recorded event', async () => {
    const bot = await POST(post({ event: 'pageview' }, { ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' }))
    const prefetch = await POST(post({ event: 'pageview' }, { headers: { 'sec-purpose': 'prefetch' } }))
    expect(bot.status).toBe(204)
    expect(prefetch.status).toBe(204)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('stops recording one visitor after 40 events in ten minutes', async () => {
    for (let i = 0; i < 45; i++) {
      const response = await POST(post({ event: 'cta_click', cta: 'hero' }, { ip: '192.0.2.200' }))
      expect(response.status).toBe(204)
    }
    expect(rpc).toHaveBeenCalledTimes(40)
  })

  it('still answers 204 when the insert fails, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    rpc.mockResolvedValue({ error: { message: 'relation does not exist' } })
    expect((await POST(post({ event: 'pageview' }))).status).toBe(204)
    expect(log).toHaveBeenCalled()
  })

  it('answers 500 when Supabase is not configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createPublicRouteClient.mockReturnValueOnce(null as unknown as { rpc: typeof rpc })
    expect((await POST(post({ event: 'pageview' }))).status).toBe(500)
  })
})

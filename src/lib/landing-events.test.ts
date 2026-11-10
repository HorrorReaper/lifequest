import { describe, expect, it } from 'vitest'
import {
  cleanLabel,
  deviceBucket,
  looksLikeBot,
  normalizeLandingEvent,
  referrerHost,
  trackedPath,
} from '@/lib/landing-events'

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

describe('normalizeLandingEvent', () => {
  it('accepts a page view and keeps only the referrer host and cleaned UTM labels', () => {
    const result = normalizeLandingEvent(
      {
        event: 'pageview',
        path: '/?utm_source=x#top',
        referrer: 'https://www.Reddit.com/r/productivity/comments/abc?ref=1',
        utm_source: '  Newsletter ',
        utm_medium: 'Email',
        utm_campaign: 'Launch\u0000Week',
      },
      'lifequest.app'
    )
    expect(result).toEqual({
      ok: true,
      event: {
        event: 'pageview',
        path: '/',
        referrerHost: 'reddit.com',
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: 'launchweek',
        cta: null,
      },
    })
  })

  it('refuses bodies that are not objects, unknown events and server-only events', () => {
    expect(normalizeLandingEvent(null, null).ok).toBe(false)
    expect(normalizeLandingEvent([], null).ok).toBe(false)
    expect(normalizeLandingEvent({ event: 'purchase' }, null).ok).toBe(false)
    // Only /api/waitlist records signups; the browser cannot claim one.
    expect(normalizeLandingEvent({ event: 'waitlist_signup' }, null).ok).toBe(false)
  })

  it('refuses paths that are not tracked', () => {
    expect(normalizeLandingEvent({ event: 'pageview', path: '/dashboard' }, null)).toEqual({
      ok: false,
      error: 'Untracked path',
    })
  })

  it('needs a well-formed cta name on a click and ignores one on a page view', () => {
    expect(normalizeLandingEvent({ event: 'cta_click', cta: 'hero' }, null)).toMatchObject({
      ok: true,
      event: { cta: 'hero' },
    })
    expect(normalizeLandingEvent({ event: 'cta_click' }, null).ok).toBe(false)
    expect(normalizeLandingEvent({ event: 'cta_click', cta: 'Hero Button!' }, null).ok).toBe(false)
    expect(normalizeLandingEvent({ event: 'cta_click', cta: 'x'.repeat(41) }, null).ok).toBe(false)
    expect(normalizeLandingEvent({ event: 'pageview', cta: 'hero' }, null)).toMatchObject({
      event: { cta: null },
    })
  })

  it('cuts overlong labels instead of refusing the visit', () => {
    const result = normalizeLandingEvent({ event: 'pageview', utm_campaign: 'a'.repeat(500) }, null)
    expect(result.ok && result.event.utmCampaign).toHaveLength(100)
  })
})

describe('referrerHost', () => {
  it('drops the site itself, so moving within the page is not a source', () => {
    expect(referrerHost('https://lifequest.app/#pricing', 'lifequest.app')).toBeNull()
    expect(referrerHost('https://www.lifequest.app/', 'lifequest.app:443')).toBeNull()
  })

  it('drops anything that is not an http(s) URL', () => {
    expect(referrerHost('android-app://com.google.android.gm/', null)).toBeNull()
    expect(referrerHost('not a url', null)).toBeNull()
    expect(referrerHost(42, null)).toBeNull()
    expect(referrerHost('', null)).toBeNull()
  })
})

describe('trackedPath', () => {
  it('defaults to the landing page and strips query and fragment', () => {
    expect(trackedPath(undefined)).toBe('/')
    expect(trackedPath('/?a=1')).toBe('/')
    expect(trackedPath('https://evil.example/')).toBeNull()
  })
})

describe('cleanLabel', () => {
  it('returns null for empty or non-string values', () => {
    expect(cleanLabel('   ', 10)).toBeNull()
    expect(cleanLabel(5, 10)).toBeNull()
  })
})

describe('looksLikeBot', () => {
  it('lets a normal browser through', () => {
    expect(looksLikeBot(CHROME)).toBe(false)
  })

  it('catches crawlers, link previews, headless browsers, scripts and missing agents', () => {
    expect(looksLikeBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(looksLikeBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true)
    expect(looksLikeBot(CHROME.replace('Chrome', 'HeadlessChrome'))).toBe(true)
    expect(looksLikeBot('curl/8.4.0')).toBe(true)
    expect(looksLikeBot('python-requests/2.31.0 something long')).toBe(true)
    expect(looksLikeBot(null)).toBe(true)
    expect(looksLikeBot('')).toBe(true)
  })
})

describe('deviceBucket', () => {
  it('folds Next device types into four buckets', () => {
    expect(deviceBucket(undefined)).toBe('desktop')
    expect(deviceBucket('mobile')).toBe('mobile')
    expect(deviceBucket('tablet')).toBe('tablet')
    expect(deviceBucket('smarttv')).toBe('other')
  })
})

import { describe, expect, it } from 'vitest'
import {
  dailyPlanPayload,
  eveningReviewPayload,
  isGoneStatus,
  parsePushSubscription,
  safeNotificationPath,
  urlBase64ToUint8Array,
} from '@/lib/push-subscription'

const valid = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  expirationTime: null,
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
}

describe('parsePushSubscription', () => {
  it('reads a PushSubscription.toJSON() result', () => {
    expect(parsePushSubscription(valid)).toEqual({
      endpoint: valid.endpoint,
      p256dh: valid.keys.p256dh,
      auth: valid.keys.auth,
    })
  })

  it('refuses non-https endpoints, missing or malformed keys and oversized values', () => {
    expect(parsePushSubscription(null)).toBeNull()
    expect(parsePushSubscription({ ...valid, endpoint: 'http://push.example/1' })).toBeNull()
    expect(parsePushSubscription({ ...valid, endpoint: 'not a url' })).toBeNull()
    expect(parsePushSubscription({ ...valid, endpoint: `https://push.example/${'a'.repeat(1000)}` })).toBeNull()
    expect(parsePushSubscription({ endpoint: valid.endpoint })).toBeNull()
    expect(parsePushSubscription({ ...valid, keys: { ...valid.keys, auth: 'has spaces' } })).toBeNull()
    expect(parsePushSubscription({ ...valid, keys: { ...valid.keys, p256dh: '' } })).toBeNull()
  })
})

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url without padding', () => {
    // "hi?" is aGk_ in base64url.
    expect(Array.from(urlBase64ToUint8Array('aGk_'))).toEqual([104, 105, 63])
    expect(Array.from(urlBase64ToUint8Array('aGk'))).toEqual([104, 105])
  })
})

describe('safeNotificationPath', () => {
  it('keeps paths on this site and replaces anything else with the dashboard', () => {
    expect(safeNotificationPath('/journal/new/abc')).toBe('/journal/new/abc')
    expect(safeNotificationPath('https://evil.example/')).toBe('/dashboard')
    expect(safeNotificationPath('//evil.example/')).toBe('/dashboard')
    expect(safeNotificationPath('/\\evil.example')).toBe('/dashboard')
    expect(safeNotificationPath(undefined)).toBe('/dashboard')
  })
})

describe('isGoneStatus', () => {
  it('treats only 404 and 410 as a dropped subscription', () => {
    expect(isGoneStatus(404)).toBe(true)
    expect(isGoneStatus(410)).toBe(true)
    expect(isGoneStatus(429)).toBe(false)
    expect(isGoneStatus(undefined)).toBe(false)
  })
})

describe('eveningReviewPayload', () => {
  it('opens the evening review template and replaces an earlier reminder', () => {
    expect(eveningReviewPayload('tpl 1')).toMatchObject({ url: '/journal/new/tpl%201', tag: 'evening-review' })
  })
})

describe('dailyPlanPayload', () => {
  it('opens the planner and replaces an earlier morning reminder', () => {
    expect(dailyPlanPayload()).toMatchObject({ url: '/plan', tag: 'daily-plan' })
  })
})

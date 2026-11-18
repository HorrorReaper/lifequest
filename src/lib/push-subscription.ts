/**
 * Web push shapes shared by the browser (src/lib/push-client.ts), the
 * service worker contract (public/sw.js) and the server
 * (src/lib/push-server.ts). See docs/features/push-notifications.md.
 *
 * Free of browser- and server-only imports so both sides can use it.
 */

/** What a browser's PushSubscription.toJSON() carries that we store. */
export interface StoredPushSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

/** The JSON body of a push message, as public/sw.js reads it. */
export interface PushPayload {
  title: string
  body: string
  /** Same-origin path the notification opens, e.g. /journal/new/<id>. */
  url: string
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

/**
 * Reads a PushSubscription.toJSON() result, or null when it is not one.
 * The limits match the check constraints on push_subscriptions.
 */
export function parsePushSubscription(value: unknown): StoredPushSubscription | null {
  if (typeof value !== 'object' || value === null) return null
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: unknown }
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  if (typeof keys !== 'object' || keys === null) return null
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown }
  if (typeof p256dh !== 'string' || p256dh.length === 0 || p256dh.length > 200 || !BASE64URL.test(p256dh)) {
    return null
  }
  if (typeof auth !== 'string' || auth.length === 0 || auth.length > 100 || !BASE64URL.test(auth)) {
    return null
  }
  return { endpoint, p256dh, auth }
}

/** The VAPID public key (base64url) as the bytes pushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/**
 * Only a path on our own site may be opened from a notification. Anything
 * else (another origin, a protocol-relative URL) falls back to the dashboard.
 */
export function safeNotificationPath(path: unknown): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/dashboard'
  }
  return path.slice(0, 500)
}

/** A push service that answers 404 or 410 has dropped the subscription for good. */
export function isGoneStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410
}

/**
 * The scheduled reminders a device can switch on, named like the rituals
 * they remind about and like their push_subscriptions columns.
 */
export type ReminderKind = 'daily_plan' | 'evening_review'

/** The morning reminder. Opens today's planner. */
export function dailyPlanPayload(): PushPayload {
  return {
    title: 'Plan your day',
    body: 'A few minutes to choose what matters most today.',
    url: '/plan',
    tag: 'daily-plan',
  }
}

/** The evening reminder. Opens the evening review's journal template. */
export function eveningReviewPayload(templateId: string): PushPayload {
  return {
    title: 'Time for your evening review',
    body: 'A few minutes to look back on today and keep your streak going.',
    url: `/journal/new/${encodeURIComponent(templateId)}`,
    tag: 'evening-review',
  }
}

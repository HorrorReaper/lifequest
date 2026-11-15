import 'server-only'
import webpush from 'web-push'
import { isGoneStatus, type PushPayload, type StoredPushSubscription } from '@/lib/push-subscription'

/**
 * Sending web push with the server's VAPID key pair
 * (docs/features/push-notifications.md). The keys live in
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY (also needed by the browser to subscribe),
 * VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: or https: contact for the
 * push services).
 */
export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

/** The VAPID settings, or null while any of them is missing. */
export function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export type PushResult =
  | { endpoint: string; status: 'sent' }
  | { endpoint: string; status: 'gone' }
  | { endpoint: string; status: 'failed'; statusCode?: number }

/**
 * Sends one payload to each subscription. Never throws: a subscription the
 * push service has dropped (404/410) comes back as `gone`, so the caller can
 * delete it, and any other failure as `failed`.
 */
export async function sendPush(
  config: VapidConfig,
  subscriptions: StoredPushSubscription[],
  payload: PushPayload
): Promise<PushResult[]> {
  const body = JSON.stringify(payload)
  const options = {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    // A reminder that arrives the next morning is worse than none.
    TTL: 60 * 60,
    urgency: 'normal' as const,
    topic: payload.tag,
  }

  return Promise.all(
    subscriptions.map(async (subscription): Promise<PushResult> => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
          options
        )
        return { endpoint: subscription.endpoint, status: 'sent' }
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (isGoneStatus(statusCode)) return { endpoint: subscription.endpoint, status: 'gone' }
        return { endpoint: subscription.endpoint, status: 'failed', statusCode }
      }
    })
  )
}

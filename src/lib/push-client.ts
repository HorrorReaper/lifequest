import { createClient } from '@/lib/supabase/client'
import { parsePushSubscription, urlBase64ToUint8Array, type ReminderKind } from '@/lib/push-subscription'

/**
 * Browser side of web push (docs/features/push-notifications.md): service
 * worker registration, subscribing this device and storing it, and undoing
 * both. Used by src/components/settings/PushReminderCard.tsx.
 */

export type PushSupport =
  | 'supported'
  /** The browser has no service worker, PushManager or Notification API. */
  | 'unsupported'
  /** iPhone/iPad Safari outside an installed home-screen app, where push is unavailable. */
  | 'ios-needs-install'

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (ios && !standalone) return 'ios-needs-install'
  return hasApis ? 'supported' : 'unsupported'
}

export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
}

/** This device's current subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  return existing ? existing.pushManager.getSubscription() : null
}

export type EnableResult = { ok: true } | { ok: false; reason: 'denied' | 'not-configured' | 'failed' }

export type ReminderSwitches = Record<ReminderKind, boolean>

const ALL_OFF: ReminderSwitches = { daily_plan: false, evening_review: false }

/**
 * Which reminders this device has on. Off for both while the browser has no
 * subscription or no permission, or the server has no row for it (another
 * account took the endpoint over since).
 */
export async function readReminders(): Promise<ReminderSwitches> {
  const subscription = await currentSubscription()
  if (!subscription || Notification.permission !== 'granted') return ALL_OFF
  const { data, error } = await createClient()
    .from('push_subscriptions')
    .select('daily_plan, evening_review')
    .eq('endpoint', subscription.endpoint)
    .maybeSingle()
  if (error || !data) return ALL_OFF
  const row = data as ReminderSwitches
  return { daily_plan: row.daily_plan === true, evening_review: row.evening_review === true }
}

/**
 * Turns one reminder on for this device. Asks for notification permission
 * (must run from a click), subscribes the device if it is not yet and stores
 * the subscription with that reminder added. A subscription that cannot be
 * stored is undone when this call created it, so a switch never shows "on"
 * for a device the server does not know.
 */
export async function enablePush(reminder: ReminderKind): Promise<EnableResult> {
  const key = vapidPublicKey()
  if (!key) return { ok: false, reason: 'not-configured' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  let subscription: PushSubscription | null = null
  let created = false
  try {
    const reg = await registration()
    await navigator.serviceWorker.ready
    subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      created = true
    }

    const stored = parsePushSubscription(subscription.toJSON())
    if (!stored) throw new Error('Unreadable push subscription')

    const { error } = await createClient().rpc('save_push_subscription', {
      p_endpoint: stored.endpoint,
      p_p256dh: stored.p256dh,
      p_auth: stored.auth,
      p_reminder: reminder,
    } as never)
    if (error) throw error
    return { ok: true }
  } catch (error) {
    console.error('Enabling push failed', error)
    // A subscription the other reminder already uses stays.
    if (created) await subscription?.unsubscribe().catch(() => {})
    return { ok: false, reason: 'failed' }
  }
}

/**
 * Turns one reminder off for this device. While the other is still on only
 * its switch changes; turning off the last one removes the subscription from
 * the server and the browser, since a row needs at least one reminder on.
 */
export async function disableReminder(reminder: ReminderKind, otherStillOn: boolean): Promise<boolean> {
  if (!otherStillOn) return disablePush()
  try {
    const subscription = await currentSubscription()
    if (!subscription) return true
    const { error } = await createClient()
      .from('push_subscriptions')
      .update({ [reminder]: false } as never)
      .eq('endpoint', subscription.endpoint)
    if (error) throw error
    return true
  } catch (error) {
    console.error('Turning a reminder off failed', error)
    return false
  }
}

/** Removes this device's subscription from the server and the browser. */
export async function disablePush(): Promise<boolean> {
  try {
    const subscription = await currentSubscription()
    if (!subscription) return true
    const { error } = await createClient().from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    if (error) throw error
    await subscription.unsubscribe()
    return true
  } catch (error) {
    console.error('Disabling push failed', error)
    return false
  }
}

export async function sendTestPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch('/api/push/test', { method: 'POST' })
    if (response.ok) return { ok: true }
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: data?.error ?? 'Could not send the test notification.' }
  } catch {
    return { ok: false, error: 'Network error. Try again.' }
  }
}

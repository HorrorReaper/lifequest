import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPush, vapidConfig } from '@/lib/push-server'
import type { StoredPushSubscription } from '@/lib/push-subscription'

/**
 * "Send test notification" in Settings: one push to every device the
 * signed-in user has opted in (docs/features/push-notifications.md).
 * Reads and cleans up the user's own rows through RLS, with their session.
 */

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'Invalid request origin.' }, 403)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Sign in again to send a test notification.' }, 401)

  const config = vapidConfig()
  if (!config) {
    return json({ error: 'Push notifications are not configured on the server yet.' }, 503)
  }

  const { data, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (error) {
    console.error('Push test: could not read subscriptions', error)
    return json({ error: 'Could not load your devices. Try again.' }, 500)
  }

  const subscriptions = (data ?? []) as StoredPushSubscription[]
  if (subscriptions.length === 0) {
    return json({ error: 'Turn on reminders on this device first.' }, 409)
  }

  const results = await sendPush(config, subscriptions, {
    title: 'LifeQuest',
    body: 'Notifications work. Your evening review reminder will look like this.',
    url: '/dashboard',
    tag: 'test',
  })

  const gone = results.filter((result) => result.status === 'gone').map((result) => result.endpoint)
  const sent = results.filter((result) => result.status === 'sent').map((result) => result.endpoint)
  const failed = results.filter((result) => result.status === 'failed')

  if (gone.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', gone)
  }
  if (sent.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ last_sent_at: new Date().toISOString() } as never)
      .in('endpoint', sent)
  }
  if (failed.length > 0) console.error('Push test: some sends failed', failed)

  if (sent.length === 0) {
    return json({ error: 'The push service did not accept the notification. Turn reminders off and on again.' }, 502)
  }
  return json({ sent: sent.length, removed: gone.length })
}

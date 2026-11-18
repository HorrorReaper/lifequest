import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendPush, vapidConfig, type PushResult } from '@/lib/push-server'
import {
  dailyPlanPayload,
  eveningReviewPayload,
  type PushPayload,
  type StoredPushSubscription,
} from '@/lib/push-subscription'

/**
 * The scheduled reminders (docs/features/push-notifications.md): the daily
 * plan in the morning and the evening review at night. Called every 15
 * minutes by a scheduler with `Authorization: Bearer <CRON_SECRET>`:
 * Supabase pg_cron posts, Vercel Cron would send a GET, so both are
 * accepted. Listed in publicRoutes in src/lib/supabase/middleware.ts, since
 * the caller has no user session; the secret is the only way in.
 *
 * Each claim_* function picks who is due and records them in one statement,
 * so a reminder that fails to send is not retried that day. That is
 * deliberate: a late or doubled reminder is worse than a missed one. For the
 * same reason, whatever one claim returned is sent even when the other
 * claim failed.
 */

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

function authorized(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

interface ClaimRow extends StoredPushSubscription {
  user_id: string
  template_id?: string
}

/** One batch of devices that all get the same payload. */
interface Batch {
  devices: ClaimRow[]
  payload: PushPayload
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return json({ error: 'CRON_SECRET is not set.' }, 503)
  if (!authorized(request, secret)) return json({ error: 'Unauthorized' }, 401)

  const config = vapidConfig()
  const supabase = serviceClient()
  if (!config || !supabase) {
    return json({ error: 'Push or the Supabase secret key is not configured.' }, 503)
  }

  const [morning, evening] = await Promise.all([
    supabase.rpc('claim_daily_plan_reminders', { p_grace_minutes: 120 }),
    supabase.rpc('claim_evening_review_reminders', { p_grace_minutes: 120 }),
  ])
  if (morning.error) console.error('Daily plan push: claim failed', morning.error)
  if (evening.error) console.error('Evening review push: claim failed', evening.error)

  const morningRows = (morning.error ? [] : (morning.data ?? [])) as ClaimRow[]
  const eveningRows = (evening.error ? [] : (evening.data ?? [])) as ClaimRow[]

  const batches: Batch[] = []
  if (morningRows.length > 0) batches.push({ devices: morningRows, payload: dailyPlanPayload() })
  // Each device gets the payload of its own user's template; the template is
  // global today, but nothing here should rely on that.
  const byTemplate = new Map<string, ClaimRow[]>()
  for (const row of eveningRows) {
    const templateId = row.template_id ?? ''
    byTemplate.set(templateId, [...(byTemplate.get(templateId) ?? []), row])
  }
  for (const [templateId, devices] of byTemplate) {
    batches.push({ devices, payload: eveningReviewPayload(templateId) })
  }

  const results: PushResult[] = (
    await Promise.all(batches.map((batch) => sendPush(config, batch.devices, batch.payload)))
  ).flat()

  const gone = results.filter((result) => result.status === 'gone').map((result) => result.endpoint)
  const sent = results.filter((result) => result.status === 'sent').map((result) => result.endpoint)
  const failed = results.filter((result) => result.status === 'failed')

  if (gone.length > 0) await supabase.from('push_subscriptions').delete().in('endpoint', gone)
  if (sent.length > 0) {
    await supabase.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).in('endpoint', sent)
  }
  if (failed.length > 0) console.error('Reminder push: some sends failed', failed)

  const summary = {
    users: new Set([...morningRows, ...eveningRows].map((row) => row.user_id)).size,
    sent: sent.length,
    removed: gone.length,
    failed: failed.length,
  }
  if (morning.error || evening.error) {
    return json({ error: 'Could not load due reminders.', ...summary }, 500)
  }
  return json(summary)
}

export const GET = run
export const POST = run

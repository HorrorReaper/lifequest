import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { MAX_LANDING_EVENT_BYTES, normalizeLandingEvent } from '@/lib/landing-events'
import {
  createRateLimiter,
  isNonHumanRequest,
  recordLandingEvent,
  requestDevice,
  requestFingerprint,
} from '@/lib/landing-events-server'
import { createPublicRouteClient } from '@/lib/supabase/public-route-client'

/**
 * Page views and CTA clicks from the landing page
 * (docs/features/landing-traffic.md). Public, like /api/waitlist: listed in
 * publicRoutes in src/lib/supabase/middleware.ts.
 *
 * Answers 204 to everything it accepts and to everything it drops on
 * purpose (bots, prefetches, too many events), so a client cannot tell the
 * two apart and adjust. Only a malformed request gets an error back.
 */

// One page view and a handful of clicks per visit is normal; 40 in ten
// minutes from one address and browser is not a person reading the page.
const limited = createRateLimiter(10 * 60 * 1000, 40)

const noContent = () =>
  new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })

const failure = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_LANDING_EVENT_BYTES) return failure('Payload too large', 413)

  const raw = await request.text()
  if (Buffer.byteLength(raw) > MAX_LANDING_EVENT_BYTES) return failure('Payload too large', 413)

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return failure('Invalid request', 400)
  }

  const result = normalizeLandingEvent(body, request.headers.get('host'))
  if (!result.ok) return failure(result.error, 400)

  if (isNonHumanRequest(request)) return noContent()

  const fingerprint = requestFingerprint(request)
  if (limited(fingerprint)) return noContent()

  const supabase = createPublicRouteClient()
  if (!supabase) {
    console.error('Landing events: Supabase environment variables are missing')
    return failure('Server error', 500)
  }

  const { error } = await recordLandingEvent(supabase as unknown as SupabaseClient, {
    ...result.event,
    fingerprint,
    device: requestDevice(request),
  })

  if (error) {
    // Logged and swallowed: a lost page view is not the visitor's problem,
    // and the tracker does not retry.
    console.error('Landing event insert failed', error)
  }

  return noContent()
}

import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { userAgent, type NextRequest } from 'next/server'
import {
  deviceBucket,
  looksLikeBot,
  type LandingDevice,
  type LandingEventName,
} from '@/lib/landing-events'

/** The client IP as the platform reports it. Used for hashing and rate limiting only. */
export function requestIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

/**
 * sha256 of "IP|user agent". This is all that leaves the route; the raw
 * values are never sent to the database. record_landing_event hashes it once
 * more with a salt that lives for one UTC day
 * (supabase/migrations/20261110120000_landing_page_traffic.sql).
 */
export function requestFingerprint(request: NextRequest) {
  const agent = request.headers.get('user-agent') ?? ''
  return createHash('sha256').update(`${requestIp(request)}|${agent}`).digest('hex')
}

/** Bots and prefetches, which are not visits. */
export function isNonHumanRequest(request: NextRequest) {
  const purpose = request.headers.get('sec-purpose') ?? request.headers.get('purpose') ?? ''
  if (/prefetch|prerender/i.test(purpose)) return true
  if (userAgent(request).isBot) return true
  return looksLikeBot(request.headers.get('user-agent'))
}

export function requestDevice(request: NextRequest): LandingDevice {
  return deviceBucket(userAgent(request).device.type)
}

export interface RecordLandingEventInput {
  event: LandingEventName
  fingerprint: string
  device: LandingDevice
  path?: string
  referrerHost?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  cta?: string | null
}

export function recordLandingEvent(supabase: SupabaseClient, input: RecordLandingEventInput) {
  return supabase.rpc('record_landing_event', {
    p_event: input.event,
    p_fingerprint: input.fingerprint,
    p_device: input.device,
    p_path: input.path ?? '/',
    p_referrer_host: input.referrerHost ?? null,
    p_utm_source: input.utmSource ?? null,
    p_utm_medium: input.utmMedium ?? null,
    p_utm_campaign: input.utmCampaign ?? null,
    p_cta: input.cta ?? null,
  })
}

/**
 * A small sliding-window limiter held in one serverless instance's memory,
 * like the waitlist route's. It keeps one runaway tab or a simple loop from
 * filling the table; it does not stop a determined client.
 */
export function createRateLimiter(windowMs: number, maxPerWindow: number) {
  const seen = new Map<string, number[]>()

  return function limited(key: string, now = Date.now()) {
    const recent = (seen.get(key) ?? []).filter((at) => now - at < windowMs)
    recent.push(now)
    seen.set(key, recent)

    if (seen.size > 5000) {
      for (const [entry, times] of seen) {
        if (times.every((at) => now - at >= windowMs)) seen.delete(entry)
      }
    }

    return recent.length > maxPerWindow
  }
}

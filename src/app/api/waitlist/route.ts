import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseInsert } from '@/lib/supabase/helpers'
import { createPublicRouteClient } from '@/lib/supabase/public-route-client'
import { recordLandingEvent, requestDevice, requestFingerprint } from '@/lib/landing-events-server'

/**
 * Every signup lands here rather than going straight at the table from the
 * browser, so the honeypot, the address check and the rate limit below cannot
 * be skipped by posting at Supabase directly. The client
 * (createPublicRouteClient) prefers SUPABASE_SERVICE_ROLE_KEY, which is what
 * allows waitlist_signups to refuse anonymous inserts in RLS.
 */

/**
 * Deliberately modest: this lives in one serverless instance's memory, so it
 * slows a naive loop from a single address rather than stopping a determined
 * one. The guards that actually hold are the unique index on email and, once
 * the service role key is set, RLS.
 */
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const seen = new Map<string, number[]>()

function rateLimited(ip: string) {
  const now = Date.now()
  const recent = (seen.get(ip) ?? []).filter((at) => now - at < WINDOW_MS)
  recent.push(now)
  seen.set(ip, recent)

  // Without this the map holds every address the instance has ever answered.
  if (seen.size > 5000) {
    for (const [key, times] of seen) {
      if (times.every((at) => now - at >= WINDOW_MS)) seen.delete(key)
    }
  }

  return recent.length > MAX_PER_WINDOW
}

/**
 * Sent through Resend's REST API rather than its SDK: one transactional mail
 * does not need a dependency, and another provider is a matter of editing
 * this one function.
 *
 * Silent when the keys are unset, so the waitlist collects addresses from the
 * moment this ships and starts confirming them when a provider is chosen.
 */
async function sendConfirmation(email: string, name: string | null) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.WAITLIST_FROM_EMAIL
  if (!apiKey || !from) return

  const greeting = name ? `Hi ${name},` : 'Hi,'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "You're on the LifeQuest waitlist",
      text: [
        greeting,
        '',
        "You're on the list. I'll email you the moment LifeQuest opens up — and nothing else in the meantime.",
        '',
        'Patrick',
        'Founder of LifeQuest',
        '',
        'Signed up by mistake? Reply to this email and I will take you off the list.',
      ].join('\n'),
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`)
  }
}

/** A trimmed string of at most `max` characters, or null if nothing is left. */
function text(value: unknown, max: number) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
  }

  // The honeypot answers as though it worked. A bot told it failed will try
  // again with the field left out.
  if (body.hp) return NextResponse.json({ ok: true })

  const email = text(body.email, 320)?.toLowerCase() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid email address.' },
      { status: 400 }
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429 }
    )
  }

  const supabase = createPublicRouteClient()
  if (!supabase) {
    console.error('Waitlist: Supabase environment variables are missing')
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }

  const { error } = await supabaseInsert(supabase, 'waitlist_signups', {
    email,
    name: text(body.name, 120),
    source: text(body.source, 60) ?? 'marketing',
    interested_pro: body.interested_pro === true,
    early_access: body.early_access === true,
    newsletter: body.newsletter === true,
  })

  if (error) {
    // The unique index on email. Being on the list already is not a failure,
    // and the modal says so in as many words.
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, duplicate: true, error: "You're already on the waitlist 🎉" },
        { status: 409 }
      )
    }

    console.error('Waitlist insert failed', error)
    return NextResponse.json({ ok: false, error: 'Something went wrong. Please try again.' }, {
      status: 500,
    })
  }

  // The signup as a step of the landing-page funnel. Hashed the same way as
  // the visitor's page views (docs/features/landing-traffic.md), so the admin
  // view can relate the two; no address or name goes with it.
  const { error: eventError } = await recordLandingEvent(supabase as unknown as SupabaseClient, {
    event: 'waitlist_signup',
    fingerprint: requestFingerprint(request),
    device: requestDevice(request),
    cta: text(body.source, 40)?.toLowerCase().replace(/[^a-z0-9_-]/g, '') || null,
  })
  if (eventError) console.error('Waitlist: landing event failed', eventError)

  // The address is saved by this point. An outage at the mail provider must
  // not tell the visitor otherwise, so this is logged and swallowed.
  try {
    await sendConfirmation(email, text(body.name, 120))
  } catch (sendError) {
    console.error('Waitlist confirmation email failed', sendError)
  }

  return NextResponse.json({ ok: true })
}

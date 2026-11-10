/**
 * The shape of a landing-page traffic event and the rules that turn a
 * request body into one (docs/features/landing-traffic.md). Shared by the
 * browser tracker (src/lib/landing-tracker.ts), which builds the body, and
 * the route (src/app/api/landing-events/route.ts), which never trusts it.
 *
 * Kept free of server-only imports so both sides can use it.
 */

/** Events the browser may send. waitlist_signup is recorded by /api/waitlist itself. */
export const CLIENT_LANDING_EVENTS = ['pageview', 'cta_click'] as const
export type ClientLandingEvent = (typeof CLIENT_LANDING_EVENTS)[number]
export type LandingEventName = ClientLandingEvent | 'waitlist_signup'

/** Pages that are tracked. Anything else is refused. */
export const TRACKED_LANDING_PATHS = ['/'] as const

/** The largest body the route reads. A real event is a few hundred bytes. */
export const MAX_LANDING_EVENT_BYTES = 2048

export type LandingDevice = 'mobile' | 'tablet' | 'desktop' | 'other'

/** What the browser sends. Every field is optional except `event`. */
export interface LandingEventBody {
  event: ClientLandingEvent
  path?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  cta?: string
}

/** A validated event, ready for record_landing_event. */
export interface NormalizedLandingEvent {
  event: ClientLandingEvent
  path: string
  referrerHost: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  cta: string | null
}

const CTA_PATTERN = /^[a-z0-9_-]{1,40}$/
// Control characters and the like have no place in a label shown on a chart.
const CONTROL = /[\u0000-\u001f\u007f]/g

/** A trimmed, lower-cased label of at most `max` characters, or null. */
export function cleanLabel(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(CONTROL, '').trim().toLowerCase().slice(0, max).trim()
  return cleaned.length > 0 ? cleaned : null
}

function stripWww(host: string) {
  return host.startsWith('www.') ? host.slice(4) : host
}

/**
 * Only the host of the referring page, without "www.". Null for a missing or
 * unreadable referrer, for anything that is not http(s), and for the site's
 * own host -- moving within the page is not a source.
 */
export function referrerHost(referrer: unknown, ownHost: string | null): string | null {
  if (typeof referrer !== 'string' || referrer.length === 0 || referrer.length > 2000) return null
  let url: URL
  try {
    url = new URL(referrer)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = stripWww(url.hostname.toLowerCase())
  if (!host || host.length > 120) return null
  if (ownHost && host === stripWww(ownHost.toLowerCase().split(':')[0])) return null
  return host
}

/** The path without query or fragment, if it is one of the tracked pages. */
export function trackedPath(value: unknown): string | null {
  const raw = typeof value === 'string' && value.length > 0 ? value : '/'
  if (raw.length > 200 || !raw.startsWith('/')) return null
  const path = raw.split(/[?#]/)[0] || '/'
  return (TRACKED_LANDING_PATHS as readonly string[]).includes(path) ? path : null
}

export type LandingEventResult =
  | { ok: true; event: NormalizedLandingEvent }
  | { ok: false; error: string }

/**
 * Turns an untrusted request body into an event, or says why not. Labels
 * that are too long are cut rather than refused: a long campaign name is
 * still a visit.
 */
export function normalizeLandingEvent(body: unknown, ownHost: string | null): LandingEventResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Invalid body' }
  }
  const input = body as Record<string, unknown>

  const event = input.event
  if (typeof event !== 'string' || !(CLIENT_LANDING_EVENTS as readonly string[]).includes(event)) {
    return { ok: false, error: 'Unknown event' }
  }

  const path = trackedPath(input.path)
  if (!path) return { ok: false, error: 'Untracked path' }

  let cta: string | null = null
  if (event === 'cta_click') {
    cta = typeof input.cta === 'string' && CTA_PATTERN.test(input.cta) ? input.cta : null
    if (!cta) return { ok: false, error: 'Invalid cta' }
  }

  return {
    ok: true,
    event: {
      event: event as ClientLandingEvent,
      path,
      referrerHost: referrerHost(input.referrer, ownHost),
      utmSource: cleanLabel(input.utm_source, 100),
      utmMedium: cleanLabel(input.utm_medium, 100),
      utmCampaign: cleanLabel(input.utm_campaign, 100),
      cta,
    },
  }
}

/**
 * Crawlers, link previews, headless browsers and command-line clients.
 * Next's userAgent().isBot catches the well-known crawlers; this catches the
 * rest that announce themselves. Something that hides is not caught, which is
 * accepted: the numbers are a rough picture, not an audit.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrap|preview|fetch|monitor|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|okhttp|axios|node-fetch|go-http|java\/|libwww|facebookexternalhit|embedly|whatsapp|telegram|discord|slack/i

export function looksLikeBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 20 || userAgent.length > 1000) return true
  return BOT_PATTERN.test(userAgent)
}

/** Next's device.type (undefined on desktop browsers) folded into four buckets. */
export function deviceBucket(type: string | undefined): LandingDevice {
  if (!type) return 'desktop'
  if (type === 'mobile' || type === 'wearable') return 'mobile'
  if (type === 'tablet') return 'tablet'
  return 'other'
}

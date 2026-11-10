import type { LandingEventBody } from '@/lib/landing-events'

/**
 * The browser side of landing-page traffic (docs/features/landing-traffic.md).
 * Sends one small JSON body to our own /api/landing-events and nothing else:
 * no third party, no cookie, nothing written to local or session storage.
 *
 * Silent by design. A lost event is never worth an error in front of a
 * visitor, so every failure is swallowed.
 */

const ENDPOINT = '/api/landing-events'

/**
 * Off for visitors who ask not to be tracked (Global Privacy Control or the
 * older Do Not Track), and off on localhost so development does not count
 * towards the real numbers.
 */
export function landingTrackingAllowed(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.globalPrivacyControl === true || nav.doNotTrack === '1') return false
  const host = window.location.hostname
  return !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost'))
}

export function sendLandingEvent(body: LandingEventBody) {
  if (!landingTrackingAllowed()) return
  try {
    const payload = JSON.stringify(body)
    // sendBeacon survives the page being left, which is what a click on a
    // "Get started" link does.
    if (typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
      if (queued) return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Nothing to do: see the note at the top.
  }
}

/** The page view, with where it came from: referrer and UTM tags from the URL. */
export function trackLandingPageview() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  sendLandingEvent({
    event: 'pageview',
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    utm_source: params.get('utm_source') ?? undefined,
    utm_medium: params.get('utm_medium') ?? undefined,
    utm_campaign: params.get('utm_campaign') ?? undefined,
  })
}

/** Where a call to action sits on the page. Also the label in the admin view. */
export type LandingCta = 'nav' | 'hero' | 'pricing' | 'sticky'

export function trackLandingCta(cta: LandingCta) {
  if (typeof window === 'undefined') return
  sendLandingEvent({ event: 'cta_click', path: window.location.pathname, cta })
}

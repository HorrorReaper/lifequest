import { afterEach, describe, expect, it, vi } from 'vitest'
import { landingTrackingAllowed, sendLandingEvent } from '@/lib/landing-tracker'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubLocation(hostname: string) {
  vi.stubGlobal('location', { ...window.location, hostname })
}

describe('landingTrackingAllowed', () => {
  it('is off on localhost, so development does not count', () => {
    // jsdom serves the page from localhost.
    expect(landingTrackingAllowed()).toBe(false)
  })

  it('is on for the real host and off when the visitor sends Global Privacy Control', () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, hostname: 'lifequest.app' } as Location)
    expect(landingTrackingAllowed()).toBe(true)
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true })
    try {
      expect(landingTrackingAllowed()).toBe(false)
    } finally {
      delete (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl
    }
  })
})

describe('sendLandingEvent', () => {
  it('sends nothing when tracking is not allowed', () => {
    stubLocation('localhost')
    const beacon = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon })
    sendLandingEvent({ event: 'pageview' })
    expect(beacon).not.toHaveBeenCalled()
  })
})

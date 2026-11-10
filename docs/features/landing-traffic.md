# Landing-page traffic

Anonymous traffic numbers for the public landing page (`/`): visits, where they came from, on what device, which call to action was clicked and how many visitors went on to join the waitlist. Admins read the numbers on `/admin/tools`, under the Signups card.

There is no third-party tracker, no cookie and nothing in local or session storage, so the landing page needs no consent banner for it.

The privacy policy (`src/app/privacy/page.tsx`, section 7) describes the counting in plain words for visitors.

## What is recorded

| Event | Sent by | When |
| --- | --- | --- |
| `pageview` | Browser, `trackLandingPageview` in `src/lib/landing-tracker.ts` | Once each time `src/app/page.tsx` mounts |
| `cta_click` | Browser, `trackLandingCta` | A click on a waitlist or "Get started" call to action: `nav` (`src/components/layout/Navbar.tsx`), `hero` and `pricing` (`src/components/marketing/PrimaryCta.tsx`), `sticky` (`src/components/marketing/StickyCta.tsx`) |
| `waitlist_signup` | Server, `src/app/api/waitlist/route.ts` | After a new address is saved; not for a duplicate (409) or a honeypot hit |

Each event row (`landing_events`) holds:

- The path, currently always `/` (`TRACKED_LANDING_PATHS` in `src/lib/landing-events.ts`).
- The referrer as a host name only, without `www.`; no path or query. A referrer on the site's own host is dropped.
- `utm_source`, `utm_medium`, `utm_campaign` from the page URL, trimmed, lower-cased, at most 100 characters each.
- The device bucket `mobile`, `tablet`, `desktop` or `other`, derived on the server from Next's `userAgent()`.
- For a click, the CTA name; for a signup, the waitlist form's `source`.
- A visitor hash (see below) and the time.

Not recorded: IP address, user agent string, full referrer URL, screen size, language, location, or anything typed into the page.

## The visitor hash

The route hashes `IP|user agent` with SHA-256 (`requestFingerprint` in `src/lib/landing-events-server.ts`) and sends only that hash to Supabase. `record_landing_event` hashes it again with a random salt that exists for one UTC day; the first event of a new day creates a new salt and deletes the older ones. The stored `visitor_hash` therefore:

- Links one visitor's page view, click and signup within the same UTC day, which is what makes the visit → waitlist funnel possible.
- Cannot be recomputed or linked to another day once that day's salt is gone.

A consequence: "Visitors" are unique per day. Someone who visits on Monday and Tuesday counts twice in a two-day range, and someone who visits on Monday and signs up on Tuesday shows as a Monday visit and a Tuesday signup.

## Opting out and development

`landingTrackingAllowed` in `src/lib/landing-tracker.ts` sends nothing when:

- The browser sends Global Privacy Control or `Do Not Track: 1`.
- The page runs on `localhost`, `127.0.0.1`, `[::1]` or a `*.localhost` host, so local development does not count. A Vercel preview or staging deployment does count, since those share the production database.

## Abuse protection

`POST /api/landing-events` (`src/app/api/landing-events/route.ts`):

- Refuses bodies over 2048 bytes (413) and malformed JSON, unknown events, untracked paths or a malformed CTA name (400). `waitlist_signup` cannot be sent from the browser.
- Drops bots silently with 204: Next's `userAgent().isBot`, a pattern for link previews, headless browsers and command-line clients (`looksLikeBot`), a missing or implausible user agent, and `Sec-Purpose: prefetch`.
- Drops events past 40 per ten minutes per visitor hash, in the instance's memory, also with 204.

Dropped and recorded events get the same 204, so a client cannot tell them apart. A failed insert is logged and still answers 204; the tracker never retries.

## Admin view

`src/components/admin/LandingTraffic.tsx` on `/admin/tools`, using the page's `?range=30|90|365` like the Signups card (`src/components/admin/AdminRangeNav.tsx` is the shared range switch):

- Totals for the range: visitors, page views, CTA clicks with the share of visitors who clicked, waitlist signups with the share of visitors.
- Visitors and page views per UTC day as a line chart, with a table view.
- The funnel Visited → Clicked a CTA → Joined the waitlist, each step as a share of visitors.
- Tabs for referrers, UTM sources, campaigns, devices and CTAs: the eight largest labels and "Other". A missing referrer shows as "Direct / none".

Gap-filling, totals, rates and the breakdown grouping are in `src/lib/landing-analytics.ts`. The numbers come from `admin_landing_daily(p_since)` and `admin_landing_breakdown(p_since)`, which require the trusted admin claim. An allowlist-only admin sees an explanation instead of zeros, and an environment without the migration sees which migration to apply.

## Data and security

Migration: `supabase/migrations/20261110120000_landing_page_traffic.sql`. `landing_events` and `landing_visitor_salts` have RLS enabled and no policies. Events enter only through `record_landing_event`, and admins read only aggregates. See [Data model](../backend/data-model.md), [HTTP API](../backend/api.md) and [Authentication, authorization, and privacy](../backend/auth-security.md#landing-page-traffic).

## Tests

- `src/lib/landing-events.test.ts`: body validation, referrer reduction, bot pattern, device buckets.
- `src/app/api/landing-events/route.test.ts`: status codes, the payload sent to the RPC (no IP or user agent), bot and prefetch drops, the rate limit.
- `src/app/api/waitlist/route.test.ts`: the signup event, none for a duplicate, signup still confirmed when the event fails.
- `src/lib/landing-analytics.test.ts`: series gap-filling, totals, funnel rates, breakdown folding.
- `src/lib/landing-tracker.test.ts`: localhost and Global Privacy Control opt-out.
- `src/components/admin/LandingTraffic.test.tsx`: totals, conversion, range links, unavailable and empty states.

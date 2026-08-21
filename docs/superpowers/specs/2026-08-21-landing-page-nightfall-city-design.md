# Landing page redesign — Nightfall City

> Date: 2026-08-21
> Status: Approved (design mockups reviewed and signed off; implementation not yet started)
> Scope: the public marketing landing page only — `src/app/page.tsx`, `src/components/layout/Navbar.tsx`, `src/components/marketing/Roadmap.tsx`, `src/components/waitlist/WaitlistModal.tsx` (restyle only), plus new components under `src/components/marketing/`. No in-app (`(app)`) routes are touched.

## Problem

The current landing page (`src/app/page.tsx`) reads as generic, templated SaaS design: blurred gradient blobs behind a typewriter-effect hero, emoji-in-rounded-square feature cards, a stock two-tier pricing table. It does not read as belonging to a specific product — the user's own assessment was that it "looks like AI slop."

At the same time, the app already has a genuinely distinctive, well-built visual asset that no other product has: the animated day/night skyline on the login screen (`src/components/auth/auth-scene.tsx`, animations defined in `src/app/globals.css` under the `login-*` prefix). It is locked to the auth screens and never seen by a visitor deciding whether to sign up.

## Design direction

Full interactive mockups were built and iterated to convergence:
- [Landing Page Directions](https://claude.ai/code/artifact/4524b24f-403c-43e5-8b68-8b787cacda9e) — the three original direction options (A/B/C), kept for the historical record of why A was chosen.
- [Nightfall City Landing Page](https://claude.ai/code/artifact/d416f2e8-8c1d-4fd9-b363-5d08ca3a6e20) — the approved full-page mockup, hero through footer, built from the site's real copy. This is the reference to implement against.

**Chosen direction: "Nightfall City."** The hero extends the login page's asset into the landing page's signature element: a dark, cinematic backdrop with a day→sunset→night sky cycle, orbiting sun/moon, twinkling stars, drifting clouds, distant mountains, a sea with a faint mountain reflection, a winding path with quest-marker waypoints, swaying trees/shrubs, and a skyline of buildings with twinkling lit windows — three small trees interspersed directly in the skyline row. The rest of the page (Features, How it works, Mission, Roadmap, Pricing, Final CTA, Footer) is **not** animated — it reuses the same color/type tokens on a consistent dark base, per the "Hero + matching palette" scope decision (rejected: a persistent scroll-linked backdrop across the whole page — too large a build for the payoff, and a performance/mobile risk).

### Token system

- **Color**: ground `#060a14`, surfaces `#0d1626` → `#1a2740`, text `#f3f5fb`, muted text `#93a3c4`, primary accent amber `#f7b955`, secondary accent violet `#8fa0ff` (used sparingly — e.g. the Pro pricing tier).
- **Type**: Baloo 2 (weight 800) for headings only, used with restraint (section H2s, hero H1) — not on body copy or every UI label. Manrope for body copy, nav, buttons, captions.
- **Shape**: 12–16px rounded surfaces, 1px hairline borders (`rgba(255,255,255,0.08)`), soft amber glow on hover — echoing the hero's window-light warmth.

### Section-by-section

- **Navbar** — sticky, translucent dark (`rgba(6,10,20,0.82)` + backdrop-blur), amber-accented primary CTA. Existing `is_MVP` login-vs-waitlist branching logic is preserved, just restyled.
- **Hero** — the Nightfall City scene (see Technical implementation below) with the existing headline/subhead copy, `is_MVP`-aware CTAs, unchanged.
- **Features** — same bento-grid structure and copy already in `page.tsx` (5 cards: city, streak, templates, plan-tomorrow, analytics), restyled to dark card surfaces with amber/white icon treatment instead of colorful emoji-in-box tiles. Preview mockups (streak strip, XP chips, plan list, analytics bars) restyled to the amber/navy palette.
- **How it works** — same 3-step alternating layout and copy. **Difference from the mockup:** the mockup used abstract icon/glow placeholders because external mockups can't embed the app's real images; the real implementation keeps the existing `Step1.png`/`Step2.png`/`Step3.png` screenshots, just restyles the surrounding card border/shadow to match the dark palette. Step-number badges become amber circles.
- **Mission** — same founder-statement copy, centered, on the dark base.
- **Roadmap** — same 7-item list and copy (`Roadmap.tsx`), restyled: dark card surfaces, amber "Live" pill instead of the current light pill, muted "Planned" pill.
- **Pricing** — same Free/Pro copy and feature lists. Free tier keeps the amber accent; Pro tier gets the violet accent as a secondary-tier signal (border + subtle tinted background), replacing today's plain `border-primary` treatment.
- **Final CTA** — same copy, restyled as a quiet echo of the hero: gradient icon-badge treatment plus a small **static** (non-animated) skyline silhouette at the base. No day/night cycle here — it's a bookend motif, not a second scene.
- **Footer** — dark, minimal, same links/copyright, same type system.

## Technical implementation

**New fonts.** Baloo 2 (800) and Manrope (400/600/700) loaded via `next/font/google`, scoped to the marketing route only (e.g. applied via a class on the landing page's root wrapper) — this must not touch the app's existing `font-sans`/Inter setup used everywhere else (`src/app/layout.tsx`).

**New animation keyframes, not a refactor of the existing ones.** The hero's day/night cycle, star glimmer, sun/moon orbit, cloud drift, window twinkle, tree sway, shrub breathe, and leaf drift are functionally the same technique as the `login-*` keyframes already in `globals.css`, but they should be added as new, separately-named keyframes (e.g. `nc-*`, matching what the mockups use) rather than by modifying or reusing the `login-*` ones directly. `auth-scene.tsx` is a live, working auth surface — changing its shared CSS to accommodate the new hero risks regressing it. Unifying the two animation systems into one shared utility is a reasonable follow-up but is explicitly out of scope here.

**Deterministic content generation — no `Math.random()`.** The HTML mockups generate the skyline's lit-window pattern, star positions, and tree placement with `Math.random()` at load time, which is fine for a static file but **will cause React hydration mismatches** in this Next.js app (server-rendered output and client-rendered output would differ). `auth-scene.tsx`'s own `Skyline()` component already solves this correctly — it hardcodes building-height arrays and derives the lit/unlit window pattern from a pure formula (`(i + index) % 3 === 0`), so server and client always agree. The new hero component must follow that same pattern: fixed arrays and deterministic formulas standing in for every place the mockup used `Math.random()`.

**Component structure.** A new `NightfallHero` component (plus whatever internal decomposition makes sense — e.g. a `Skyline`/`Scene` sub-component, matching the granularity `auth-scene.tsx` already uses for its own `Skyline()`), rendering the scene layers and the hero content. `Navbar.tsx` and `Roadmap.tsx` get restyled in place. The other sections (Features, How it works, Mission, Pricing, Final CTA, Footer) are restyled within `page.tsx` itself, matching how they're structured today, unless the resulting file size argues for extraction — that's an implementation-time call, not a scope decision here.

**Coordinating with existing hero WIP.** `src/app/page.tsx` currently carries the user's own uncommitted, in-progress hero redesign work (predates this session). Implementing this spec means intentionally replacing that hero section — this needs to happen as a deliberate reconciliation (confirm with the user what of the current WIP, if anything, should carry over) rather than a silent overwrite.

**`is_MVP` branching, `WaitlistModal` trigger points, and the `hero-phone-hand.png` image usage** are all preserved functionally; only their visual styling changes.

## Explicitly out of scope

- A persistent, scroll-linked animated backdrop across the entire page (the rejected "ambitious" direction).
- Refactoring or unifying the `login-*` (auth) and new `nc-*` (landing) animation systems into one shared implementation.
- Any copy rewrites beyond what's already reflected in the approved mockup — mission statement, pricing copy, feature descriptions, roadmap items all stay as currently written.
- Any change to onboarding, in-app pages, or the admin/testing tools.
- Deleting the currently-unused `WaitlistForm.tsx` / `/api/waitlist/route.ts` dead code (flagged in an earlier audit, deferred by the user).

## Testing

- Component test(s) for the new hero component covering: deterministic output (same render twice produces identical markup — guards against an accidental `Math.random()` regression), and that it renders the correct copy/CTA target depending on `is_MVP`.
- No visual/animation snapshot testing attempted — motion and gradients are verified by hand.
- Manual verification in the browser: desktop and mobile widths, confirming the hero's terrain layers stay below the text at every viewport size actually tested (this exact class of bug — fixed-position terrain creeping into the text area on short viewports — was caught once already during mockup iteration and fixed by giving the hero a `min-height` floor in real pixels, not only `vh`; carry that fix into the real implementation from the start).
- Confirm the new dark palette isn't fought by the app's existing `.white-mode` CSS overrides in `globals.css` (e.g. `.white-mode [class*="from-primary"]`) — these should only apply inside authenticated app surfaces, not the public marketing route, but worth a quick check since the landing page is a fixed-dark design regardless of any theme toggle.

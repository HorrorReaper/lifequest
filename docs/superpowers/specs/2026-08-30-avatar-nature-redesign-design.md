# Avatar system & nature/trail visual redesign

> Date: 2026-08-30
> Status: Draft — direction agreed with the user, two decisions still open (see below). Not approved for implementation yet.
> Scope: an in-app visual direction change (starting with the dashboard) plus a new, independent Avatar feature. `/city` is retired as a *reachable* feature but its code, data, and migrations are untouched. No social features are part of this plan.

## Problem

The user shared a mockup (inline screenshot, not a published artifact — no link exists) of a "trail journal" style dashboard: warm cream background, hand-drawn line-art illustration (mountains, trees, a winding path), a day counter ("Day 412 · Northern Reach"), and stats reframed as a journey ("128.4 km travelled", "Elev. 10", "1,133 Provisions", "3 days unbroken trail"). They found the rough visual direction interesting and want to explore it, while also wanting to retire the City feature (10×10 grid, building placement) from what regular users can reach, since it's judged as a feature that will likely return later in a different form.

Two constraints came out of discussion and should not be re-litigated without going back to the user:

- **No invented lore or renamed core concepts.** An earlier draft of this plan proposed renaming XP to "distance", coins to "provisions", and city tiers to invented names ("Trailhead → Foothills → Ridgeline → Basecamp Legend"). The user explicitly rejected this — the interest is in the rough visual/illustration direction, not a themed vocabulary layered over the existing XP/level/streak/coin concepts. Keep those names as they are.
- **No punitive mechanics.** Habitica's most distinctive systemic feature — HP loss on a missed daily, an avatar that can "die" and reset progress, collaborative boss fights — was considered and intentionally excluded. It contradicts the app's existing design principles (optimistic UI, streak freezes instead of harsh streak resets, no social pressure). This plan only takes Habitica's *rewarding* systems (avatar, equipment, a coin sink), not its punishing ones.

## Decided scope

### 1. Visual direction

Apply the trail/nature aesthetic (warm cream tones, hand-drawn/illustrated line art) starting with the dashboard, the same way the Nightfall City landing page redesign (`docs/superpowers/specs/2026-08-21-landing-page-nightfall-city-design.md`) was scoped as a visual-only pass before being extended elsewhere. No renamed data concepts — XP, level, streak, and coins keep their existing names and meaning; only the illustration/color/type layer changes.

### 2. City becomes unreachable, not removed

`/city`, `city_states`, the building catalog, and the unlock engine are left completely untouched in code and data. The feature is only made unreachable for users:

- Remove the `City` entry from the bottom navigation (`src/components/layout/bottom-nav.tsx`).
- Redirect the `/city` route to `/dashboard`, mirroring the existing pattern already used for `/analytics` (`src/app/(app)/analytics/page.tsx`) — a `redirect()` call before any other logic, not a new feature-flag abstraction. This repo has a documented history of duplicate/diverging surfaces (`/dashboard` vs `/dashboard2`, the two former `city.ts` copies); leaving the code in place but unreachable, rather than half-migrating it, avoids adding another one.
- No migration, no data cleanup. This is explicitly meant to be reversible when City returns in some future form.

### 3. New Avatar feature

A new, independent feature — not a reuse or migration of City's code or table:

- **Data:** a new table, e.g. `avatar_states` (`user_id`, `equipped_items`, `unlocked_items`), separate from `city_states`. City's data model is not touched or shared.
- **Coins as the funding source.** Per the user's decision, coins — currently earned throughout the app but only spendable in City — become the currency this feature spends. This is what keeps the coin economy meaningful once City is unreachable; no separate currency is introduced.
- **Catalog shape, not final contents.** Conceptually similar to `BUILDING_CATALOG` (an item, a coin cost, an XP threshold that unlocks it) but as new, independent code — no shared module with the building catalog or its unlock engine.
- **Naming stays plain.** Equipment items are named for what they are ("trail jacket", "hiking boots", "backpack"), matching the illustration style, without a wrapping narrative or invented terminology layered on top.
- **Navigation.** The bottom-nav slot freed up by removing City is reused for Avatar, keeping the existing five-slot structure rather than adding a slot.

### 4. Explicitly out of scope

- Habitica-style classes, mana/skills, pets/mounts, parties/guilds, or collaborative boss fights.
- Any HP/damage/punitive mechanic tied to missed habits or tasks.
- Social features of any kind (sharing, feeds, followers, party accountability). The user wants these later, once there is a user base — no design work for them belongs in this plan.
- Renaming or reframing XP, level, streak, or coins.

## Resolved

**`/profile` and Avatar are unified, not two separate screens.** The user decided the existing (uncommitted) `src/app/(app)/profile/page.tsx` — level, streak, coins, city tier, per-skill XP — and the new Avatar customization screen become one surface: stats and customization live together, reached from the single nav slot freed up by removing City. `SkillLevels`/`fetchSkillXpTotals` and the rest of `/profile`'s current content carry over into that merged screen rather than being duplicated or discarded.

## Shipped

- **Token-only "Trail" theme** (branch `feat/trail-theme`) — warm parchment background, forest-green primary, selectable in Settings alongside White/System/Dark. User confirmed the direction. The illustration/layout layer is still a separate, larger follow-up.
- **City retired as a reachable feature** (branch `feat/hide-city`) — `/city` now redirects to `/dashboard`; the working implementation was moved verbatim to `src/components/city/CityPageClient.tsx` (unused but intact) rather than left in place behind an unconditional `redirect()`, because `redirect()`'s `never` return type makes TypeScript treat everything after it as unreachable and drops the `&&` null-narrowing City's own JSX depends on — `/analytics` gets away with the inline version only because its dead code is trivial. Bottom nav's City entry and the now-dead City shortcut in admin QA tools were removed too. Neither branch is merged into `master` yet.

## Open questions — must be resolved before a task-by-task implementation plan is written

1. **Equipment slots and starting catalog.** Only the general shape (coin cost + XP threshold per item) is agreed; the actual slot list (e.g. jacket / boots / backpack / hat) and the first catalog of items are not yet drafted.
2. **Exact `avatar_states` column shape** (JSON structure for `equipped_items`/`unlocked_items` vs. normalized rows, and how it sits alongside the existing `profiles`/skill-XP data the merged screen also reads) is a sketch, not a finalized schema — a normal implementation-time decision, not a product one.

## Next step

Once question 1 is drafted, follow up with a dated implementation plan under `docs/superpowers/plans/` (task-by-task, matching `docs/superpowers/plans/2026-08-21-landing-page-nightfall-city.md`'s format) before any code is written.

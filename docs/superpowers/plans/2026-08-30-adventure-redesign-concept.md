# Adventure/Nature Redesign — Concept Plan

> **Status: concept plan only.** No code changes are in scope yet. This document exists to align on direction before any implementation plan (task/step breakdown, migrations, TDD steps) is written for a follow-up phase.

## Why

The City metaphor (`/city`, a 10×10 isometric-ish grid of purchasable buildings) is LifeQuest's current visible "reward world." It works, but it frames progress as *managing a settlement* rather than *the user's own growth*. Habitica's model — a personal avatar that gains stats, gear, and a sense of place as the user does real things — ties the reward layer more directly to the user, which fits LifeQuest's self-improvement focus better than a city-builder does.

Goal of this redesign: replace the city-builder metaphor with an adventurer/nature metaphor, where the user's **character** (not a settlement) is the visible progress artifact.

## Guiding constraints from existing code

- `profiles.total_xp` stays the single XP source of truth; `getLevel`/`xpForLevel` (`src/lib/gamification.ts`, mirrored in `src/lib/city/city.ts`) stay the level formula. No new leveling math.
- The 6-category skill taxonomy (`src/lib/skill-categories.ts`: physical_health, mental_health, focus, learning, relationships, career) already exists and already accumulates XP per category via `xp_events.skill_category` (shipped in the skill-categories/habit-XP work). This is the natural basis for character "attributes" — it does not need to be invented.
- Coins (`city_states.coins`) are already a general currency, already earned from journal-entry claims and habit check-ins, not tied to buildings specifically. They can be repointed at avatar gear instead of buildings without a new economy.
- Quests, habits, streaks, and the reward-RPC pattern (atomic XP+coin grants, dedup via unique index / claimed-ids) are unaffected — this redesign only touches the *visual/world* layer, not progression mechanics.
- `/city`'s building catalog, grid, and placement RPCs (`src/lib/city/city.ts`, `src/components/city/*`) are the pieces being phased out. Nothing here proposes deleting them yet — see Phasing.

## Direction

Replace "your city" with **"your character"**, standing in a **nature/adventure scene** (a base camp, a trailhead, a clearing — something calmer and less industrial than a city skyline). Concretely:

1. **Character sheet, not city grid.** The primary visible screen becomes an avatar with stat bars, not a buildable grid. The 6 skill categories become the 6 attributes shown as bars/rings around the avatar (reusing `fetchSkillXpTotals` — no new schema).
2. **World as backdrop, not as the mechanic.** Where City used *placing buildings* as the core interaction, the adventure screen uses a nature backdrop (forest → meadow → mountains → summit, tied to level tier, mirroring today's Village→Town→City→Metropolis→Capital tiers 1:1 in spirit) as **passive scenery that changes with level**, not something the user manages tile-by-tile. This removes the grid-management interaction entirely rather than reskinning it.
3. **Coins buy gear/cosmetics, not buildings.** The existing coin balance and journal-entry reward claiming (`RewardsClaimer`, `claimRewards`) carry over unchanged; what they buy changes from `BuildingType` catalog entries to avatar equipment/cosmetic catalog entries (hat, cloak, companion, campsite decoration, etc.).
4. **Quest/journal language stays.** LifeQuest already calls things "quests" — this redesign leans into that instead of introducing new vocabulary.

### Visual language

- Palette: keep it earthy/natural rather than the current sky-to-grass gradient's city-adjacent brightness — deeper forest greens, moss, warm parchment/sand neutrals, one warm accent (amber/ember) for CTAs and streak fire. Both a light and dark variant are required (existing app supports both).
- Chrome: panels read as a field journal / map, not app cards — soft-edged, slightly textured backgrounds, a "stamped" or hand-drawn feel for icons rather than flat emoji where feasible. Emoji-based icons (current City sprite approach: `BuildingSprite` renders `building.emoji`) are an acceptable low-cost MVP fallback if custom art isn't produced — flagged as an open question below.
- Avatar: start simple (a layered SVG/sprite with swappable equipment slots) rather than committing to a full character-creator. Complexity here is the single biggest scope risk in this redesign — see Open Questions.

## Phasing

This is additive-first so City is never deleted before its replacement exists and is validated.

**Phase 1 — Character sheet (additive, low risk)**
New screen showing avatar + 6 attribute bars (from existing `fetchSkillXpTotals` + `getLevel`), overall level/tier, coins. No new schema required. Ships alongside `/city`, not instead of it. This is the natural next implementation-plan candidate once this concept is agreed.

**Phase 2 — Adventure world (replaces City's role)**
The nature backdrop + gear shop replaces the building grid as the "main world" screen. Requires:
- New avatar-equipment catalog + `avatar_state`/inventory schema (mirrors `city_buildings_placing`'s shape: a small table of owned/equipped items per user).
- Reworking `RewardsClaimer`'s claim target from city coins/xp (unchanged) to the new equipment shop.
- Nav change: bottom nav's "City" entry (`src/components/layout/bottom-nav.tsx`) becomes e.g. "Camp" or "Character", pointing at the new route.

**Phase 3 — Sunset City**
Once Phase 2 is live and stable, remove `/city` from navigation (keep the route + data intact rather than deleting `city_states`/`city_buildings_placing`, in case of rollback), then in a later cleanup remove the dead code per this repo's usual unused-code policy.

Nothing in Phase 1 requires committing to Phase 2's schema yet — Phase 1 can ship and be evaluated on its own.

## Explicit non-goals (for this document)

- No implementation, no migrations, no component code in this plan — concept only, per request.
- No decision yet on production of custom art assets vs. an emoji/icon MVP (open question below).
- No pet/companion system, no PvP/guild features (Habitica has these; out of scope until the core avatar redesign lands).
- No change to XP/level math, streak math, or reward-RPC integrity patterns.

## Open questions

1. **Art approach:** commissioned/generated illustration set for the avatar and backdrop, or ship Phase 1 with emoji/icon placeholders (fast, consistent with today's `BuildingSprite` approach) and upgrade visuals later?
2. **Avatar depth:** a single evolving avatar (simplest, closest to "character sheet" framing) vs. a Habitica-style equipment-layered avatar (more scope, more ongoing content work per new gear item)?
3. **Nav naming:** what replaces "City" in the bottom nav for Phase 1 (e.g. "Character")? Phase 2's world screen may want its own slot too, or reuse the same one.
4. **Backdrop tiers:** reuse the exact 5 existing level tiers (Village/Town/City/Metropolis/Capital → renamed to nature equivalents, e.g. Clearing/Trailhead/Forest/Highlands/Summit) 1:1, or redesign the tier thresholds at the same time?

## Suggested next step

Once the direction above is confirmed (or adjusted), the next artifact is a proper implementation plan for **Phase 1 only** (character sheet screen), written in this repo's usual task/step TDD format — small enough to ship and evaluate before committing to Phase 2's schema and City's removal.

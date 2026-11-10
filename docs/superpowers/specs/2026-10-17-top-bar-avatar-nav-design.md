# Top bar, avatar head in the bottom nav, slim dashboard greeting

> Date: 2026-10-17
> Status: Approved by the user in chat; implementation on branch `feat/top-bar-avatar-nav` (off `claude/lifequest-challenge-system-s3aol0`).
> Scope: frontend only. No database or RPC changes.

## Problem

Level, XP, coins and streak live in a hero card at the top of `/dashboard`
only, so they are invisible everywhere else in the app. The dashboard hero is
also large for what it says. The Avatar tab in the bottom navigation shows a
generic user icon even though the avatar is the app's identity feature.

## Decisions

- A **top bar** shows level, XP progress, coins and streak on every page that
  has the standard shell, and stays on screen while scrolling. It is hidden on
  the same immersive routes as the bottom nav (`isImmersiveRoute`).
- The **Avatar tab icon** is the avatar's head (hat included) instead of a
  generic icon.
- The dashboard hero is replaced by a **greeting**: avatar head plus
  "Welcome back, <name>". The Trail theme keeps its Fraunces heading.
- `DashboardHero` and `XpRing` stay: `/profile` still uses them.

## Design

### Data

- `src/lib/shell-stats.ts` exposes `fetchShellStats(supabase, userId)`, called
  from `src/app/(app)/layout.tsx`: `total_xp` and `current_streak` from
  `profiles`, `coins` from `city_states`, equipped items via `fetchAvatarState`.
  A failed part falls back to a default instead of taking the layout down.
- `AppShell` receives the result as `initialStats` and runs `useShellStats`:
  it renders with the server props first (identical on server and client, so
  no hydration mismatch and no request-shared state), then writes them into
  `user-store` in an effect and reads from the store from then on.
- `user-store` gains `equippedItems` and `setEquippedItems`. Existing writers
  (`addXp`, `setCoins`, `updateStreak`) therefore update the bar live;
  `AvatarPicker` calls `setEquippedItems` so the nav icon follows an equip.
- The nav's own post-mount refresh of XP and coins is unchanged.

### Top bar

- `src/components/layout/app-top-bar.tsx`, presentational: takes the stats as
  props. One row: `Lv N` with a thin XP progress bar and "x / y XP", coins,
  streak. Uses theme tokens, so it follows White, System, Dark and Trail.
- `sticky top-[var(--preview-banner-height,0px)]` inside `AppShell`, in flow,
  rather than `fixed`: no padding arithmetic, and it sits below the admin
  `PreviewAsUserBanner` (which is `sticky top-0 z-[60]`) instead of behind it.
  The layout sets `--preview-banner-height` only while previewing.

### Bottom nav

- `NavItem.icon` may be a render function; the Avatar item renders
  `AvatarHead` from the store's `equippedItems`. The active state is a ring
  around the head rather than a colour change.

### Dashboard

- New `DashboardGreeting`; `ThemedDashboardHero` and `TrailDashboardHero` are
  deleted. `dashboard/page.tsx` stops passing level, coins and streak to a hero.

## Out of scope

- Removing the hero from `/profile`.
- Changing the bottom nav's own XP/coin refresh.
- Showing the whole figure instead of the head on the dashboard.

## Checks

- Unit tests: `fetchShellStats` fallbacks, top bar, nav avatar icon and ring,
  greeting.
- Browser at 375px: bar and nav fit; the bar stays on top while scrolling;
  immersive routes show neither.
- No page with its own `sticky top-*` header in the standard shell collides
  with the bar. Checked: the only `sticky top-0` there is `PreviewAsUserBanner`.
  The others sit on immersive routes (journal entry, Today Plan, lesson player)
  or at the bottom.

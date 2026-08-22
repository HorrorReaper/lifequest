# Nightfall City Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's generic hero/feature-card/pricing look with the "Nightfall City" direction — a dark, cinematic animated hero (reusing the login page's day/night atmosphere as its signature) and a consistent dark palette across every section below it.

**Architecture:** A new pure-data module generates deterministic scene content (building heights, window-lit pattern, star positions, tree placement) with no `Math.random()`, consumed by a new `NightfallHero` client component that renders the animated scene plus the existing hero copy/CTAs. `Navbar`, `Roadmap`, and the remaining sections of `page.tsx` (Features, How it works, Mission, Pricing, Final CTA, Footer) are restyled in place to the same dark token system — no new components needed for those, since they're pure visual changes to existing structure and copy.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 (arbitrary-value utility classes), `next/font/google`, framer-motion (already used by `Roadmap.tsx`/`page.tsx`, untouched), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-21-landing-page-nightfall-city-design.md`

## Global Constraints

- Dark palette only — the marketing page is a fixed-dark design, not theme-adaptive (no light/dark toggle on this route).
- New fonts (Baloo 2, Manrope) must be scoped to the marketing route only — must not change `src/app/layout.tsx`'s existing `font-sans`/Inter setup used by the rest of the app.
- New animation keyframes go into `src/app/globals.css` under new `nc-*` names — do not modify or rename the existing `login-*` keyframes (`AuthScene`/login page must keep working unchanged).
- No `Math.random()` anywhere in the scene-generation code — every piece of "randomized-looking" content (window-lit pattern, star positions, tree placement) must be a pure, deterministic function so server and client render identical output (avoids React hydration mismatches).
- Keep the existing `Step1.png`/`Step2.png`/`Step3.png` screenshots in "How it works" — do not replace them with placeholder art (that substitution in the design mockup was only a mockup-tooling limitation).
- Preserve the existing `is_MVP` branching and `WaitlistModal` trigger points functionally in every section that has them (Navbar, Hero, Pricing, Final CTA) — only their visual styling changes.
- Preserve all existing copy verbatim (mission statement, pricing tiers, feature descriptions, roadmap items, footer links) — this plan is a visual reskin, not a rewrite.
- `src/components/layout/Navbar.tsx` and `src/components/marketing/Roadmap.tsx` are used only by `src/app/page.tsx` (confirmed via grep) — safe to restyle without affecting any other route.

---

## Task 1: Deterministic scene-data generator

**Files:**
- Create: `src/lib/nightfall-scene.ts`
- Test: `src/lib/nightfall-scene.test.ts`

**Interfaces:**
- Produces: `SkylineBuilding { height: number; windows: boolean[] }`, `buildSkylineBuildings(): SkylineBuilding[]`; `StarPosition { left: string; top: string; size: number }`, `buildStarField(): StarPosition[]`; `ParkTree { side: 'left' | 'right'; pct: number; alt: boolean }`, `buildParkTrees(): ParkTree[]`; `ParkShrub { side: 'left' | 'right'; pct: number; width: number }`, `buildParkShrubs(): ParkShrub[]`. Task 2 consumes all four.

- [ ] **Step 1: Write the failing test**

Create `src/lib/nightfall-scene.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildParkShrubs,
  buildParkTrees,
  buildSkylineBuildings,
  buildStarField,
} from "./nightfall-scene";

describe("buildSkylineBuildings", () => {
  it("returns 15 buildings with a positive number of windows each", () => {
    const buildings = buildSkylineBuildings();
    expect(buildings).toHaveLength(15);
    for (const building of buildings) {
      expect(building.height).toBeGreaterThan(0);
      expect(building.windows.length).toBeGreaterThan(0);
    }
  });

  it("returns identical output on every call (deterministic, no Math.random)", () => {
    expect(buildSkylineBuildings()).toEqual(buildSkylineBuildings());
  });
});

describe("buildStarField", () => {
  it("returns identical output on every call", () => {
    expect(buildStarField()).toEqual(buildStarField());
  });

  it("returns at least 10 stars", () => {
    expect(buildStarField().length).toBeGreaterThanOrEqual(10);
  });
});

describe("buildParkTrees", () => {
  it("returns trees on both sides of the path", () => {
    const trees = buildParkTrees();
    expect(trees.some((t) => t.side === "left")).toBe(true);
    expect(trees.some((t) => t.side === "right")).toBe(true);
  });

  it("returns identical output on every call", () => {
    expect(buildParkTrees()).toEqual(buildParkTrees());
  });
});

describe("buildParkShrubs", () => {
  it("returns identical output on every call", () => {
    expect(buildParkShrubs()).toEqual(buildParkShrubs());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/nightfall-scene.test.ts`
Expected: FAIL — `Failed to resolve import "./nightfall-scene"` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/nightfall-scene.ts`:

```ts
export interface SkylineBuilding {
  height: number;
  windows: boolean[];
}

const BUILDING_HEIGHTS = [70, 110, 90, 150, 80, 130, 170, 100, 140, 75, 120, 95, 160, 85, 105];

export function buildSkylineBuildings(): SkylineBuilding[] {
  return BUILDING_HEIGHTS.map((height, index) => {
    const rows = Math.floor((height - 12) / 11);
    const windowCount = rows * 3;
    const windows: boolean[] = [];
    for (let i = 0; i < windowCount; i++) {
      windows.push((i + index) % 3 === 0);
    }
    return { height, windows };
  });
}

export interface StarPosition {
  left: string;
  top: string;
  size: number;
}

const STAR_SPOTS: Array<[string, string]> = [
  ["8%", "14%"], ["17%", "27%"], ["29%", "10%"], ["40%", "22%"], ["52%", "12%"],
  ["61%", "30%"], ["72%", "9%"], ["83%", "24%"], ["92%", "15%"], ["48%", "34%"], ["24%", "33%"],
];

export function buildStarField(): StarPosition[] {
  return STAR_SPOTS.map(([left, top], i) => ({
    left,
    top,
    size: i % 3 === 0 ? 2 : 1.2,
  }));
}

export interface ParkTree {
  side: "left" | "right";
  pct: number;
  alt: boolean;
}

const PARK_TREE_SPOTS: Array<["left" | "right", number]> = [
  ["left", 4], ["left", 15], ["left", 24], ["left", 32],
  ["right", 4], ["right", 14], ["right", 25], ["right", 33],
];

export function buildParkTrees(): ParkTree[] {
  return PARK_TREE_SPOTS.map(([side, pct], i) => ({ side, pct, alt: i % 2 === 0 }));
}

export interface ParkShrub {
  side: "left" | "right";
  pct: number;
  width: number;
}

export function buildParkShrubs(): ParkShrub[] {
  return [
    { side: "left", pct: 1, width: 60 },
    { side: "left", pct: 10, width: 46 },
    { side: "left", pct: 20, width: 52 },
    { side: "right", pct: 21, width: 46 },
    { side: "right", pct: 10, width: 60 },
    { side: "right", pct: 1, width: 42 },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/nightfall-scene.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/nightfall-scene.ts src/lib/nightfall-scene.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nightfall-scene.ts src/lib/nightfall-scene.test.ts
git commit -m "feat(marketing): add deterministic scene-data generator for the Nightfall City hero"
```

---

## Task 2: Nightfall City keyframes and marketing fonts

**Files:**
- Modify: `src/app/globals.css` (append new section)
- Create: `src/lib/marketing-fonts.ts`

**Interfaces:**
- Produces: CSS keyframes `nc-day-cycle`, `nc-sunset-cycle`, `nc-night-cycle`, `nc-stars-cycle`, `nc-star-glimmer`, `nc-sun-orbit`, `nc-moon-orbit`, `nc-cloud-drift`, `nc-flight-crossing`, `nc-sky-breathe`, `nc-windows-cycle`, `nc-window-twinkle`, `nc-tree-sway`, `nc-trunk-flex`, `nc-shrub-breathe`, `nc-sea-glint`, `nc-beacon-pulse` (all globally available via Tailwind's `animate-[name_duration_...]` arbitrary syntax). Also produces `nightfallDisplay` and `nightfallBody` (from `src/lib/marketing-fonts.ts`), each a `next/font/google` result object with a `.variable` string property. Task 3 and Task 5/6 consume these.

This task has no automated test — it is pure CSS/font configuration with no logic to unit test, matching this codebase's existing convention for style-only changes (verified by the checklist below instead).

- [ ] **Step 1: Append the new keyframes to `globals.css`**

Open `src/app/globals.css`. Add this new section at the very end of the file (after the existing `login-*` keyframes, which stay untouched):

```css

/* Nightfall City landing-page hero atmosphere (src/components/marketing/NightfallHero.tsx).
   Deliberately separate from the login-* keyframes above: same technique, but kept
   independent so changes to one surface can never regress the other. */
@keyframes nc-day-cycle {
  0%, 20% { opacity: 1; }
  38%, 78% { opacity: 0; }
  94%, 100% { opacity: 1; }
}
@keyframes nc-sunset-cycle {
  0%, 10% { opacity: 0.35; }
  28%, 42% { opacity: 1; }
  55%, 76% { opacity: 0; }
  91%, 100% { opacity: 0.65; }
}
@keyframes nc-night-cycle {
  0%, 34% { opacity: 0; }
  52%, 78% { opacity: 1; }
  94%, 100% { opacity: 0; }
}
@keyframes nc-stars-cycle {
  0%, 40% { opacity: 0; }
  54%, 78% { opacity: 0.85; }
  91%, 100% { opacity: 0; }
}
@keyframes nc-star-glimmer {
  0%, 100% { opacity: 0.3; transform: scale(0.75); }
  50% { opacity: 1; transform: scale(1.2); }
}
@keyframes nc-sun-orbit {
  0% { opacity: 0; transform: translate3d(-8vw, 12vh, 0) scale(0.85); }
  6% { opacity: 0.9; }
  22% { opacity: 0.9; transform: translate3d(46vw, -6vh, 0) scale(1); }
  33% { opacity: 0.9; }
  42% { opacity: 0; transform: translate3d(96vw, 14vh, 0) scale(1.05); }
  100% { opacity: 0; transform: translate3d(96vw, 14vh, 0) scale(1.05); }
}
@keyframes nc-moon-orbit {
  0%, 40% { opacity: 0; transform: translate3d(-7vw, 12vh, 0) scale(0.85); }
  48% { opacity: 0.88; }
  65% { opacity: 0.88; transform: translate3d(46vw, -5vh, 0) scale(1); }
  79% { opacity: 0.88; }
  88% { opacity: 0; transform: translate3d(96vw, 13vh, 0) scale(1.02); }
  100% { opacity: 0; transform: translate3d(96vw, 13vh, 0) scale(1.02); }
}
@keyframes nc-cloud-drift {
  0% { transform: translate3d(-24vw, 0, 0); }
  100% { transform: translate3d(124vw, 0, 0); }
}
@keyframes nc-flight-crossing {
  0%, 18% { opacity: 0; transform: translate3d(-10vw, 0, 0); }
  24%, 74% { opacity: 0.55; }
  82%, 100% { opacity: 0; transform: translate3d(96vw, -3vh, 0); }
}
@keyframes nc-sky-breathe {
  0% { opacity: 0.6; transform: translate3d(-2%, -1%, 0) scale(0.96); }
  100% { opacity: 1; transform: translate3d(4%, 2%, 0) scale(1.08); }
}
@keyframes nc-windows-cycle {
  0%, 28%, 100% { opacity: 0.3; }
  48%, 82% { opacity: 0.95; }
}
@keyframes nc-window-twinkle {
  0%, 32%, 100% { opacity: 0.55; filter: brightness(0.85); }
  45%, 68% { opacity: 1; filter: brightness(1.35); }
}
@keyframes nc-tree-sway {
  0%, 28%, 100% { transform: translateX(-50%) rotate(-1deg) skewX(-0.5deg); }
  38% { transform: translateX(-50%) rotate(1.5deg) skewX(1deg); }
  44% { transform: translateX(-50%) rotate(-2.8deg) skewX(-1.5deg); }
  53% { transform: translateX(-50%) rotate(1.8deg) skewX(0.8deg); }
  70% { transform: translateX(-50%) rotate(0.4deg); }
}
@keyframes nc-trunk-flex {
  0%, 28%, 100% { transform: translateX(-50%) rotate(-0.25deg); }
  38% { transform: translateX(-50%) rotate(0.5deg); }
  44% { transform: translateX(-50%) rotate(-0.9deg); }
  53% { transform: translateX(-50%) rotate(0.55deg); }
  70% { transform: translateX(-50%) rotate(0deg); }
}
@keyframes nc-shrub-breathe {
  0% { transform: scaleX(0.97); }
  100% { transform: scaleX(1.03); }
}
@keyframes nc-sea-glint {
  0%, 100% { opacity: 0.25; transform: scaleX(0.85); }
  50% { opacity: 0.85; transform: scaleX(1.1); }
}
@keyframes nc-beacon-pulse {
  0%, 55%, 100% { opacity: 0.35; transform: scale(0.75); }
  12% { opacity: 1; transform: scale(1.25); }
}
```

- [ ] **Step 2: Create the marketing fonts module**

Create `src/lib/marketing-fonts.ts`:

```ts
import { Baloo_2, Manrope } from "next/font/google";

// Scoped to the marketing landing page only — applied via `.variable` on the
// page's root wrapper in page.tsx. Must never be applied to src/app/layout.tsx,
// which owns the app-wide Inter/font-sans setup for every other route.
export const nightfallDisplay = Baloo_2({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-nightfall-display",
});

export const nightfallBody = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nightfall-body",
});
```

- [ ] **Step 3: Verify no regressions**

Run: `npx tsc --noEmit && npx eslint src/lib/marketing-fonts.ts`
Expected: no errors. (The keyframes aren't used by anything yet — that's Task 3 — so there's nothing to visually check until then.)

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/lib/marketing-fonts.ts
git commit -m "feat(marketing): add Nightfall City keyframes and scoped display/body fonts"
```

---

## Task 3: `NightfallHero` component

**Files:**
- Create: `src/components/marketing/NightfallHero.tsx`
- Test: `src/components/marketing/NightfallHero.test.tsx`

**Interfaces:**
- Consumes: `buildSkylineBuildings`, `buildStarField`, `buildParkTrees`, `buildParkShrubs` from `@/lib/nightfall-scene` (Task 1).
- Produces: `NightfallHero({ isMvp: boolean; onWaitlistOpen: () => void }): JSX.Element`, a default within the marketing folder (not a default export — named export `NightfallHero`). Task 5 renders `<NightfallHero isMvp={is_MVP} onWaitlistOpen={() => setWaitlistOpen(true)} />` in place of the current hero JSX.

- [ ] **Step 1: Write the failing test**

Create `src/components/marketing/NightfallHero.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NightfallHero } from "./NightfallHero";

afterEach(cleanup);

describe("NightfallHero", () => {
  it("renders identical markup across repeated renders (no non-deterministic content)", () => {
    const { container: first } = render(
      <NightfallHero isMvp={false} onWaitlistOpen={() => undefined} />
    );
    const firstHtml = first.innerHTML;
    cleanup();
    const { container: second } = render(
      <NightfallHero isMvp={false} onWaitlistOpen={() => undefined} />
    );
    expect(second.innerHTML).toBe(firstHtml);
  });

  it("links the primary CTA to /login when isMvp is true", () => {
    render(<NightfallHero isMvp onWaitlistOpen={() => undefined} />);
    const link = screen.getByRole("link", { name: /start your quest/i });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("calls onWaitlistOpen instead of linking to /login when isMvp is false", () => {
    const onWaitlistOpen = vi.fn();
    render(<NightfallHero isMvp={false} onWaitlistOpen={onWaitlistOpen} />);
    screen.getByRole("button", { name: /join the waitlist/i }).click();
    expect(onWaitlistOpen).toHaveBeenCalledTimes(1);
  });

  it("renders the subheading copy", () => {
    render(<NightfallHero isMvp={false} onWaitlistOpen={() => undefined} />);
    expect(
      screen.getByText(/earn xp and coins for every journal entry/i)
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/marketing/NightfallHero.test.tsx`
Expected: FAIL — `Failed to resolve import "./NightfallHero"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/marketing/NightfallHero.tsx`:

```tsx
"use client";

import Link from "next/link";
import {
  buildParkShrubs,
  buildParkTrees,
  buildSkylineBuildings,
  buildStarField,
} from "@/lib/nightfall-scene";

interface NightfallHeroProps {
  isMvp: boolean;
  onWaitlistOpen: () => void;
}

const CITY_TREE_AFTER = [3, 9, 12];
const MOUNTAIN_CLIP =
  "polygon(0% 100%, 0% 58%, 9% 32%, 18% 50%, 27% 16%, 36% 44%, 47% 8%, 58% 40%, 67% 20%, 78% 46%, 88% 24%, 100% 54%, 100% 100%)";

export function NightfallHero({ isMvp, onWaitlistOpen }: NightfallHeroProps) {
  const buildings = buildSkylineBuildings();
  const stars = buildStarField();
  const trees = buildParkTrees();
  const shrubs = buildParkShrubs();

  return (
    <header
      className="relative overflow-hidden bg-[#060a14] [font-family:var(--font-nightfall-body)]"
      style={{ minHeight: "max(92vh, 720px)" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 animate-[nc-day-cycle_46s_ease-in-out_infinite] bg-[linear-gradient(180deg,#3c5f86_0%,#4f7593_40%,#a3714f_68%,#1c2634_100%)]" />
        <div className="absolute inset-0 animate-[nc-sunset-cycle_46s_ease-in-out_infinite] bg-[radial-gradient(circle_at_32%_22%,rgba(255,196,120,0.35),transparent_30%),linear-gradient(180deg,#2c3c5e_0%,#5a4864_38%,#a5613f_66%,#141c2b_100%)]" />
        <div className="absolute inset-0 animate-[nc-night-cycle_46s_ease-in-out_infinite] bg-[radial-gradient(circle_at_72%_15%,rgba(158,185,224,0.14),transparent_24%),linear-gradient(180deg,#060c1c_0%,#0f1c33_46%,#1c2338_68%,#05070f_100%)]" />

        <div className="absolute inset-0 animate-[nc-stars-cycle_46s_ease-in-out_infinite]">
          {stars.map((star, i) => (
            <span
              key={i}
              className="absolute animate-[nc-star-glimmer_4.4s_ease-in-out_infinite] rounded-full bg-white"
              style={{ left: star.left, top: star.top, width: star.size, height: star.size }}
            />
          ))}
        </div>

        <div className="absolute left-0 top-[30%] size-[58px] animate-[nc-sun-orbit_46s_linear_infinite] rounded-full bg-[#ffe7a0] shadow-[0_0_55px_16px_rgba(255,204,94,0.32)]" />
        <div className="absolute left-0 top-[26%] size-[46px] animate-[nc-moon-orbit_46s_linear_infinite] rounded-full bg-[radial-gradient(circle_at_34%_30%,#fff8ea,#e7eef8_65%)] shadow-[0_0_42px_12px_rgba(185,211,242,0.22)]" />

        <div className="absolute top-[16%] h-[14px] w-[130px] animate-[nc-cloud-drift_38s_linear_infinite] rounded-full bg-white/10 blur-[1px]" />
        <div className="absolute top-[27%] h-[10px] w-[90px] animate-[nc-cloud-drift_52s_linear_infinite] [animation-delay:-18s] rounded-full bg-white/[0.07] blur-[1px]" />
        <div className="absolute left-0 top-[22%] h-px w-[60px] animate-[nc-flight-crossing_24s_linear_infinite] [animation-delay:-6s] bg-[linear-gradient(90deg,transparent,rgba(255,222,168,0.6),#fff)]" />

        <div className="absolute -left-[12vw] -top-[14vw] size-[46vw] max-h-[520px] max-w-[520px] animate-[nc-sky-breathe_13s_ease-in-out_infinite_alternate] rounded-full bg-[rgba(252,196,110,0.14)] blur-[80px]" />

        <div
          className="absolute bottom-[336px] left-0 h-[150px] w-full bg-[linear-gradient(180deg,#3a4d72,#263757)] opacity-85"
          style={{ clipPath: MOUNTAIN_CLIP }}
        />

        <div className="absolute bottom-[124px] left-0 h-[260px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(58,96,128,0.35)_0%,rgba(30,60,86,0.62)_28%,rgba(13,30,48,0.88)_100%)]" />
          <div
            className="absolute inset-x-0 -top-[2px] h-[96px] origin-top scale-y-[-1] bg-[linear-gradient(180deg,#3a4d72,transparent)] opacity-30 blur-[1.5px]"
            style={{ clipPath: MOUNTAIN_CLIP }}
          />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(255,222,168,0.5)_45%,rgba(255,222,168,0.65)_55%,transparent)]" />
          {[
            { left: "38%", top: 20, width: 46 },
            { left: "46%", top: 32, width: 30 },
            { left: "52%", top: 14, width: 60 },
            { left: "58%", top: 38, width: 22 },
          ].map((glint, i) => (
            <span
              key={i}
              className="absolute h-[2px] animate-[nc-sea-glint_3.6s_ease-in-out_infinite] rounded-full bg-[rgba(255,232,190,0.7)]"
              style={{
                left: glint.left,
                top: glint.top,
                width: glint.width,
                animationDelay: `-${(i * 0.8).toFixed(1)}s`,
              }}
            />
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[220px]">
          <svg
            className="absolute bottom-0 left-0 h-full w-full"
            viewBox="0 0 800 220"
            preserveAspectRatio="none"
          >
            <path
              d="M -10 220 C 90 190, 120 160, 200 150 S 320 130, 380 108 S 470 90, 560 78"
              fill="none"
              stroke="rgba(226,204,166,0.35)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="1 11"
            />
            <circle
              cx={120}
              cy={168}
              r={4.5}
              className="animate-[nc-beacon-pulse_3.2s_ease-in-out_infinite] fill-[#f7b955]"
              style={{ transformOrigin: "center" }}
            />
            <circle cx={300} cy={132} r={3.5} className="fill-[#f7b955] opacity-55" />
            <circle cx={470} cy={92} r={3.5} className="fill-[#f7b955] opacity-55" />
          </svg>

          <div className="absolute inset-0">
            {trees.map((tree, i) => (
              <div
                key={`tree-${i}`}
                className="absolute bottom-[34px]"
                style={{ [tree.side]: `${tree.pct}%` }}
              >
                <span
                  className="absolute bottom-0 left-1/2 h-[22px] w-1 origin-bottom -translate-x-1/2 animate-[nc-trunk-flex_9s_ease-in-out_infinite] rounded-[3px] bg-[#263f30]"
                  style={{ animationDelay: tree.alt ? "-5.5s" : "0s" }}
                />
                <span
                  className="absolute left-1/2 top-0 size-[34px] origin-bottom -translate-x-1/2 animate-[nc-tree-sway_9s_ease-in-out_infinite] rounded-[52%_48%_46%_54%]"
                  style={{
                    backgroundColor: tree.alt ? "#3d6a4a" : "#315b43",
                    animationDelay: tree.alt ? "-5.5s" : "0s",
                  }}
                />
              </div>
            ))}
            {shrubs.map((shrub, i) => (
              <span
                key={`shrub-${i}`}
                className="absolute bottom-[30px] h-[14px] animate-[nc-shrub-breathe_8s_ease-in-out_infinite_alternate] rounded-[70%_70%_20%_20%] bg-[#2f513d]"
                style={{
                  [shrub.side]: `${shrub.pct}%`,
                  width: shrub.width,
                  animationDelay: `-${(i * 1.3).toFixed(1)}s`,
                }}
              />
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex h-[190px] items-end justify-center gap-[5px]">
            {buildings.map((building, index) => (
              <div key={index} className="flex flex-col items-stretch">
                <div
                  className="grid animate-[nc-windows-cycle_46s_ease-in-out_infinite] grid-cols-3 gap-[3px] rounded-t-[4px] bg-[linear-gradient(180deg,#1a2740,#0d1626)] p-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  style={{ width: 34, height: building.height }}
                >
                  {building.windows.map((lit, i) => (
                    <div
                      key={i}
                      className={
                        lit
                          ? "size-[5px] animate-[nc-window-twinkle_6s_ease-in-out_infinite] rounded-[1px] bg-[#f7b955] shadow-[0_0_4px_1px_rgba(247,185,85,0.7)]"
                          : "size-[5px] rounded-[1px] bg-white/[0.06]"
                      }
                    />
                  ))}
                </div>
                {CITY_TREE_AFTER.includes(index) && (
                  <div className="relative mt-[3px] h-[32px] w-[20px]">
                    <span
                      className="absolute bottom-0 left-1/2 h-[10px] w-1 origin-bottom -translate-x-1/2 animate-[nc-trunk-flex_9s_ease-in-out_infinite] rounded-[3px] bg-[#263f30]"
                      style={{ animationDelay: `-${(index * 1.7).toFixed(1)}s` }}
                    />
                    <span
                      className="absolute left-1/2 top-0 size-[22px] origin-bottom -translate-x-1/2 animate-[nc-tree-sway_9s_ease-in-out_infinite] rounded-[52%_48%_46%_54%]"
                      style={{
                        backgroundColor: index % 2 === 1 ? "#3d6a4a" : "#315b43",
                        animationDelay: `-${(index * 1.7).toFixed(1)}s`,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-0 h-[70px] bg-[linear-gradient(180deg,transparent_0%,rgba(4,7,14,0.88)_55%,#04070e_100%)]" />
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(5,8,17,0.92)_0%,rgba(5,8,17,0.62)_42%,rgba(5,8,17,0.12)_78%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-24">
        <div className="max-w-[640px]">
          <h1 className="max-w-[15ch] text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.03] text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
            Your life is a game.
            <br />
            Time to start{" "}
            <em className="bg-[linear-gradient(90deg,#f7b955,#ffdca0)] bg-clip-text not-italic text-transparent">
              playing
            </em>
            .
          </h1>
          <p className="mt-5 max-w-[42ch] text-[1.08rem] leading-relaxed text-[#93a3c4]">
            Earn XP and coins for every journal entry, task and habit you complete. Spend them
            building a city that grows as you grow.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {isMvp ? (
              <Link
                href="/login"
                className="rounded-xl bg-[linear-gradient(180deg,#ffc873,#f7b955)] px-6 py-3 font-bold text-[#1a1204] shadow-[0_8px_24px_rgba(247,185,85,0.25)]"
              >
                Start your quest &rarr;
              </Link>
            ) : (
              <button
                type="button"
                onClick={onWaitlistOpen}
                className="rounded-xl bg-[linear-gradient(180deg,#ffc873,#f7b955)] px-6 py-3 font-bold text-[#1a1204] shadow-[0_8px_24px_rgba(247,185,85,0.25)] hover:cursor-pointer"
              >
                Join the waitlist &rarr;
              </button>
            )}
            <a
              href="#how-it-works"
              className="rounded-xl border border-white/10 px-6 py-3 font-semibold text-[#f3f5fb]"
            >
              See how it works
            </a>
          </div>
          <p className="mt-10 text-xs uppercase tracking-wider text-[#93a3c4]">
            The skyline grows &mdash; and lights up &mdash; as you scroll through the page
          </p>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/marketing/NightfallHero.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/marketing/NightfallHero.tsx src/components/marketing/NightfallHero.test.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/NightfallHero.tsx src/components/marketing/NightfallHero.test.tsx
git commit -m "feat(marketing): add NightfallHero animated hero component"
```

---

## Task 4: Restyle `Navbar`

**Files:**
- Modify: `src/components/layout/Navbar.tsx` (full file — it's 39 lines)
- Test: `src/components/layout/Navbar.test.tsx` (new — no test file exists for this component today)

**Interfaces:**
- No interface change: `Navbar({ is_MVP, setWaitlistOpen }: { is_MVP: boolean; setWaitlistOpen: (open: boolean) => void })` keeps its existing signature.

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/Navbar.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

afterEach(cleanup);

describe("Navbar", () => {
  it("links both CTAs to /login when is_MVP is true", () => {
    render(<Navbar is_MVP setWaitlistOpen={() => undefined} />);
    const links = screen.getAllByRole("link", { name: /log in|get started/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/login");
    }
  });

  it("opens the waitlist instead of linking to /login when is_MVP is false", () => {
    const setWaitlistOpen = vi.fn();
    render(<Navbar is_MVP={false} setWaitlistOpen={setWaitlistOpen} />);
    screen.getByRole("button", { name: /join the waitlist/i }).click();
    expect(setWaitlistOpen).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/Navbar.test.tsx`
Expected: FAIL — this actually may PASS already against the *current* unstyled Navbar, since the test only checks behavior, not styling. That's fine: this is a behavior-preservation regression test, not a red/green TDD cycle for new behavior. Confirm it passes against the current file before restyling (this guards the restyle in the next step from silently breaking the `is_MVP` branch).

Run: `npx vitest run src/components/layout/Navbar.test.tsx` — expect PASS already, then proceed to restyle knowing you have a safety net.

- [ ] **Step 3: Restyle the component**

Replace the full contents of `src/components/layout/Navbar.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function Navbar({ is_MVP, setWaitlistOpen }: { is_MVP: boolean; setWaitlistOpen: (open: boolean) => void }) {
    return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#060a14]/90 border-b border-white/[0.08]">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Image src="/images/logo2.png" alt="LifeQuest logo" width={170} height={170} className="rounded-sm" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#features" className="text-[#93a3c4] hover:text-[#f3f5fb]">Features</a>
            <a href="#how-it-works" className="text-[#93a3c4] hover:text-[#f3f5fb]">How it works</a>
            <a href="#roadmap" className="text-[#93a3c4] hover:text-[#f3f5fb]">Roadmap</a>
            <a href="#pricing" className="text-[#93a3c4] hover:text-[#f3f5fb]">Pricing</a>
          </nav>
          {is_MVP ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="text-[#f3f5fb] hover:bg-white/10 hover:text-[#f3f5fb]">
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild className="bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90">
                <Link href="/login">Get started</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center">
              <Button size="sm"
                onClick={() => setWaitlistOpen(true)}
                className="px-5 py-3 rounded-lg bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:cursor-pointer hover:opacity-90"
              >
                Join the waitlist
              </Button>
            </div>
          )}
        </div>
      </header>
    );
}
```

- [ ] **Step 4: Run test to verify it still passes**

Run: `npx vitest run src/components/layout/Navbar.test.tsx`
Expected: PASS (2 tests) — confirms the restyle didn't change either CTA's behavior.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/layout/Navbar.tsx src/components/layout/Navbar.test.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Navbar.tsx src/components/layout/Navbar.test.tsx
git commit -m "style(marketing): restyle Navbar to the Nightfall City dark palette"
```

---

## Task 5: Restyle `Roadmap`

**Files:**
- Modify: `src/components/marketing/Roadmap.tsx` (full file — it's 55 lines)

**Interfaces:** No change — `Roadmap` remains a zero-prop default export.

This is a pure visual restyle of existing static data with no logic to test (matches this codebase's established convention for style-only components — verify visually per Step 3 below, no new test file).

- [ ] **Step 1: Restyle the component**

Replace the full contents of `src/components/marketing/Roadmap.tsx`:

```tsx
import { motion } from "framer-motion";

type RoadmapItem = {
  quarter: string;
  title: string;
  desc: string;
  status?: string;
};

const items: RoadmapItem[] = [
  { quarter: "Q2 2026", title: "Landing Page", desc: "Waitlist, landing page.", status: "Live" },
  { quarter: "Q3 2026", title: "Functional MVP", desc: "Core functionality (6 default journal templates, create your own templates, city builder), user onboarding.", status: "Live" },
  { quarter: "Q4 2026", title: "Habit Tracker, Tasks, Daily Planner", desc: "Integrate habit tracking, task management, and daily planning features.", status: "Live" },
  { quarter: "Q2 2027", title: "Mobile Apps & Social", desc: "iOS & Android app, friend leaderboards, communities.", status: "Planned" },
  { quarter: "Q4 2027", title: "AI Coach & Personalization", desc: "AI-powered journaling prompts, insights, and personalized recommendations.", status: "Planned" },
  { quarter: "Q2 2028", title: "Integrations & Expansion", desc: "Integrate with popular health and productivity apps, expand to new platforms.", status: "Planned" },
  { quarter: "Q4 2028", title: "LifeQuest 2.0", desc: "Major update with new features, improved UX, and expanded content. LifeQuest as a all-around personal development platform.", status: "Planned" },
];

export default function Roadmap() {
  return (
    <section id="roadmap" className="container mx-auto px-4 py-24 max-w-6xl">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">Roadmap</h2>
        <p className="text-lg text-[#93a3c4] mt-4 max-w-2xl mx-auto">Here is what I will build next:</p>
      </div>

      <div className="space-y-8">
        {items.map((it, i) => (
          <motion.div
            key={i}
            initial={{ y: 12, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
            className="flex flex-col md:flex-row items-start gap-6"
          >
            <div className="w-28 shrink-0">
              <div className="text-sm text-[#93a3c4] font-medium">{it.quarter}</div>
              <div
                className={
                  it.status === "Live"
                    ? "mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-[rgba(247,185,85,0.14)] text-[#f7b955]"
                    : "mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-white/[0.06] text-[#93a3c4]"
                }
              >
                {it.status}
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-white/[0.08] p-6 bg-[#0d1626]">
              <h3 className="font-semibold text-lg mb-1 text-[#f3f5fb]">{it.title}</h3>
              <p className="text-sm text-[#93a3c4] leading-relaxed">{it.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/marketing/Roadmap.tsx`
Expected: no errors.

- [ ] **Step 3: Visual verification (deferred)**

`Roadmap` is rendered inside `page.tsx`'s Mission section, which isn't wired to the dark palette yet until Task 7. Note this file as done; visual confirmation happens in Task 7's browser check once the whole page is dark and this section no longer sits on a light background.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/Roadmap.tsx
git commit -m "style(marketing): restyle Roadmap to the Nightfall City dark palette"
```

---

## Task 6: Reconcile hero WIP, wire in `NightfallHero`, restyle Features and How it works

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `NightfallHero` (Task 3), `nightfallDisplay`/`nightfallBody` (Task 2).

- [ ] **Step 1: STOP — reconcile the existing hero WIP with the user before editing**

`src/app/page.tsx` may still carry the user's own uncommitted, in-progress hero redesign from before this plan existed (a `hero-phone-hand.png` image with blurred background blobs, a `TypewriterText`/`HeroTitle` animation). Run `git status` and `git diff src/app/page.tsx` first. If either is present, **stop and ask the user** what — if anything — from that WIP should be preserved, before deleting or replacing any of it. Do not proceed to Step 2 until this is resolved; silently overwriting someone else's in-progress work is exactly the failure mode this step exists to prevent.

- [ ] **Step 2: Apply the marketing fonts and dark background at the page root**

In `src/app/page.tsx`, add the import and update the root wrapper `div`. Find:

```tsx
import Navbar from "@/components/layout/Navbar";
```

Add immediately after it:

```tsx
import { NightfallHero } from "@/components/marketing/NightfallHero";
import { nightfallBody, nightfallDisplay } from "@/lib/marketing-fonts";
```

Find the root wrapper:

```tsx
    <div className="min-h-svh bg-linear-to-b from-background via-background to-primary/5">
```

Replace with:

```tsx
    <div className={`${nightfallDisplay.variable} ${nightfallBody.variable} min-h-svh bg-[#060a14]`}>
```

- [ ] **Step 3: Replace the hero section with `NightfallHero`**

Delete the entire existing `{/* HERO */}` section (the `motion.section` containing the `HeroTitle`/`TypewriterText`, the two-column grid, and the `hero-phone-hand.png` image) and the `TypewriterText`/`HeroTitle` function components above `LandingPage` — after Step 1's reconciliation, these are being deliberately replaced by the new hero, not preserved alongside it.

Replace the deleted hero section with:

```tsx
      <NightfallHero isMvp={is_MVP} onWaitlistOpen={() => setWaitlistOpen(true)} />
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        source="hero"
      />
```

(The `WaitlistModal` render moves here from inside the old hero's JSX — it has no visual presence of its own, so its exact position in the tree doesn't matter functionally, but it must still be rendered somewhere on the page.)

- [ ] **Step 4: Restyle the Features section**

Find the `<section id="features" ...>` block. Replace its contents (keep the `.map` structure and all five feature objects' `tile`/`title`/`desc`/`className`/`preview` values verbatim — only the surrounding classNames change):

```tsx
      <section id="features" className="container mx-auto px-4 py-24 max-w-6xl">
  <div className="text-left md:text-center mb-14">

    <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
      A journal that gives something back
    </h2>
    <p className="text-lg text-[#93a3c4] mt-4 max-w-2xl md:mx-auto">
      LifeQuest turns small daily check-ins into visible progress with XP, streaks,
      coins, and your virtual city that grows with you.
    </p>
  </div>

  <div className="grid md:grid-cols-6 gap-6">
    {[
      {
        tile: "🏙️",
        title: "Every entry adds to your city",
        desc: "Complete a journal entry, earn coins, place buildings, and watch your map fill up with amazing buildings.",
        className: "md:col-span-4",
        preview: "city",
      },
      {
        tile: "🔥",
        title: "Protect your streak",
        desc: "Show up daily to keep your streak alive. Miss a day and your multiplier resets.",
        className: "md:col-span-2",
        preview: "streak",
      },
      {
        tile: "📓",
        title: "Turn any journal into a quest",
        desc: "Build templates for morning check-ins, evening reviews, habits, workouts, or whatever you want to track.",
        className: "md:col-span-2",
        preview: "xp",
      },
      {
        tile: "🌙",
        title: "Plan tomorrow before bed",
        desc: "Use your evening review to set priorities and time-block tomorrow before the next day begins.",
        className: "md:col-span-2",
        preview: "plan",
      },
      {
        tile: "📊",
        title: "Spot what improves your days",
        desc: "Track mood, energy, habits, and activity over time so your patterns become obvious.",
        className: "md:col-span-2",
        preview: "analytics",
      },
    ].map((f) => (
      <div
        key={f.title}
        className={`
          group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1626] p-6
          transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(247,185,85,0.35)]
          ${f.className}
        `}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(247,185,85,0.6)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#111d33] text-2xl shadow-inner">
          {f.tile}
        </div>

        <h3 className="font-semibold text-xl mb-2 text-[#f3f5fb]">{f.title}</h3>
        <p className="text-sm text-[#93a3c4] leading-relaxed max-w-xl">
          {f.desc}
        </p>

        {f.preview === "city" && (
          <div className="mt-6 grid grid-cols-10 gap-1 max-w-sm">
            {["", "", "🏠", "🌳", "", "🏪", "", "🌳", "", "🏫",
              "", "🌷", "", "", "☕", "", "🏢", "", "", ""].map((tile, i) => (
              <div
                key={i}
                className="aspect-square rounded bg-[#111d33] border border-white/[0.06] flex items-center justify-center text-sm"
              >
                {tile}
              </div>
            ))}
          </div>
        )}

        {f.preview === "streak" && (
          <div className="mt-6 flex gap-1.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <div
                key={`${d}-${i}`}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold ${
                  i < 5
                    ? "bg-[rgba(247,185,85,0.14)] text-[#f7b955] border border-[rgba(247,185,85,0.3)]"
                    : "bg-[#111d33] text-[#93a3c4] border border-white/[0.06]"
                }`}
              >
                {d}
              </div>
            ))}
          </div>
        )}

        {f.preview === "xp" && (
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[rgba(247,185,85,0.25)] bg-[rgba(247,185,85,0.14)] px-2.5 py-1 text-[#f7b955]">
              +25 XP
            </span>
            <span className="rounded-full border border-[rgba(247,185,85,0.25)] bg-[rgba(247,185,85,0.14)] px-2.5 py-1 text-[#f7b955]">
              +10 coins
            </span>
            <span className="rounded-full border border-[rgba(143,160,255,0.25)] bg-[rgba(143,160,255,0.14)] px-2.5 py-1 text-[#8fa0ff]">
              Level progress
            </span>
          </div>
        )}

        {f.preview === "plan" && (
          <div className="mt-6 space-y-2 text-xs">
            {["07:30 Morning review", "18:00 Gym", "21:30 Evening quest"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-white/[0.06] bg-[#111d33] px-3 py-2 text-[#93a3c4]"
              >
                {item}
              </div>
            ))}
          </div>
        )}

        {f.preview === "analytics" && (
          <div className="mt-6 flex items-end gap-1.5 h-16">
            {[35, 52, 44, 70, 58, 82, 64].map((h, i) => (
              <div
                key={i}
                className="w-6 rounded-t bg-[rgba(247,185,85,0.14)] border border-[rgba(247,185,85,0.25)]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 5: Restyle the How it works section**

Find the `<section id="how-it-works" ...>` block. Keep every `Image src={s.image}` reference exactly as-is (the real `Step1.png`/`Step2.png`/`Step3.png` screenshots) — only the surrounding classNames and the step-number badge change:

```tsx
      <section id="how-it-works" className="bg-[#0d1626] py-24">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
              How it works
            </h2>
          </div>

          <div className="space-y-12">
            {[
              { step: "1", title: "Pick or build a template", desc: "Start with our morning, evening, or weekly review templates — or build your own with drag-and-drop.", emoji: "🎨", image:"/images/Step1.png" },
              { step: "2", title: "Journal for 2 minutes", desc: "Open the app, fill in your fields, hit submit. That's it. Earn coins, XP, and grow your streak.", emoji: "✍️", image:"/images/Step2.png" },
              { step: "3", title: "Watch your city grow", desc: "Spend coins on buildings. Unlock new ones at higher levels. Your discipline becomes a skyline.", emoji: "🏙️", image:"/images/Step3.png" },
            ].map((s, i) => {
              const isReversed = i % 2 === 1;
              return (
              <div
                key={i}
                className={`flex flex-col md:flex-row items-center gap-8 ${isReversed ? "md:flex-row-reverse" : ""}`}
              >
                <motion.div
                  initial={{ x: isReversed ? 100 : -100, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="w-full md:w-1/2 mt-10"
                >
                  <Image src={s.image} alt={s.title} width={900} height={506} className="object-cover rounded-2xl border border-white/[0.08] shadow-md" />
                </motion.div>

                <motion.div
                  initial={{ x: isReversed ? -100 : 100, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="w-full md:w-1/2 text-left"
                >
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[rgba(247,185,85,0.14)] text-[#f7b955] font-bold text-sm mb-4">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-2xl mb-3 text-[#f3f5fb]">{s.title}</h3>
                  <p className="text-sm text-[#93a3c4]">{s.desc}</p>
                </motion.div>
              </div>
            )})}
          </div>
        </div>
      </section>
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/app/page.tsx`
Expected: no errors. (Some errors are expected if Step 1's reconciliation left unused imports like `TypewriterText`'s dependencies — remove any now-unused imports the linter flags.)

- [ ] **Step 7: Visual check**

Run `npm run dev`, open `/`, and confirm: the hero renders full-height with the animated scene and no console errors; Features cards are dark with amber accents; How it works still shows the three real screenshots on a dark background.

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(marketing): wire in NightfallHero, restyle Features and How it works"
```

---

## Task 7: Restyle Mission, Pricing, and Final CTA; add the static skyline echo; restyle Footer

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Restyle the Mission section**

Find `{/* Our Mission */}`. Replace:

```tsx
      {/* Our Mission */}
      <section className="container mx-auto px-4 py-24 max-w-4xl text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
          My mission.
        </h2>
        <p className="text-lg text-[#93a3c4] mt-4">
          I believe that journaling and self-reflection are the most powerful tools for personal growth, but they only work if you actually do them. So I made a game out of it that holds you accountable and makes it fun to show up every day. My mission is to help millions of people turn journaling into the most addictive, rewarding habit they've ever had, and in doing so, become the best versions of themselves.
        </p>
        <p className="text-sm text-[#93a3c4] mt-6">
          - Patrick Eger, Founder of LifeQuest
        </p>
        <Roadmap />
      </section>
```

- [ ] **Step 2: Restyle the Pricing section**

Find `<section id="pricing" ...>`. Replace, keeping both plans' feature lists and prices verbatim:

```tsx
      {/* PRICING */}
      <section id="pricing" className="container mx-auto px-4 py-24 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
            Free to start. Forever.
          </h2>
          <p className="text-lg text-[#93a3c4] mt-4">
            We believe great habits shouldn't be paywalled.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-2xl border border-white/[0.08] bg-[#0d1626] p-8"
          >
            <h3 className="text-xl font-bold text-[#f3f5fb]">Free</h3>
            <p className="text-[#93a3c4] text-sm mt-1">For everyone</p>
            <p className="text-4xl font-extrabold mt-6 text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">$0<span className="text-base font-normal text-[#93a3c4]">/forever</span></p>
            <ul className="space-y-3 mt-6 text-sm">
              {[
                "Unlimited journal entries",
                "All 14+ field types",
                "City builder with all buildings",
                "Streaks, XP & analytics",
                "Day planner & tasks",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-[#f3f5fb]">
                  <Check className="h-4 w-4 text-[#f7b955]" /> {f}
                </li>
              ))}
            </ul>
            {is_MVP ? (
            <Button className="w-full mt-8 bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90" asChild>
              <Link href="/login">Get started for free</Link>
            </Button>):(
              <Button variant="outline" className="w-full mt-8 border-white/[0.08] text-[#f3f5fb] hover:bg-white/10" onClick={() => setWaitlistOpen(true)}>
                Join the waitlist
              </Button>
            )}
          </motion.div>

          <motion.div
            initial={{ x: 100, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-2xl border-2 border-[rgba(143,160,255,0.35)] p-8 relative bg-[linear-gradient(180deg,#0d1626,rgba(143,160,255,0.14))]"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#8fa0ff] text-[#0c1230] text-xs font-semibold px-3 py-1 rounded-full">
              COMING SOON
            </div>
            <h3 className="text-xl font-bold text-[#f3f5fb]">Pro</h3>
            <p className="text-[#93a3c4] text-sm mt-1">For the real ones.</p>
            <p className="text-4xl font-extrabold mt-6 text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">$5<span className="text-base font-normal text-[#93a3c4]">/month</span></p>
            <ul className="space-y-3 mt-6 text-sm">
              {[
                "Everything in Free",
                "AI-powered weekly summaries",
                "Export to PDF / Markdown",
                "Custom city themes",
                "Priority support",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-[#f3f5fb]">
                  <Check className="h-4 w-4 text-[#8fa0ff]" /> {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full mt-8 border-white/[0.08] text-[#93a3c4]" disabled>
              Join the waitlist
            </Button>
          </motion.div>
        </div>
      </section>
```

- [ ] **Step 3: Restyle the Final CTA section and add the static skyline echo**

Find `{/* FINAL CTA */}`. Replace:

```tsx
      {/* FINAL CTA */}
      <section className="container mx-auto px-4 py-24 max-w-4xl text-center">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="rounded-2xl border border-white/[0.08] p-8 bg-[#0d1626] group transform-gpu hover:scale-103 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 ease-out mx-auto max-w-3xl overflow-hidden"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 text-[#f3f5fb] [font-family:var(--font-nightfall-display)]">
            Your future self is waiting.
          </h2>
          <p className="text-base text-[#93a3c4] mt-2 max-w-xl mx-auto">
            Join the players turning daily journaling into the most addictive habit they've ever had.
          </p>
          <div className="mt-6">
            {is_MVP ? (
              <Button
                size="lg"
                asChild
                className="mt-4 group-hover:scale-102 transform transition-transform duration-150 inline-flex items-center justify-center bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90"
              >
                <Link href="/login">
                  Start your quest <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => setWaitlistOpen(true)}
                className="mt-4 group-hover:scale-102 transform transition-transform duration-150 inline-flex items-center justify-center hover:cursor-pointer bg-[linear-gradient(180deg,#ffc873,#f7b955)] text-[#1a1204] hover:opacity-90"
              >
                Join the waitlist now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-10 flex items-end justify-center gap-1 h-[70px] opacity-70" aria-hidden="true">
            {[18, 30, 22, 38, 16, 44, 26].map((h, i) => (
              <span
                key={i}
                className="w-4 rounded-t-[3px] bg-[linear-gradient(180deg,#1a2740,#0d1626)]"
                style={{ height: h }}
              />
            ))}
          </div>
        </motion.div>
      </section>
```

- [ ] **Step 4: Restyle the Footer**

Find `<footer className="border-t">`. Replace:

```tsx
      {/* FOOTER */}
      <footer className="border-t border-white/[0.08]">
        <div className="container mx-auto px-4 py-8 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#93a3c4]">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex  gap-2 font-bold ">
            <Image src="/images/logo2.png" alt="LifeQuest logo" width={170} height={80} className="rounded-sm" />
          </Link>
            <span>© 2026 LifeQuest</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-[#f3f5fb]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#f3f5fb]">Terms</Link>
            <Link href="/contact" className="hover:text-[#f3f5fb]">Contact</Link>
          </div>
        </div>
      </footer>
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/app/page.tsx`
Expected: no errors.

- [ ] **Step 6: Full visual check**

Run `npm run dev`, open `/`, and scroll the entire page. Confirm: every section (Features, How it works, Mission, Roadmap, Pricing, Final CTA, Footer) is on the dark palette with no leftover light-background sections; Pricing's Pro card shows the violet accent and Free card shows the amber accent; the Final CTA's static skyline echo renders as a row of bars, not animated. Then resize to a mobile width (or use browser dev tools' device toolbar) and confirm the hero's terrain stays below the text — this is the exact bug class fixed during mockup iteration (fixed-position terrain creeping into the text area on short viewports), so it must be re-checked here in the real implementation, not assumed carried over.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including every test file touched across this plan (`nightfall-scene.test.ts`, `NightfallHero.test.tsx`, `Navbar.test.tsx`) plus the full existing suite (guards against an unrelated regression).

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "style(marketing): restyle Mission, Pricing, Final CTA, and Footer to the Nightfall City palette"
```

---

## Plan self-review notes

- **Spec coverage:** every section named in the spec (Navbar, Hero, Features, How it works, Mission, Roadmap, Pricing, Final CTA, Footer) has a task. The spec's three named technical risks — new vs. reused keyframes, deterministic content, and the pre-existing hero WIP — are each addressed directly (Task 2's keyframe naming, Task 1's pure functions plus Task 3's determinism test, Task 6 Step 1's stop-and-ask checkpoint).
- **Type consistency:** `NightfallHero`'s props (`isMvp`, `onWaitlistOpen`) are used identically in its own test (Task 3) and at its call site in `page.tsx` (Task 6). `nightfallDisplay`/`nightfallBody` are created once in Task 2 and only ever read (via `.variable` in Task 6, via the CSS custom property in Tasks 3/5/7) — never redefined elsewhere.
- **No placeholders:** every step above contains complete, real code — no "restyle similarly to Task N" shorthand for content that differs between sections.

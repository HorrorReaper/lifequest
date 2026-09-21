# LifeQuest — App & Codebase Overview

> Research date: 2026-08-08 · **Updated: 2026-09-20** (branch `staging`)
> Purpose: Familiarization pass over the LifeQuest repo and product — architecture, feature inventory, data layer, current state, and known technical debt — grounded in `docs/` and the live source tree. Sections marked ⟳ were revised in the September update; the August findings that turned out to be wrong are listed in §7.
> Related: [[Landing Page]] · [[Rituale & Prompts]] · [[Lead Magnet – Unfuck Your Life Challenge]] · [[Competitive Landscape & USP]] · [[Audit + Ideas]]

## TL;DR

LifeQuest is a mobile-first personal operating system (Next.js 16 / React 19 / Supabase) where **journaling is the engine**: a structured journal entry can create tasks, check off habits, populate the day plan, feed a tagged insight library, and pay out XP/coins/avatar rewards — all from one entry. Around it sits a **daily loop** (Daily Plan ritual → habits/tasks → Evening Review) and, since September, a **weekly loop** (Weekly Plan → Weekly Review), both driven by dashboard prompts that admins can configure. Alongside the public MVP sits **LifeQuest Labs** (`/admin`), a private experimentation surface for workout, nutrition, knowledge, project tracking and — new — global ritual settings. The repo is well self-documented (`docs/`) and has a 925-test Vitest suite, but still carries known debt: several non-atomic multi-table writes, a not-fully-reproducible DB schema, duplicated gamification math, and two parallel lesson systems.

---

## 1. What the app is

A mobile-first personal OS built around journaling, daily and weekly planning, tasks, habits, learning, quests, and a gamification layer (XP, coins, levels, skills, an avatar to dress). `docs/README.md` is the canonical guide; `docs/routes.md` lists every route; `docs/backend/data-model.md` the tables; `docs/features/*.md` one file per feature area.

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router) — **not the Next.js in the training data**; read `node_modules/next/dist/docs/` before writing route code (repo rule in `AGENTS.md`) |
| UI runtime | React 19.2.4, TypeScript strict |
| Styling | Tailwind CSS v4 + CSS variables |
| UI primitives | Local shadcn-style components, `@base-ui/react` (Dialog, Switch, Select), Radix Slot |
| Auth/DB | Supabase Auth + Postgres + RLS + RPCs (`@supabase/supabase-js` 2.103, `@supabase/ssr`) |
| Local state | Zustand 5 (presentation state only, see §8) |
| Charts / DnD / motion | Recharts, dnd-kit, Framer Motion 12 |
| Email | Resend (REST, no SDK) for the waitlist confirmation |
| Markdown | react-markdown + remark-gfm |
| Testing | Vitest 4.1 + jsdom + React Testing Library (`npx vitest run`, 925 tests / 108 files) |
| Hosting | Vercel |

No e2e framework (Playwright/Cypress) — a known, explicitly documented testing gap.

## 3. High-level architecture

```
Browser
├── Public marketing/auth UI (landing, /login, /onboarding)
├── Authenticated client "manager" components (React state, sessionStorage/localStorage
│   drafts, Zustand XP/coins/streak presentation state, publishable Supabase client)
└── Next.js route requests
        │
Next.js server
├── Server Components (src/app/(app)/*) fetch initial authenticated data
├── Middleware refreshes Supabase sessions + enforces onboarding gate
├── Route handlers (src/app/api/*) validate auth/admin/consent/input
└── Server-only external provider calls (USDA, Open Food Facts, Resend)
        │
Supabase
├── Auth + JWT app_metadata (role = admin for trusted admins)
├── Postgres tables + Row Level Security
├── Security-invoker RPCs for atomic multi-table operations
└── Auth Admin API (used only by /api/account for deletion)
```

- Route pages under `src/app/(app)/` are mostly Server Components: validate session → fetch data → hand props to client "manager" components (`TaskManager`, `HabitManager`, `TodayPlanner`, `WorkoutHub`, `NutritionHub`, `RitualsHub`, …).
- App shell = bottom nav + admin chatbot, suppressed on immersive routes (`/plan`, journal entry screens, routine runners, all `/admin/*`). Admin has its own `AdminShell` with a sidebar of hubs.
- Cross-component sync: mutating components dispatch a `lifequest-data-updated` browser event; listeners or `router.refresh()` pick it up — no shared client-side cache/query library.

## 4. Feature inventory (user-facing) ⟳

- **Landing** (`/`) — light, amber-accented marketing page; hero with typed headline, "How it works" with real screenshots, six feature panels, mission, roadmap, "completely free" pricing. `NEXT_PUBLIC_IS_MVP=true` sends CTAs to `/login`, `false` to the waitlist modal. Details → [[Landing Page]].
- **Onboarding** (`/onboarding`) — 4-step first-run flow (welcome, name + timezone, the core loop, first template).
- **Dashboard** (`/dashboard`) — hero (level, XP, coins, streak, equipped avatar items) followed by **sections the user can toggle** in Settings (`src/lib/dashboard-sections.ts`, stored in `profiles.dashboard_sections`): Today's Plan, Habits, Tasks, Scorecard (metric targets), Metric chart, Daily Reflection (rotating question, fixed template id), Quests, Routines (admin). On top of that the four **ritual prompts** (Daily Plan, Evening Review, Weekly Review, Weekly Plan) open themselves in their windows → [[Rituale & Prompts]]. `/dashboard2` is a retained experiment.
- **Today's Plan** (`/plan`) — six-step daily ritual (`TodayPlanner`): Mood → Intention → Top Three (Main Quest required) → Anchors → Timeline (drag, 15-min grid) → Commit; stored in `day_plans` with a metadata envelope in `notes`.
- **Journal** (`/journal/*`) — template-based structured journaling. Entry form is **one question per step at every width** since 2026-09-20 (was mobile-only). Archive, insights (learning/problem/idea/decision/win), custom templates with 16 field types, `/journal/metrics` charts for `track_as_metric` number fields. System templates: Morning Reflection, Evening Review, Quick Insight, Daily Reflection, **Weekly Review**, **Weekly Plan** (the last three seeded by migration with fixed ids).
- **Tasks** (`/tasks`) — full task manager; tasks can also be captured inside an entry.
- **Habits** (`/habits`, `/habits/[habitId]`) — daily binary habits with streak-scaled XP (up to double), skill categories, history/analytics; routines run via `/routines/[routineId]/run` (admin-restricted by RLS).
- **Quests** (`/quests`) — default quests (code-defined, `getProgress` on a stats snapshot), custom quests, daily challenge quests, and **challenge programs** (`challenge_templates` / `challenge_days` / enrollments / day progress; manual check-off with a note).
- **Learning** (`/learn`, `/learn/[lessonId]`, `/learn/tools/*`) — article library, interactive paths (admin), and the registry-based self-improvement **tools** (Vision, …).
- **Avatar / Profile** (`/profile`) — replaced the City slot in the bottom nav (2026-08-30 avatar/nature redesign): level, skills, equipped items, coin shop. **`/city` still exists as a route but is retired from navigation** (roadmap: "The city returns").
- **Analytics** (`/analytics`) — journal stats, mood/activity charts, Skills tab with per-category XP.
- **Settings** (`/settings`) — appearance, profile, timezone, dashboard sections, AI consent, sign-out, account deletion.

Bottom nav: Home · Journal · **(quick action)** · Avatar · Settings. The quick action sheet links to journal, learn, tasks, plan, habits, routines, quests and — for admins — LifeQuest Labs.

## 5. LifeQuest Labs (`/admin`) — purpose and the trust-boundary gotcha ⟳

`/admin/*` is "Patrick's private feature laboratory": `productivity` (tasks/priorities/focus timer/goals/routines), **`rituals`** (global prompt settings, new), `workouts` (Hevy-inspired), `nutrition` (MyFitnessPal-inspired), `learning` (course authoring), `challenges` (program authoring), `notes` (Obsidian-inspired knowledge base), `projects` (outcomes/board/milestones), `tools` (dev/test controls, incl. "preview as user"). Admin actions never award XP/coins.

**Two distinct concepts, easy to conflate:**
- *"Admin route" access* = `isAdminUser` passes a **server allowlist check** (`ADMIN_EMAILS` / `ADMIN_USER_IDS` env, or the JWT role) → lets a user open `/admin` pages.
- *"Trusted admin"* = the Supabase JWT actually carries `app_metadata.role = admin` → required by **RLS policies and RPCs** for real writes (challenge templates, ritual settings, learning catalog, nutrition providers).

An allowlisted-but-not-trusted user can navigate the `/admin` UI but gets DB permission errors on writes. The rituals hub handles this explicitly (read-only mode); other hubs do not.

**Preview as user:** cookie `lifequest-preview-as-user` + `showAdminUi()` hide all admin UI so an admin sees exactly what a normal user sees. This is a *view filter*, never an authorization boundary — preview only removes privileges.

## 6. Data layer (Supabase) ⟳

- Postgres + RLS is the source of truth for essentially everything.
- **Atomic security-invoker RPCs** where multi-table integrity matters: workout start/finish, template save/clone, saved-meal/recipe logging, knowledge note save, project creation, quest reward and challenge-progress claims, habit check-in rewards, lesson rewards.
- **Still sequential / non-atomic by design-debt:** journal submission, routine item replacement, saved meal/recipe definition creation, imported-food upsert, ordinary task XP flow.
- **31 migration files** under `supabase/migrations/` (2026-06-27 → 2026-09-19), no `functions/` or seed dir. Foundational tables (`profiles`, `journal_*`, `tasks`, `habits`, `day_plans`, `waitlist_signups`) predate the visible migration history — **a fresh Supabase project cannot be recreated from this repo alone.**
- **Global admin configuration** now has one example: `ritual_settings` (one row per ritual, `select` for everyone signed in, `update` only for the JWT role). Pattern to reuse for future app-wide settings. Watch out: an `UPDATE` filtered out by RLS returns 204 with no error — always `.select()` the row back (`supabaseUpdateWhereReturning` in `helpers.ts`).
- **Per-user JSON preferences** pattern: `profiles.dashboard_sections jsonb` + a `normalize*()` function in TS that falls back per key and never throws (`dashboard-sections.ts`, `rituals.ts`).

## 7. Current repo state (as of 2026-09-20) ⟳

- **Branch model:** day-to-day work on **`staging`** (168 commits ahead of `master`; Vercel tracks `master` for production). Features as short branches off `staging`, merged with `--no-ff`, then `git push origin staging`. Recent: `feat/weekly-rituals`, `feat/ritual-settings`, `feat/ritual-preview`, `feat/journal-steps-everywhere`, plus the landing-page and avatar work directly on `staging`.
- **Specs & plans** live in `docs/superpowers/specs/` and `docs/superpowers/plans/` (date-prefixed). Larger features go spec → plan → subagent-driven implementation with per-task review.
- **Shipped since August:** dashboard sections + visibility settings, metric scorecard/targets, daily reflection, skill categories + streak-scaled habit XP, avatar states + profile page (city retired from nav), preview-as-user, weekly rituals, admin-configurable ritual settings with preview, journal wizard at every width, the light landing page.
- **In flight / next:** the "Unfuck Your Life" 14-day challenge as lead magnet → [[Lead Magnet – Unfuck Your Life Challenge]]; ritual spec 2 (user overrides for times) and spec 3 (admin editing of system templates) → [[Rituale & Prompts]].

**August findings that are now wrong**
- "`integration/metrics-and-tools` unpushed, migrations unverified" — long merged and live.
- "`/api/waitlist` never persists" — it writes `waitlist_signups` with the service-role key and sends a Resend confirmation. (`docs/routes.md` still carries the old sentence.)
- "Mobile journal wizard" — the stepper now runs at every width; files renamed to `journal-wizard.tsx` / `journal-navigation.tsx` / `journal-discard-dialog.tsx`. The hand-maintained insight-type `Set` in the wizard still exists (a 6th insight type must be added there too).
- "City is a core feature" — `/city` is parked; the avatar/profile page took its slot.

### Known constraints / technical debt (`docs/reference/known-limitations.md` + observed)

- DB not reproducible from repo alone (§6); multiple non-atomic write flows (§6).
- Admin allowlist vs. trusted-claim split remains a confusion point (§5).
- `src/lib/gamification.ts` still duplicates level/XP math with `src/lib/city/city.ts`.
- Two parallel lesson systems: `src/lib/lessons.ts` and `src/lib/learning-paths.ts`.
- `src/lib/supabase/helpers.ts` is written with `as any` throughout (16 `no-explicit-any` lint errors); a typing pass is owed.
- PWA manifest references missing icon files; no service worker/offline shell.
- No e2e tests, no automated RLS tests, no route tests for barcode/food-import handlers, journal's multi-table submission untested end-to-end.
- No error monitoring/tracing/analytics/alerting integration.
- Experimental duplicates still around: `/landing2`, `/dashboard2`, `NightfallHero`.
- Footer links to `/contact`, which does not exist as a route.
- Knowledge hub loads notes client-side; needs server-side search/pagination at scale.
- USDA/Open Food Facts providers have no app-level rate limiter/cache; USDA disabled without an API key.
- `TaskEditorDialog.test.tsx` ("date-only due date") was flaky once in a full-suite run (passes in isolation).

## 8. Notable engineering conventions ⟳

- **Dates:** everything goes through `src/lib/dates.ts` — `dateInTimezone(date, tz)` for "today" in the profile timezone, `dayNumber`/`addDays` for arithmetic (DST-immune), `weekdayOf` (Mon = 0 … Sun = 6) and `weekStart` for the weekly loop. `YYYY-MM-DD` strings are never parsed as UTC midnight; date pickers parse at local noon. **Never** `Date.getDay()`.
- **Transactions:** integrity-critical flows use atomic RPCs; others remain sequential client-side writes as known debt.
- **State split:** Supabase is authoritative; Zustand (`user-store.ts`) is presentation-only (XP/coins/streak/level-up), refreshed by the bottom nav after mount. Invalidation = `lifequest-data-updated` event + `router.refresh()`.
- **Draft persistence** is workflow-specific and not synced across devices: journal drafts → `sessionStorage`; Today Planner → `sessionStorage`; knowledge notes → `localStorage`; "Not now" on ritual prompts → `localStorage` with a self-expiring period key.
- **Rendering split:** Server Components own auth/data-fetch; "manager" Client Components own interactivity. Hydration-sensitive UI (prompts) renders the "closed" state on the server so nothing flashes.
- **Config normalization:** stored JSON/rows are read through a `normalize*()` that keeps what validates and falls back per field — never trust a row, never throw on the dashboard.
- **Fixed ids over name lookups** for anything the app seeds itself (Daily Reflection, Weekly Review, Weekly Plan templates); the hand-made Evening Review is the one remaining name lookup (now resolved once at seed time into `ritual_settings`).
- **"Tools" extension-point pattern:** one React component + one line in `TOOL_REGISTRY`, backed by a generic `tool_entries` table — not a new learning-path exercise type.
- **Design system:** `src/app/globals.css` for theme vars/animation/safe-areas; `src/components/ui/` for primitives; `ThemeProvider` for light/system/dark; `AppShell`/`BottomNav`/`AdminShell` for navigation. Mobile-first (`min-h-svh`/`min-h-dvh`, sticky actions, large touch targets).
- **Testing style:** Vitest + RTL, one `*.test.ts(x)` next to the file, TDD for new logic; jsdom loads no CSS, so Tailwind-driven visibility is asserted via class lists; `test/local-storage-stub.ts` replaces the unusable Node-22 global `localStorage`.
- **Commits:** small, with messages that explain *why*; `Co-Authored-By: Claude …` trailer when Claude wrote the commit.
- **Product line (standing):** no punitive mechanics (no HP/death, missed days just wait), no social features until there is a user base, keep XP/coins/streak names as they are.
- **Precedent worth remembering:** `src/lib/city.ts` vs `src/lib/city/city.ts` once desynced the dashboard's "next unlock" preview from `/city`; consolidated onto `city/city.ts`. The still-open `gamification.ts` duplication is the same failure mode.

---

## Appendix — code structure snapshot ⟳

**`src/app/(app)/`:** `admin, analytics, city, dashboard, dashboard2, habits, journal, learn, learnings, plan, profile, quests, routines, settings, tasks` (+ shared `layout.tsx`, `error.tsx`, `loading.tsx`). Other `src/app/` roots: `api`, `auth`, `landing2`, `login`, `onboarding`, `privacy`, `reset-password`, `terms`, plus root `page.tsx` (landing) / `layout.tsx` / `globals.css`.

**`src/app/(app)/admin/`:** `productivity` (+ `focus`), `rituals`, `workouts`, `nutrition`, `learning`, `challenges`, `notes`, `projects`, `tools`.

**`src/app/api/`:** `waitlist`, `chat`, `goals/[goalId]`, `account`, `admin/preview`, `admin/nutrition` (foods search/barcode/import).

**`src/lib/` top-level files (selected):** `admin.ts` (allowlist + preview cookie), `avatar.ts`, `dates.ts`, `dashboard-sections.ts`, `dashboard-habits.ts` / `dashboard-tasks.ts`, `daily-reflection.ts`, `day-plans.ts`, `field-registry.ts`, `gamification.ts`, `goals.ts`, `habit-*.ts`, `insights.ts`, `learning-*.ts` / `lessons.ts`, `metrics.ts` / `metric-targets.ts`, `mood.ts` / `mood-reasons.ts`, `quests.ts`, `rituals.ts` / `weekly-rituals.ts`, `routines.ts`, `skill-categories.ts`, `streak.ts`, `task-manager.ts` / `tasks.ts`, `today-plan.ts`, `types.ts` — most with a co-located `*.test.ts`.

**`src/lib/` subfolders:** `stores/` (Zustand), `supabase/` (`client`, `server`, `middleware`, `helpers`, `database.types`), `city/`, `knowledge/`, `nutrition/`, `projects/`, `tools/`.

**`src/components/` subfolders:** `admin, ai, analytics, auth, city, dashboard, dev, habits, journal, layout, learn, learnings, marketing, onboarding, planning, providers, quests, routines, settings, tasks, template-builder, tools, ui, waitlist`.

**`supabase/`:** only `migrations/` (31 `.sql` files). **`docs/`:** `README.md`, `architecture.md`, `routes.md`, `product-overview.md`, `getting-started.md`, `backend/`, `features/`, `operations/`, `reference/`, `superpowers/{specs,plans}`. **`test/`:** shared stubs (`server-only`, `local-storage-stub`).

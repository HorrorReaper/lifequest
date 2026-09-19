# Dashboard Section Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people turn the dashboard's six permanent content sections on and off from Settings.

**Architecture:** A code registry (`src/lib/dashboard-sections.ts`) is the single source of truth for which sections exist. Preferences live in one JSONB column on `profiles`, normalised on read so a missing id means visible. The dashboard reads the column it already fetches, skips the three fetches that belong to exactly one section, and gates the six renders.

**Tech Stack:** Next.js 16 App Router (server components, `searchParams`/`cookies` are async), Supabase (SSR + browser client), Tailwind v4, Base UI (`@base-ui/react`), Vitest 4 + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-06-dashboard-section-visibility-design.md`

## Global Constraints

- **No `@testing-library/jest-dom`.** Assertions use plain DOM properties: `expect(el).toHaveProperty('value', 'x')`, `expect(el.getAttribute('aria-checked')).toBe('true')`, `expect(screen.getByText('…')).toBeTruthy()`.
- **A missing section id means visible.** A section shipped after someone last saved their settings must appear, never vanish silently.
- **Section ids are exactly:** `today_plan`, `habits`, `tasks`, `metric`, `quests`, `routines`. `routines` is `adminOnly`.
- **The write sends the whole map**, not the single changed key.
- **Run tests with `npx vitest run <path>`**, typecheck with `npx tsc --noEmit`, lint with `npm run lint`. Lint has 32 pre-existing errors in `src/lib/city/unlock-engine.ts` and `src/lib/supabase/helpers.ts` — ignore those, only check that your files produce none.
- **Git identity is not configured.** Every commit must pass it inline:
  `git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "…"`
- **Work on a branch** off `staging`: `git checkout -b feat/dashboard-section-visibility`.

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/dashboard-sections.ts` (create) | The registry and four pure functions. No Supabase import. |
| `src/lib/dashboard-sections.test.ts` (create) | Tests for the above. |
| `supabase/migrations/20260906120000_add_profile_dashboard_sections.sql` (create) | The column. |
| `src/lib/supabase/database.types.ts` (modify) | `dashboard_sections` on the `profiles` Row/Insert/Update. |
| `src/components/settings/DashboardSectionsCard.tsx` (create) | The settings card: switches, optimistic save, rollback. |
| `src/components/settings/DashboardSectionsCard.test.tsx` (create) | Tests for the card. |
| `src/components/settings/settings-form.tsx` (modify) | Accept the prop, render the card. |
| `src/app/(app)/settings/page.tsx` (modify) | Pass the prop. |
| `src/app/(app)/dashboard/page.tsx` (modify) | Read, skip fetches, gate renders, empty notice. |

**Deviation from the spec, deliberate.** The spec says "a new card in `settings-form.tsx`". That file is already 422 lines and pulls in the theme provider, the router and Supabase, so testing a card inside it would mean mocking all of them. The card gets its own file and its own test; `settings-form.tsx` only renders it.

---

### Task 1: The registry and its normaliser

Pure module, no database. Everything the rest of the feature decides is decided here.

The spec names three functions; this adds a fourth, `sectionsFor`, because
both the settings card and the empty-dashboard notice need "the sections this
user could see at all" and would otherwise each filter by `adminOnly`
themselves. `visibleSectionCount` is built on it.

**Files:**
- Create: `src/lib/dashboard-sections.ts`
- Test: `src/lib/dashboard-sections.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface DashboardSectionDef { id: string; label: string; description: string; adminOnly?: boolean }`
  - `const DASHBOARD_SECTIONS: DashboardSectionDef[]`
  - `type DashboardSectionVisibility = Record<string, boolean>`
  - `normalizeDashboardSections(value: unknown): DashboardSectionVisibility`
  - `isSectionVisible(prefs: DashboardSectionVisibility, id: string): boolean`
  - `sectionsFor(options: { isAdmin: boolean }): DashboardSectionDef[]`
  - `visibleSectionCount(prefs: DashboardSectionVisibility, options: { isAdmin: boolean }): number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/dashboard-sections.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_SECTIONS,
  isSectionVisible,
  normalizeDashboardSections,
  sectionsFor,
  visibleSectionCount,
} from '@/lib/dashboard-sections'

describe('DASHBOARD_SECTIONS', () => {
  it('lists the six sections, with routines marked admin-only', () => {
    expect(DASHBOARD_SECTIONS.map((section) => section.id)).toEqual([
      'today_plan',
      'habits',
      'tasks',
      'metric',
      'quests',
      'routines',
    ])
    expect(
      DASHBOARD_SECTIONS.filter((section) => section.adminOnly).map((s) => s.id)
    ).toEqual(['routines'])
  })

  it('gives every section a label and a description for the settings card', () => {
    for (const section of DASHBOARD_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0)
      expect(section.description.length).toBeGreaterThan(0)
    }
  })
})

describe('normalizeDashboardSections', () => {
  it('keeps the ids this build knows', () => {
    expect(normalizeDashboardSections({ habits: false, quests: true })).toEqual({
      habits: false,
      quests: true,
    })
  })

  it('drops an id this build no longer knows', () => {
    // A stored preference can outlive the section it referred to.
    expect(normalizeDashboardSections({ habits: false, city: false })).toEqual({
      habits: false,
    })
  })

  it('ignores a value that is not a boolean', () => {
    expect(normalizeDashboardSections({ habits: 'no', tasks: false })).toEqual({
      tasks: false,
    })
  })

  it('treats anything unreadable as all visible', () => {
    expect(normalizeDashboardSections(null)).toEqual({})
    expect(normalizeDashboardSections(undefined)).toEqual({})
    expect(normalizeDashboardSections('nonsense')).toEqual({})
    expect(normalizeDashboardSections(['habits'])).toEqual({})
    expect(normalizeDashboardSections(42)).toEqual({})
  })
})

describe('isSectionVisible', () => {
  it('treats a missing id as visible', () => {
    // The default has to be visible, or a section shipped after someone last
    // saved their settings would disappear for them.
    expect(isSectionVisible({}, 'habits')).toBe(true)
    expect(isSectionVisible({ tasks: false }, 'habits')).toBe(true)
  })

  it('hides only what was explicitly turned off', () => {
    expect(isSectionVisible({ habits: false }, 'habits')).toBe(false)
    expect(isSectionVisible({ habits: true }, 'habits')).toBe(true)
  })
})

describe('sectionsFor', () => {
  it('hides the admin-only section from everyone else', () => {
    const ids = sectionsFor({ isAdmin: false }).map((section) => section.id)
    expect(ids).not.toContain('routines')
    expect(ids).toHaveLength(5)
  })

  it('gives an admin the full list', () => {
    expect(sectionsFor({ isAdmin: true })).toHaveLength(6)
  })
})

describe('visibleSectionCount', () => {
  it('counts everything when nothing has been turned off', () => {
    expect(visibleSectionCount({}, { isAdmin: false })).toBe(5)
    expect(visibleSectionCount({}, { isAdmin: true })).toBe(6)
  })

  it('does not count a section the user could not see anyway', () => {
    // Routines is admin-only, so leaving it on must not keep a non-admin
    // permanently above zero and swallow the "everything is hidden" notice.
    const allOff = {
      today_plan: false,
      habits: false,
      tasks: false,
      metric: false,
      quests: false,
    }
    expect(visibleSectionCount(allOff, { isAdmin: false })).toBe(0)
    expect(visibleSectionCount(allOff, { isAdmin: true })).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/dashboard-sections.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/dashboard-sections"`.

- [ ] **Step 3: Write the module**

Create `src/lib/dashboard-sections.ts`:

```ts
export interface DashboardSectionDef {
  id: string
  label: string
  description: string
  adminOnly?: boolean
}

/**
 * The dashboard sections a user may turn off, and the only place that list
 * lives.
 *
 * The database stores a map keyed by these ids and never learns the list
 * itself, so adding a section is a line here rather than a migration.
 * Excluded on purpose: the hero, and the prompts that already show and hide
 * themselves by time of day or first visit -- a permanent switch on
 * something that hides itself invites turning off a prompt and then
 * forgetting it exists.
 */
export const DASHBOARD_SECTIONS: DashboardSectionDef[] = [
  {
    id: 'today_plan',
    label: "Today's Plan",
    description: 'The shape of your day, block by block.',
  },
  {
    id: 'habits',
    label: 'Habits',
    description: "Today's habits, checkable without leaving the page.",
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'What is due today, and what is already overdue.',
  },
  {
    id: 'metric',
    label: 'Metric',
    description: 'A chart of the metric you are tracking.',
  },
  {
    id: 'quests',
    label: 'Quests',
    description: 'Quests ready to claim, and the ones still running.',
  },
  {
    id: 'routines',
    label: 'Routines',
    description: 'Guided chains of habits.',
    adminOnly: true,
  },
]

/** Which sections a user turned off. Absent means on. */
export type DashboardSectionVisibility = Record<string, boolean>

const SECTION_IDS = DASHBOARD_SECTIONS.map((section) => section.id)

/**
 * Reads the stored map, keeping only what this build can act on.
 *
 * An id from a section that no longer exists is dropped rather than carried
 * around, and anything that is not a map at all is treated as "nothing has
 * been turned off" -- which is also what a fresh account has.
 */
export function normalizeDashboardSections(
  value: unknown
): DashboardSectionVisibility {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const stored = value as Record<string, unknown>
  const visibility: DashboardSectionVisibility = {}
  for (const id of SECTION_IDS) {
    if (typeof stored[id] === 'boolean') visibility[id] = stored[id]
  }
  return visibility
}

/**
 * Whether a section should render.
 *
 * Absent means visible, deliberately: a section added after someone last
 * saved their settings must appear for them, not go missing.
 */
export function isSectionVisible(
  prefs: DashboardSectionVisibility,
  id: string
): boolean {
  return prefs[id] !== false
}

/** The sections this user could see at all, admin-only ones included or not. */
export function sectionsFor({
  isAdmin,
}: {
  isAdmin: boolean
}): DashboardSectionDef[] {
  return DASHBOARD_SECTIONS.filter((section) => !section.adminOnly || isAdmin)
}

/**
 * How many sections this user is actually left with.
 *
 * Counts only what they could see anyway, so an admin-only section left on
 * cannot keep a non-admin above zero and swallow the notice that everything
 * is hidden.
 */
export function visibleSectionCount(
  prefs: DashboardSectionVisibility,
  options: { isAdmin: boolean }
): number {
  return sectionsFor(options).filter((section) =>
    isSectionVisible(prefs, section.id)
  ).length
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/dashboard-sections.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run lint 2>&1 | grep dashboard-sections`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard-sections.ts src/lib/dashboard-sections.test.ts
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(dashboard): registry of the sections a user may turn off

One place naming the six sections, and the read path for the stored map.
A missing id means visible, so a section added after someone last saved
their settings appears for them instead of going missing."
```

---

### Task 2: The column

Enabling change. No behaviour yet; verified by the typechecker and by reading the SQL.

**Files:**
- Create: `supabase/migrations/20260906120000_add_profile_dashboard_sections.sql`
- Modify: `src/lib/supabase/database.types.ts` (the `profiles` Row, Insert and Update blocks, around lines 65-110)

**Interfaces:**
- Consumes: nothing.
- Produces: `profiles.dashboard_sections`, typed as `Record<string, boolean>` on Row and `Record<string, boolean> | undefined` on Insert/Update.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260906120000_add_profile_dashboard_sections.sql`:

```sql
alter table public.profiles
  add column dashboard_sections jsonb not null default '{}'::jsonb;

comment on column public.profiles.dashboard_sections is
  'Which dashboard sections the user turned off, keyed by the ids in src/lib/dashboard-sections.ts. An absent key means visible, so the default empty object shows everything and no backfill is needed.';
```

- [ ] **Step 2: Add the column to the generated types**

In `src/lib/supabase/database.types.ts`, find the `profiles` table block. Add one line to each of the three shapes, after `timezone`:

In `Row`:
```ts
          timezone: string
          dashboard_sections: Record<string, boolean>
          birth_year: number | null
```

In `Insert`:
```ts
          timezone?: string
          dashboard_sections?: Record<string, boolean>
          birth_year?: number | null
```

In `Update`:
```ts
          timezone?: string
          dashboard_sections?: Record<string, boolean>
          birth_year?: number | null
```

Note the file is hand-maintained, not generated — edit it directly.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output. Nothing reads the column yet, so nothing should break.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906120000_add_profile_dashboard_sections.sql src/lib/supabase/database.types.ts
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(dashboard): add profiles.dashboard_sections

Additive with a default of {}, which reads as everything visible, so no
backfill and nothing changes for existing accounts until they use the
new setting."
```

---

### Task 3: The settings card

Its own component, so the switches can be tested without the theme provider, the router and the rest of `settings-form.tsx`.

**Files:**
- Create: `src/components/settings/DashboardSectionsCard.tsx`
- Create: `src/components/settings/DashboardSectionsCard.test.tsx`
- Modify: `src/components/settings/settings-form.tsx` (the props interface around line 49, the destructure around line 59, and the JSX after the Appearance card which closes at line 230)
- Modify: `src/app/(app)/settings/page.tsx` (the `<SettingsForm …>` call at lines 28-37)

**Interfaces:**
- Consumes: `DASHBOARD_SECTIONS`, `sectionsFor`, `isSectionVisible`, `normalizeDashboardSections`, `DashboardSectionVisibility` from Task 1; `profiles.dashboard_sections` from Task 2.
- Produces: `DashboardSectionsCard(props: { userId: string; isAdmin: boolean; initial: DashboardSectionVisibility })`, and a new `dashboardSections: DashboardSectionVisibility` prop on `SettingsForm`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/settings/DashboardSectionsCard.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardSectionsCard } from '@/components/settings/DashboardSectionsCard'

const update = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/supabase/helpers', () => ({
  supabaseUpdateWhere: (...args: unknown[]) => update(...args),
}))

beforeEach(() => {
  update.mockReset().mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DashboardSectionsCard', () => {
  it('offers a switch for each section the user can see', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    expect(screen.getAllByRole('switch')).toHaveLength(5)
    expect(screen.getByRole('switch', { name: /habits/i })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: /routines/i })).toBeNull()
  })

  it('offers the admin-only section to an admin', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin initial={{}} />)

    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(screen.getByRole('switch', { name: /routines/i })).toBeTruthy()
  })

  it('shows a section with no stored preference as on', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    expect(
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
    ).toBe('true')
  })

  it('shows a section that was turned off as off', () => {
    render(
      <DashboardSectionsCard
        userId="user-1"
        isAdmin={false}
        initial={{ habits: false }}
      />
    )

    expect(
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
    ).toBe('false')
  })

  it('writes the whole map, not just the switch that moved', async () => {
    render(
      <DashboardSectionsCard
        userId="user-1"
        isAdmin={false}
        initial={{ quests: false }}
      />
    )

    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    // A patch of just { habits: false } would silently switch quests back on.
    expect(update.mock.calls[0][2]).toMatchObject({
      dashboard_sections: { quests: false, habits: false },
    })
    expect(update.mock.calls[0][1]).toBe('profiles')
    expect(update.mock.calls[0][4]).toBe('user-1')
  })

  it('moves the switch straight away rather than after the round trip', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))

    expect(
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
    ).toBe('false')
  })

  it('puts the switch back and explains when the write fails', async () => {
    update.mockResolvedValue({ error: { message: 'offline' } })
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))

    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
      ).toBe('true')
    )
    expect(screen.getByText(/could not save/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/settings/DashboardSectionsCard.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/settings/DashboardSectionsCard"`.

- [ ] **Step 3: Write the component**

Create `src/components/settings/DashboardSectionsCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import {
  isSectionVisible,
  sectionsFor,
  type DashboardSectionVisibility,
} from '@/lib/dashboard-sections'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface DashboardSectionsCardProps {
  userId: string
  isAdmin: boolean
  initial: DashboardSectionVisibility
}

/**
 * Which sections the dashboard shows.
 *
 * Saving is optimistic with a rollback rather than write-then-update like
 * the AI consent card next door: that is one weighty decision where waiting
 * is right, this is six switches where a visible round trip behind each
 * would be tiresome.
 */
export function DashboardSectionsCard({
  userId,
  isAdmin,
  initial,
}: DashboardSectionsCardProps) {
  const [supabase] = useState(() => createClient())
  const [visibility, setVisibility] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  const sections = sectionsFor({ isAdmin })

  async function toggle(id: string, next: boolean) {
    const previous = visibility
    // The whole map goes to the database. Sending only the key that moved
    // would drop every other choice back to its default.
    const updated = { ...visibility, [id]: next }

    setVisibility(updated)
    setError(null)

    const { error: saveError } = await supabaseUpdateWhere(
      supabase,
      'profiles',
      {
        dashboard_sections: updated,
        updated_at: new Date().toISOString(),
      },
      'id',
      userId
    )

    if (saveError) {
      setVisibility(previous)
      setError('We could not save which sections to show. Please try again.')
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Start screen</CardTitle>
        <CardDescription>
          Choose what your dashboard shows. Hiding a section does not delete
          anything; it stays reachable from the menu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.id}
            className="flex items-start justify-between gap-4 rounded-xl border bg-muted/25 p-4"
          >
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor={`dashboard-section-${section.id}`}
                className="text-sm font-semibold"
              >
                {section.label}
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {section.description}
              </p>
            </div>
            <Switch
              id={`dashboard-section-${section.id}`}
              checked={isSectionVisible(visibility, section.id)}
              onCheckedChange={(next) => void toggle(section.id, next)}
            />
          </div>
        ))}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/settings/DashboardSectionsCard.test.tsx`
Expected: PASS, 7 tests.

If a switch is not found by name, check that Base UI's `Switch` is associating the `Label` through `htmlFor`/`id`. If it is not, add `aria-label={section.label}` to the `Switch` and keep the visible `Label` as well.

- [ ] **Step 5: Wire it into the settings form**

In `src/components/settings/settings-form.tsx`:

Add to the imports at the top:
```tsx
import { DashboardSectionsCard } from '@/components/settings/DashboardSectionsCard'
import type { DashboardSectionVisibility } from '@/lib/dashboard-sections'
```

Add to `SettingsFormProps` (after `isAdmin: boolean`):
```tsx
  dashboardSections: DashboardSectionVisibility
```

Add to the destructured parameters (after `isAdmin,`):
```tsx
  dashboardSections,
```

Render the card immediately after the Appearance `</Card>` (line 230) and before the `{isAdmin && (` admin block:
```tsx
      <DashboardSectionsCard
        userId={userId}
        isAdmin={isAdmin}
        initial={dashboardSections}
      />
```

- [ ] **Step 6: Pass it from the settings page**

In `src/app/(app)/settings/page.tsx`, add to the imports:
```tsx
import { normalizeDashboardSections } from '@/lib/dashboard-sections'
```

Add one prop to the `<SettingsForm …>` call, after `isAdmin={showAdmin}`:
```tsx
          dashboardSections={normalizeDashboardSections(profile?.dashboard_sections)}
```

- [ ] **Step 7: Typecheck, test and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx vitest run`
Expected: PASS, all files.

Run: `npm run lint 2>&1 | grep -iE "DashboardSectionsCard|settings-form|settings/page"`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/DashboardSectionsCard.tsx src/components/settings/DashboardSectionsCard.test.tsx src/components/settings/settings-form.tsx "src/app/(app)/settings/page.tsx"
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(settings): switches for what the dashboard shows

Its own component rather than another card inside a 422-line file, so
the switches can be tested without the theme provider and the router.

Saving is optimistic with a rollback: six switches should not each sit
behind a visible round trip. The whole map is written, because a patch
of just the key that moved would drop every other choice back to its
default."
```

---

### Task 4: The dashboard obeys it

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
  - read the preferences after `const isAdmin = await showAdminUi(user)` (line 109)
  - guard `fetchQuestPageData` (line 121)
  - guard the metric block (lines 126-137)
  - guard `fetchRoutines` inside the `Promise.all` (line 196)
  - gate the six renders (lines 325-361)
  - add the notice

**Interfaces:**
- Consumes: `normalizeDashboardSections`, `isSectionVisible`, `visibleSectionCount`, `sectionsFor` from Task 1; `profiles.dashboard_sections` from Task 2.
- Produces: nothing other tasks depend on.

**How this task is verified.** This page is a server component wrapping a dozen Supabase queries; the spec decided not to unit test it, and the decisions it makes were already tested in Task 1. The gate here is the typechecker, the full suite staying green, and the manual check in Step 7. Do not invent a test that mocks the whole page — it would assert the mocks, not the page.

- [ ] **Step 1: Read the preferences**

Add to the imports near the other `@/lib` imports:
```tsx
import {
  isSectionVisible,
  normalizeDashboardSections,
  sectionsFor,
  visibleSectionCount,
} from '@/lib/dashboard-sections'
```

Directly after `const isAdmin = await showAdminUi(user)` (line 109), add:
```tsx
  const sectionPrefs = normalizeDashboardSections(profile.dashboard_sections)
  const shows = (id: string) => isSectionVisible(sectionPrefs, id)
```

- [ ] **Step 2: Skip the quest fetch when quests are hidden**

Replace line 121:
```tsx
  const { annotated, customQuests } = await fetchQuestPageData(supabase, user.id)
```
with:
```tsx
  // Its own sequential await, so skipping it shortens the page load rather
  // than only the page.
  const { annotated, customQuests } = shows('quests')
    ? await fetchQuestPageData(supabase, user.id)
    : { annotated: [], customQuests: [] }
```

- [ ] **Step 3: Skip the metric fetches when the metric is hidden**

Replace lines 126-128:
```tsx
  const trackedMetrics = await fetchTrackedMetrics(supabase, user.id)
  const trackedMetricSeries = await Promise.all(
    trackedMetrics.map((metric) => fetchMetricSeries(supabase, user.id, metric.fieldId))
  )
```
with:
```tsx
  // One query plus one per tracked metric, all sequential before the main
  // batch below -- the largest saving of the three.
  const trackedMetrics = shows('metric')
    ? await fetchTrackedMetrics(supabase, user.id)
    : []
  const trackedMetricSeries = await Promise.all(
    trackedMetrics.map((metric) => fetchMetricSeries(supabase, user.id, metric.fieldId))
  )
```

Leave the `primaryMetric` derivation below it untouched: with an empty
`trackedMetrics` it already yields `null`.

- [ ] **Step 4: Skip the routines fetch when routines are hidden**

Replace line 196:
```tsx
    isAdmin ? fetchRoutines(supabase, user.id, false) : Promise.resolve([]),
```
with:
```tsx
    isAdmin && shows('routines')
      ? fetchRoutines(supabase, user.id, false)
      : Promise.resolve([]),
```

- [ ] **Step 5: Gate the six renders**

In the JSX, wrap each of the six. `TodayPlanSection` at line 325:
```tsx
        {shows('today_plan') && (
          <TodayPlanSection blocks={planBlocks} nowMinutes={nowMinutes} />
        )}
```

`HabitsSection` at line 327:
```tsx
        {shows('habits') && (
          <HabitsSection
            userId={user.id}
            today={today}
            habits={dashboardHabits}
          />
        )}
```

`TasksSection` at line 333:
```tsx
        {shows('tasks') && (
          <TasksSection
            userId={user.id}
            dueTasks={dueTasks}
            undatedTasks={undatedTasks}
            openTaskCount={openTasksRes.count ?? 0}
          />
        )}
```

The metric block at line 340 — change the condition only:
```tsx
        {shows('metric') && primaryMetric && (
```

The routines line at line 356:
```tsx
        {isAdmin && shows('routines') && (
          <RoutinesDashboardWidget routines={dashboardRoutines} />
        )}
```

`QuestDashboardWidget` at line 358:
```tsx
        {shows('quests') && (
          <QuestDashboardWidget
            claimable={claimableQuests}
            activeCustom={activeCustomQuests}
          />
        )}
```

Leave the `{isAdmin && (<AdminLearningWidget … />)}` block at line 349 alone —
it is out of scope.

- [ ] **Step 6: Add the notice for a fully hidden dashboard**

Add `Link` to the imports if it is not already there:
```tsx
import Link from 'next/link'
```

At the end of the sections, after the `QuestDashboardWidget` block, add:
```tsx
        {/* Without this, someone who turned everything off sees a hero and
            some prompts and cannot tell that from a broken page. */}
        {visibleSectionCount(sectionPrefs, { isAdmin }) === 0 && (
          <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            All {sectionsFor({ isAdmin }).length} dashboard sections are
            hidden.{' '}
            <Link
              href="/settings"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Turn some back on
            </Link>
            .
          </p>
        )}
```

- [ ] **Step 7: Typecheck, test, lint and check by hand**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx vitest run`
Expected: PASS, all files.

Run: `npm run lint 2>&1 | grep -i "dashboard/page"`
Expected: no output.

By hand, with the migration applied (`npx supabase db push`) and signed in:
1. Open `/settings`, find "Start screen", turn **Quests** off.
2. Open `/dashboard` — the quests widget is gone, everything else is there.
3. Reload — it is still gone.
4. Turn every switch off, open `/dashboard` — the hero and prompts remain and the notice appears with a working link back.
5. Turn them all back on — everything returns.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(dashboard): honour the section switches

Quests, metric and routines skip their fetches entirely when hidden --
the first two are sequential awaits today, so that shortens the load and
not only the page. Habits, tasks and the day plan keep theirs, because
the evening review and the plan prompt read the same rows; hiding those
sections shortens the page and nothing else.

A fully hidden dashboard says so and links to settings, rather than
showing a hero above nothing and looking broken."
```

---

## Done

- Migration applied (`npx supabase db push`) — settings cannot save without it.
- `npx vitest run` green.
- `npx tsc --noEmit` clean.
- `npm run lint` produces nothing for the touched files.
- The manual walk in Task 4, Step 7 passes.

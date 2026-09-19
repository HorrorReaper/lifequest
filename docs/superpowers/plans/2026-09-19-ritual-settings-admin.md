# Ritual Settings (admin-editable) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trusted admins configure, for every user, when the four dashboard ritual prompts open, what they say, and which journal template they lead to.

**Architecture:** A `ritual_settings` table (one row per ritual, RLS: read for all signed-in users, update for JWT-role admins) seeded with today's hard-coded behaviour. A pure lib `src/lib/rituals.ts` normalizes the rows, decides whether a prompt's window is open, fills `{name}` into copy, and names the dismissal keys. The dashboard reads the settings instead of its constants; a new admin hub `/admin/rituals` edits them through the browser Supabase client.

**Tech Stack:** Next.js (App Router, server components; read `node_modules/next/dist/docs/` before touching a route), React 19, Supabase (Postgres + RLS), Vitest + Testing Library (jsdom), Tailwind, base-ui `Switch`, native `<select>`/`<input type="time">`.

**Spec:** `docs/superpowers/specs/2026-09-19-ritual-settings-admin-design.md`

## Global Constraints

- Ritual ids are exactly `daily_plan`, `evening_review`, `weekly_review`, `weekly_plan`.
- Weekday numbering is Monday = 0 … Sunday = 6, matching `weekdayOf()` in `src/lib/dates.ts`. Never use JS `Date.getDay()`.
- Times are minutes after local midnight in the user's own timezone (`0`–`1439`).
- `{name}` in copy is replaced with the username, falling back to `Adventurer` (the dashboard hero's fallback).
- Copy stays in English, like the rest of the app UI.
- Dismissal keys become `lifequest-ritual-<ritual>-dismissed-<period>`; the old per-prompt keys are dropped, not migrated.
- The app must keep working with an empty `ritual_settings` table (defaults in code).
- Writes to `ritual_settings` go through RLS; the page never checks authorization itself beyond deciding what to render.
- Tests: Vitest, `npx vitest run <path>`; typecheck `npx tsc --noEmit -p tsconfig.json`; lint `npx eslint <files>`.
- Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Work on branch `feat/ritual-settings` (exists, branched from `staging`).

---

### Task 1: Migration, row type, data-model doc

**Files:**
- Create: `supabase/migrations/20260919120000_create_ritual_settings.sql`
- Modify: `src/lib/supabase/database.types.ts` (row type near line 15, table entry near line 484)
- Modify: `docs/backend/data-model.md` (table list, after `journal_prompts` row)

**Interfaces:**
- Produces: `RitualSettingRow` type and `ritual_settings` table typing used by `supabaseUpdateWhere(supabase, 'ritual_settings', …)` in Task 6.

- [ ] **Step 1: Write the migration**

```sql
-- Global settings for the four dashboard rituals (Daily Plan, Evening
-- Review, Weekly Review, Weekly Plan): whether each prompts, when, what it
-- says, and which journal template it opens.
--
-- One row per ritual, keyed by the ritual's name, readable by everyone
-- signed in and writable only by trusted admins (JWT role), the same test
-- admin_app_stats makes. Seeded with the behaviour the code hard-coded
-- before this table existed, so nothing changes for anyone on the day it
-- ships. src/lib/rituals.ts carries the same defaults for an environment
-- where this seed has not run; keep the two in step.

create table public.ritual_settings (
  ritual text primary key
    check (ritual in ('daily_plan', 'evening_review', 'weekly_review', 'weekly_plan')),
  enabled boolean not null default true,
  -- 0 = Monday … 6 = Sunday, matching weekdayOf() in src/lib/dates.ts.
  -- Null means every day; the daily rituals keep it null.
  weekday smallint check (weekday between 0 and 6),
  -- Minutes after local midnight the prompt may open from, in the user's
  -- own timezone. 0 for "any time".
  from_minutes smallint not null default 0 check (from_minutes between 0 and 1439),
  -- The journal template the prompt opens. Null for the Daily Plan, whose
  -- target is the planner, and null once an admin's chosen template is
  -- deleted, which hides the prompt rather than sending users to a 404.
  template_id uuid references public.journal_templates(id) on delete set null,
  -- {name} in any of these becomes the user's name.
  title text not null,
  description text not null,
  cta_label text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.ritual_settings is
  'One row per dashboard ritual prompt. Read by every user, edited by trusted admins at /admin/rituals. Defaults duplicated in src/lib/rituals.ts.';

alter table public.ritual_settings enable row level security;

create policy "ritual settings are readable by every signed-in user"
  on public.ritual_settings for select
  to authenticated using (true);

create policy "trusted admins update ritual settings"
  on public.ritual_settings for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No insert or delete policy on purpose: the four rows below are the whole
-- set, and the app never adds or removes one.

insert into public.ritual_settings
  (ritual, enabled, weekday, from_minutes, template_id, title, description, cta_label)
values
  (
    'daily_plan', true, null, 0, null,
    'Welcome back, {name} 👋',
    'Want to start with your daily briefing? A few minutes now to set your Top Three makes the rest of the day easier to navigate.',
    'Start briefing'
  ),
  (
    'evening_review', true, null, 1200,
    -- Created by hand rather than by a migration, so it is found by name
    -- once, here. Null where no such template exists, which hides the
    -- prompt on that environment -- what happened there before too.
    (select id from public.journal_templates
      where is_system = true and name = 'Evening Review'
      order by created_at limit 1),
    'How was your day, {name}?',
    'Close the loop before you switch off. A couple of minutes to reflect on today and set tomorrow''s focus.',
    'Start evening review'
  ),
  (
    'weekly_review', true, 6, 1080,
    '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01',
    'How was your week, {name}?',
    'Step back before the next one starts. A few minutes on what worked, what did not, and what you want to change.',
    'Start weekly review'
  ),
  (
    'weekly_plan', true, 0, 0,
    'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
    'New week, {name} 🗓️',
    'Give the week a theme and three outcomes before the days start deciding for you. Each morning''s briefing gets easier with them set.',
    'Plan the week'
  )
on conflict (ritual) do nothing;
```

- [ ] **Step 2: Add the row type and table entry to `database.types.ts`**

Next to the other `…Row` exports at the top of the file (around line 15), add:

```ts
export type RitualId = 'daily_plan' | 'evening_review' | 'weekly_review' | 'weekly_plan'
export type RitualSettingRow = { ritual: RitualId; enabled: boolean; weekday: number | null; from_minutes: number; template_id: string | null; title: string; description: string; cta_label: string; updated_at: string; updated_by: string | null }
```

In the `Tables` map, after the `metric_targets` line (around line 484), add:

```ts
      ritual_settings: MutableTable<RitualSettingRow, 'ritual' | 'title' | 'description' | 'cta_label'>
```

- [ ] **Step 3: Add the doc row**

In `docs/backend/data-model.md`, in the table list after the `journal_prompts` row:

```markdown
| `ritual_settings` | One row per dashboard ritual prompt (Daily Plan, Evening Review, Weekly Review, Weekly Plan): enabled, window, target template, copy. Read by all users, updated by trusted admins |
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260919120000_create_ritual_settings.sql src/lib/supabase/database.types.ts docs/backend/data-model.md
git commit -m "feat(db): add ritual_settings with today's behaviour as seed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `src/lib/rituals.ts` — types, defaults, normalization

**Files:**
- Create: `src/lib/rituals.ts`
- Create: `src/lib/rituals.test.ts`

**Interfaces:**
- Consumes: `RitualId` from `@/lib/supabase/database.types` (Task 1); `WEEKLY_REVIEW_TEMPLATE_ID`, `WEEKLY_PLAN_TEMPLATE_ID` from `@/lib/weekly-rituals` (exist).
- Produces:
  - `type RitualId` (re-exported), `interface RitualSetting { ritual, enabled, weekday, fromMinutes, templateId, title, description, ctaLabel }`, `type RitualSettings = Record<RitualId, RitualSetting>`
  - `RITUAL_IDS: RitualId[]` in dashboard order
  - `DEFAULT_RITUAL_SETTINGS: RitualSettings`
  - `normalizeRitualSettings(rows: unknown): RitualSettings`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/rituals.test.ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RITUAL_SETTINGS,
  RITUAL_IDS,
  normalizeRitualSettings,
} from '@/lib/rituals'
import { WEEKLY_PLAN_TEMPLATE_ID, WEEKLY_REVIEW_TEMPLATE_ID } from '@/lib/weekly-rituals'

describe('DEFAULT_RITUAL_SETTINGS', () => {
  it('matches the behaviour the dashboard hard-coded before the table existed', () => {
    expect(DEFAULT_RITUAL_SETTINGS.daily_plan).toMatchObject({ enabled: true, weekday: null, fromMinutes: 0, templateId: null })
    expect(DEFAULT_RITUAL_SETTINGS.evening_review).toMatchObject({ enabled: true, weekday: null, fromMinutes: 20 * 60, templateId: null })
    expect(DEFAULT_RITUAL_SETTINGS.weekly_review).toMatchObject({ enabled: true, weekday: 6, fromMinutes: 18 * 60, templateId: WEEKLY_REVIEW_TEMPLATE_ID })
    expect(DEFAULT_RITUAL_SETTINGS.weekly_plan).toMatchObject({ enabled: true, weekday: 0, fromMinutes: 0, templateId: WEEKLY_PLAN_TEMPLATE_ID })
  })

  it('lists the rituals in dashboard order', () => {
    expect(RITUAL_IDS).toEqual(['daily_plan', 'evening_review', 'weekly_review', 'weekly_plan'])
  })
})

describe('normalizeRitualSettings', () => {
  const row = {
    ritual: 'evening_review',
    enabled: false,
    weekday: null,
    from_minutes: 1290,
    template_id: 'tmpl-1',
    title: 'Evening, {name}',
    description: 'Wrap up.',
    cta_label: 'Go',
    updated_at: '2026-09-19T10:00:00Z',
    updated_by: null,
  }

  it('returns the defaults for every ritual when nothing was stored', () => {
    expect(normalizeRitualSettings(null)).toEqual(DEFAULT_RITUAL_SETTINGS)
    expect(normalizeRitualSettings([])).toEqual(DEFAULT_RITUAL_SETTINGS)
    expect(normalizeRitualSettings('nonsense')).toEqual(DEFAULT_RITUAL_SETTINGS)
  })

  it('maps a stored row onto the camelCase setting', () => {
    const settings = normalizeRitualSettings([row])

    expect(settings.evening_review).toEqual({
      ritual: 'evening_review',
      enabled: false,
      weekday: null,
      fromMinutes: 1290,
      templateId: 'tmpl-1',
      title: 'Evening, {name}',
      description: 'Wrap up.',
      ctaLabel: 'Go',
    })
    expect(settings.daily_plan).toEqual(DEFAULT_RITUAL_SETTINGS.daily_plan)
  })

  it('falls back per field, not per row, when a value is out of range', () => {
    const settings = normalizeRitualSettings([
      { ...row, from_minutes: 1440, weekday: 7, title: '   ', cta_label: 'Go' },
    ])

    expect(settings.evening_review.fromMinutes).toBe(DEFAULT_RITUAL_SETTINGS.evening_review.fromMinutes)
    expect(settings.evening_review.weekday).toBe(DEFAULT_RITUAL_SETTINGS.evening_review.weekday)
    expect(settings.evening_review.title).toBe(DEFAULT_RITUAL_SETTINGS.evening_review.title)
    expect(settings.evening_review.ctaLabel).toBe('Go')
    expect(settings.evening_review.enabled).toBe(false)
  })

  it('accepts weekday 0 and a null template as real values, not as missing', () => {
    const settings = normalizeRitualSettings([
      { ...row, ritual: 'weekly_plan', weekday: 0, template_id: null },
    ])

    expect(settings.weekly_plan.weekday).toBe(0)
    expect(settings.weekly_plan.templateId).toBeNull()
  })

  it('ignores rows for rituals it does not know', () => {
    const settings = normalizeRitualSettings([{ ...row, ritual: 'lunch_break' }])

    expect(settings).toEqual(DEFAULT_RITUAL_SETTINGS)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/rituals.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/rituals"`.

- [ ] **Step 3: Write the lib**

```ts
// src/lib/rituals.ts
import type { RitualId } from '@/lib/supabase/database.types'
import {
  WEEKLY_PLAN_TEMPLATE_ID,
  WEEKLY_REVIEW_TEMPLATE_ID,
} from '@/lib/weekly-rituals'

export type { RitualId }

/**
 * One dashboard ritual's configuration: whether it prompts, when, what the
 * dialog says, and which journal template it opens.
 *
 * camelCase because it is the app's type; the database row it comes from
 * is snake_case, and `normalizeRitualSettings` is the one place that maps
 * between them.
 */
export interface RitualSetting {
  ritual: RitualId
  enabled: boolean
  /** 0 = Monday … 6 = Sunday, as weekdayOf(); null means every day. */
  weekday: number | null
  /** Minutes after local midnight the prompt may open from. */
  fromMinutes: number
  /** The journal template the prompt opens; null for the Daily Plan, or once the chosen template is gone. */
  templateId: string | null
  /** `{name}` in any of these becomes the user's name. */
  title: string
  description: string
  ctaLabel: string
}

export type RitualSettings = Record<RitualId, RitualSetting>

/** The rituals in the order the dashboard runs them through a day and a week. */
export const RITUAL_IDS: RitualId[] = [
  'daily_plan',
  'evening_review',
  'weekly_review',
  'weekly_plan',
]

/**
 * What every ritual does when its row is missing or unreadable.
 *
 * The same values the migration seeds
 * (supabase/migrations/20260919120000_create_ritual_settings.sql), minus the
 * Evening Review's template id, which differs per environment because that
 * template was made by hand. Keep the two in step: the dashboard must not
 * depend on the seed having run.
 */
export const DEFAULT_RITUAL_SETTINGS: RitualSettings = {
  daily_plan: {
    ritual: 'daily_plan',
    enabled: true,
    weekday: null,
    fromMinutes: 0,
    templateId: null,
    title: 'Welcome back, {name} 👋',
    description:
      'Want to start with your daily briefing? A few minutes now to set your Top Three makes the rest of the day easier to navigate.',
    ctaLabel: 'Start briefing',
  },
  evening_review: {
    ritual: 'evening_review',
    enabled: true,
    weekday: null,
    fromMinutes: 20 * 60,
    templateId: null,
    title: 'How was your day, {name}?',
    description:
      'Close the loop before you switch off. A couple of minutes to reflect on today and set tomorrow’s focus.',
    ctaLabel: 'Start evening review',
  },
  weekly_review: {
    ritual: 'weekly_review',
    enabled: true,
    weekday: 6,
    fromMinutes: 18 * 60,
    templateId: WEEKLY_REVIEW_TEMPLATE_ID,
    title: 'How was your week, {name}?',
    description:
      'Step back before the next one starts. A few minutes on what worked, what did not, and what you want to change.',
    ctaLabel: 'Start weekly review',
  },
  weekly_plan: {
    ritual: 'weekly_plan',
    enabled: true,
    weekday: 0,
    fromMinutes: 0,
    templateId: WEEKLY_PLAN_TEMPLATE_ID,
    title: 'New week, {name} 🗓️',
    description:
      'Give the week a theme and three outcomes before the days start deciding for you. Each morning’s briefing gets easier with them set.',
    ctaLabel: 'Plan the week',
  },
}

const RITUAL_ID_SET = new Set<string>(RITUAL_IDS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function intInRange(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * Reads what the database returned for `ritual_settings`, keeping what
 * passes the checks and falling back to the default for anything else --
 * per field, so one bad value does not throw away the rest of the row, and
 * never throwing, so a broken row cannot take the dashboard down with it.
 * Rows for rituals this build does not know are dropped.
 */
export function normalizeRitualSettings(rows: unknown): RitualSettings {
  const settings: RitualSettings = { ...DEFAULT_RITUAL_SETTINGS }
  if (!Array.isArray(rows)) return settings

  for (const row of rows) {
    if (!isRecord(row) || typeof row.ritual !== 'string' || !RITUAL_ID_SET.has(row.ritual)) continue
    const ritual = row.ritual as RitualId
    const fallback = DEFAULT_RITUAL_SETTINGS[ritual]
    settings[ritual] = {
      ritual,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : fallback.enabled,
      weekday: row.weekday === null ? null : intInRange(row.weekday, 0, 6) ?? fallback.weekday,
      fromMinutes: intInRange(row.from_minutes, 0, 1439) ?? fallback.fromMinutes,
      templateId:
        row.template_id === null
          ? null
          : nonEmptyString(row.template_id) ?? fallback.templateId,
      title: nonEmptyString(row.title) ?? fallback.title,
      description: nonEmptyString(row.description) ?? fallback.description,
      ctaLabel: nonEmptyString(row.cta_label) ?? fallback.ctaLabel,
    }
  }

  return settings
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/rituals.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/rituals.ts src/lib/rituals.test.ts
git commit -m "feat(rituals): typed settings with defaults and normalization

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Window rule, `{name}` filling, dismissal keys; trim `weekly-rituals.ts`

**Files:**
- Modify: `src/lib/rituals.ts`, `src/lib/rituals.test.ts`
- Modify: `src/lib/weekly-rituals.ts` (remove `isWeeklyReviewWindow`, `isWeeklyPlanWindow`, `WEEKLY_REVIEW_FROM_MINUTES`, `weeklyReviewDismissKey`, `weeklyPlanDismissKey`)
- Modify: `src/lib/weekly-rituals.test.ts` (remove their tests)

**Interfaces:**
- Consumes: `weekdayOf` from `@/lib/dates`.
- Produces:
  - `isRitualWindow(setting: RitualSetting, today: string, nowMinutes: number): boolean`
  - `fillName(text: string, username: string | null): string`
  - `ritualDismissKey(ritual: RitualId, periodKey: string): string` → `lifequest-ritual-<ritual>-dismissed-<periodKey>`

Note: the dashboard page and the two weekly prompt components still import the removed functions after this task; TypeScript will fail until Task 4 and Task 5. That is expected — run only the named test files here, not `tsc`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/rituals.test.ts` (and extend the import to include `fillName`, `isRitualWindow`, `ritualDismissKey`):

```ts
describe('isRitualWindow', () => {
  const SUNDAY = '2026-09-20'
  const MONDAY = '2026-09-21'
  const weekly = { ...DEFAULT_RITUAL_SETTINGS.weekly_review } // Sunday from 18:00
  const daily = { ...DEFAULT_RITUAL_SETTINGS.evening_review } // every day from 20:00

  it('is closed while the ritual is disabled, whatever the time', () => {
    expect(isRitualWindow({ ...daily, enabled: false }, SUNDAY, 22 * 60)).toBe(false)
  })

  it('opens a daily ritual on any weekday once its time is reached', () => {
    expect(isRitualWindow(daily, MONDAY, 20 * 60)).toBe(true)
    expect(isRitualWindow(daily, SUNDAY, 20 * 60)).toBe(true)
    expect(isRitualWindow(daily, MONDAY, 19 * 60 + 59)).toBe(false)
  })

  it('opens a weekly ritual only on its weekday', () => {
    expect(isRitualWindow(weekly, SUNDAY, 18 * 60)).toBe(true)
    expect(isRitualWindow(weekly, SUNDAY, 17 * 60 + 59)).toBe(false)
    expect(isRitualWindow(weekly, MONDAY, 18 * 60)).toBe(false)
  })

  it('treats weekday 0 as Monday, not as "no weekday"', () => {
    expect(isRitualWindow({ ...weekly, weekday: 0, fromMinutes: 0 }, MONDAY, 0)).toBe(true)
    expect(isRitualWindow({ ...weekly, weekday: 0, fromMinutes: 0 }, SUNDAY, 0)).toBe(false)
  })
})

describe('fillName', () => {
  it('replaces every {name} with the username', () => {
    expect(fillName('Hi {name}, {name}!', 'Alex')).toBe('Hi Alex, Alex!')
  })

  it('falls back to the same default name as the dashboard hero', () => {
    expect(fillName('Hi {name}', null)).toBe('Hi Adventurer')
  })

  it('leaves text without a placeholder alone', () => {
    expect(fillName('Plan the week', 'Alex')).toBe('Plan the week')
  })
})

describe('ritualDismissKey', () => {
  it('names the key by ritual and period', () => {
    expect(ritualDismissKey('evening_review', '2026-09-20')).toBe('lifequest-ritual-evening_review-dismissed-2026-09-20')
    expect(ritualDismissKey('weekly_plan', '2026-09-14')).toBe('lifequest-ritual-weekly_plan-dismissed-2026-09-14')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/rituals.test.ts`
Expected: FAIL — `isRitualWindow is not a function` (and the two others).

- [ ] **Step 3: Implement**

Append to `src/lib/rituals.ts` (add `import { weekdayOf } from '@/lib/dates'` at the top):

```ts
/**
 * Whether a ritual's prompt may open right now.
 *
 * One rule for all four: on, on the right weekday (or any, for the daily
 * ones), and past the start time. Whether the ritual is already *done*
 * today or this week is the dashboard's question, answered from entries.
 */
export function isRitualWindow(
  setting: RitualSetting,
  today: string,
  nowMinutes: number
): boolean {
  if (!setting.enabled) return false
  if (setting.weekday !== null && weekdayOf(today) !== setting.weekday) return false
  return nowMinutes >= setting.fromMinutes
}

/** Matches the DashboardHero fallback so the greeting reads the same across the page. */
const NAME_FALLBACK = 'Adventurer'

/** Puts the user's name into admin-written copy wherever it says `{name}`. */
export function fillName(text: string, username: string | null): string {
  return text.replaceAll('{name}', username ?? NAME_FALLBACK)
}

/**
 * Where "Not now" on a ritual prompt is remembered in localStorage.
 *
 * `periodKey` is the date for the daily rituals and the week's Monday for
 * the weekly ones, so the key expires on its own with the next period and
 * nothing has to be cleaned up.
 */
export function ritualDismissKey(ritual: RitualId, periodKey: string): string {
  return `lifequest-ritual-${ritual}-dismissed-${periodKey}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/rituals.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Trim `weekly-rituals.ts` to what still has a job**

Replace the whole file with:

```ts
// src/lib/weekly-rituals.ts
import { addDays, weekStart } from '@/lib/dates'

/**
 * The journal templates behind the two weekly rituals, seeded in
 * `supabase/migrations/20260918120000_create_weekly_ritual_templates.sql`.
 *
 * Fixed ids rather than name lookups, for the reason given in
 * daily-reflection.ts: a template this app seeds itself has no reason to
 * be fragile. They are the defaults an admin starts from; which template a
 * prompt actually opens is read from ritual_settings (src/lib/rituals.ts).
 */
export const WEEKLY_REVIEW_TEMPLATE_ID = '5c1c3f0e-9a4b-4d7e-8f21-7b3e2a6d9c01'
export const WEEKLY_PLAN_TEMPLATE_ID = 'a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02'

export interface WeeklyEntryLike {
  template_id: string
  entry_date: string
}

/**
 * Whether a completed entry for `templateId` already exists in the week that
 * `today` falls in (Monday through Sunday).
 *
 * Week-scoped rather than day-scoped so a review written on Sunday still
 * counts as done on Monday, and a plan written early counts for the week.
 */
export function weeklyEntryExists(
  entries: WeeklyEntryLike[],
  templateId: string | null,
  today: string
): boolean {
  if (templateId === null) return false
  const start = weekStart(today)
  const end = addDays(start, 6)
  return entries.some(
    (entry) =>
      entry.template_id === templateId &&
      entry.entry_date >= start &&
      entry.entry_date <= end
  )
}
```

(`templateId` now accepts `null` — a ritual without a target is never "done", it is simply hidden.)

- [ ] **Step 6: Trim its tests**

Replace `src/lib/weekly-rituals.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import {
  WEEKLY_PLAN_TEMPLATE_ID,
  WEEKLY_REVIEW_TEMPLATE_ID,
  weeklyEntryExists,
} from '@/lib/weekly-rituals'

const SUNDAY = '2026-09-20'
const MONDAY = '2026-09-21'
const TUESDAY = '2026-09-22'

describe('weeklyEntryExists', () => {
  const entries = [
    { template_id: WEEKLY_REVIEW_TEMPLATE_ID, entry_date: '2026-09-13' }, // last week's Sunday
    { template_id: WEEKLY_PLAN_TEMPLATE_ID, entry_date: MONDAY },
  ]

  it('finds an entry for the template dated inside the week of today', () => {
    expect(weeklyEntryExists(entries, WEEKLY_PLAN_TEMPLATE_ID, TUESDAY)).toBe(true)
  })

  it('ignores an entry from a previous week', () => {
    expect(weeklyEntryExists(entries, WEEKLY_REVIEW_TEMPLATE_ID, SUNDAY)).toBe(false)
  })

  it('ignores entries of other templates', () => {
    expect(weeklyEntryExists(entries, 'some-other-template', TUESDAY)).toBe(false)
  })

  it('is never done for a ritual without a target template', () => {
    expect(weeklyEntryExists(entries, null, TUESDAY)).toBe(false)
  })
})
```

- [ ] **Step 7: Run both test files**

Run: `npx vitest run src/lib/rituals.test.ts src/lib/weekly-rituals.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/rituals.ts src/lib/rituals.test.ts src/lib/weekly-rituals.ts src/lib/weekly-rituals.test.ts
git commit -m "feat(rituals): one window rule, {name} filling, shared dismiss keys

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Prompts take `copy` and use the shared dismiss keys

**Files:**
- Modify: `src/components/dashboard/DailyPlanPrompt.tsx`, `DailyPlanPrompt.test.tsx`
- Modify: `src/components/dashboard/EveningReviewPrompt.tsx`, `EveningReviewPrompt.test.tsx`
- Modify: `src/components/dashboard/WeeklyReviewPrompt.tsx`, `WeeklyReviewPrompt.test.tsx`
- Modify: `src/components/dashboard/WeeklyPlanPrompt.tsx`, `WeeklyPlanPrompt.test.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx` (pass copy from defaults; heldBackBy keys) — the minimum to keep `tsc` green; Task 5 replaces the defaults with the fetched settings.

**Interfaces:**
- Consumes: `fillName`, `ritualDismissKey`, `DEFAULT_RITUAL_SETTINGS` from `@/lib/rituals`.
- Produces: every prompt has a required prop `copy: PromptCopy` where

```ts
export interface PromptCopy {
  /** Already run through fillName; the component prints it as-is. */
  title: string
  description: string
  ctaLabel: string
}
```

  exported from `src/components/dashboard/prompt-dismissal.ts` (it is the prompts' shared module already). `EveningReviewPrompt` and the weekly prompts take `href: string` instead of `templateId`; the page builds `/journal/new/<id>` and passes `null` for a ritual without a target — `open` requires `href !== null`.

- [ ] **Step 1: Add the shared type**

Append to `src/components/dashboard/prompt-dismissal.ts`:

```ts
/**
 * What a ritual prompt says, as an admin wrote it at /admin/rituals with
 * `{name}` already filled in by the page. The prompts print these as-is.
 */
export interface PromptCopy {
  title: string
  description: string
  ctaLabel: string
}
```

- [ ] **Step 2: Update `DailyPlanPrompt.test.tsx` (failing)**

Replace the file's imports/constants and the `render` calls so every render passes `copy`, and the dismissal assertions use the new key:

```tsx
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DailyPlanPrompt } from './DailyPlanPrompt'
import { installLocalStorageStub } from '../../../test/local-storage-stub'

const TODAY = '2026-08-02'
const copy = { title: 'Welcome back, Alex 👋', description: 'Set your Top Three.', ctaLabel: 'Start briefing' }

beforeEach(() => {
  installLocalStorageStub()
})

afterEach(() => {
  cleanup()
})

describe('DailyPlanPrompt', () => {
  it('opens when the plan is not committed and has not been dismissed today', () => {
    render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
    expect(screen.getByText('Set your Top Three.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start briefing' }).getAttribute('href')).toBe('/plan')
  })

  it('stays closed once the plan is already committed', () => {
    render(<DailyPlanPrompt today={TODAY} planCommitted copy={copy} />)

    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('closes and remembers the dismissal for the rest of the day when the user picks "Not now"', () => {
    const { unmount } = render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
    expect(window.localStorage.getItem(`lifequest-ritual-daily_plan-dismissed-${TODAY}`)).toBe('1')

    // Simulate a fresh page load later the same day: still dismissed.
    unmount()
    render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)
    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('reopens on a new day even if yesterday was dismissed', () => {
    window.localStorage.setItem('lifequest-ritual-daily_plan-dismissed-2026-08-01', '1')

    render(<DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} />)

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
  })

  it('stays closed while a weekly prompt it yields to is still unanswered', () => {
    render(
      <DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} heldBackBy="lifequest-ritual-weekly_plan-dismissed-2026-07-27" />
    )

    expect(screen.queryByText('Welcome back, Alex 👋')).toBeNull()
  })

  it('opens once the weekly prompt it yields to has been dismissed', () => {
    window.localStorage.setItem('lifequest-ritual-weekly_plan-dismissed-2026-07-27', '1')

    render(
      <DailyPlanPrompt today={TODAY} planCommitted={false} copy={copy} heldBackBy="lifequest-ritual-weekly_plan-dismissed-2026-07-27" />
    )

    expect(screen.getByText('Welcome back, Alex 👋')).toBeTruthy()
  })
})
```

(The "falls back to Adventurer" test goes: the fallback now lives in `fillName`, tested in Task 3. The local `installLocalStorageStub` copy in this file is replaced by the shared import.)

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/dashboard/DailyPlanPrompt.test.tsx`
Expected: FAIL — TypeScript/props: `username` removed, `copy` unknown; assertions on the new key fail.

- [ ] **Step 4: Update `DailyPlanPrompt.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CalendarClock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  usePromptDismissal,
  usePromptHeldBack,
  type PromptCopy,
} from '@/components/dashboard/prompt-dismissal'
import { ritualDismissKey } from '@/lib/rituals'

interface DailyPlanPromptProps {
  /** The user's local date key (YYYY-MM-DD), so the dismissal resets every day. */
  today: string
  planCommitted: boolean
  copy: PromptCopy
  /**
   * The dismissal key of a weekly prompt that takes precedence today, or
   * null. See usePromptHeldBack.
   */
  heldBackBy?: string | null
}

export function DailyPlanPrompt({
  today,
  planCommitted,
  copy,
  heldBackBy = null,
}: DailyPlanPromptProps) {
  const reduceMotion = useReducedMotion()
  const { dismissed, dismiss } = usePromptDismissal(ritualDismissKey('daily_plan', today))
  const heldBack = usePromptHeldBack(heldBackBy)

  const open = !planCommitted && !dismissed && !heldBack

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="overflow-hidden border-2 border-primary/20 shadow-2xl sm:max-w-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-linear-to-br from-primary/30 to-purple-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-linear-to-tr from-purple-500/20 to-primary/20 blur-3xl" />
        <DialogHeader className="relative">
          <motion.span
            className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-500 text-primary-foreground"
            animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, 1.5, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CalendarClock className="size-7" />
          </motion.span>
          <motion.div
            className="space-y-2"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <DialogTitle className="text-2xl font-bold tracking-tight">{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </motion.div>
        </DialogHeader>
        <DialogFooter className="relative">
          <Button variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          <Button asChild onClick={dismiss} className="group">
            <Link href="/plan">
              {copy.ctaLabel}
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/components/dashboard/DailyPlanPrompt.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Update `EveningReviewPrompt.test.tsx` (failing)**

Same shape. `defaultProps` becomes:

```tsx
const copy = { title: 'How was your day, Alex?', description: 'Close the loop.', ctaLabel: 'Start evening review' }

const defaultProps = {
  today: TODAY,
  isEvening: true,
  reviewDone: false,
  href: '/journal/new/evening-review-template-id',
  copy,
  habitsCompleted: 2,
  habitsTotal: 3,
  tasksCompletedToday: 4,
}
```

Replace the test that checked the `Adventurer` fallback with:

```tsx
  it('stays closed when the ritual has no target to open', () => {
    render(<EveningReviewPrompt {...defaultProps} href={null} />)

    expect(screen.queryByText('How was your day, Alex?')).toBeNull()
  })

  it('links where the page told it to', () => {
    render(<EveningReviewPrompt {...defaultProps} />)

    expect(screen.getByRole('link', { name: 'Start evening review' }).getAttribute('href')).toBe('/journal/new/evening-review-template-id')
  })
```

Remove any `templateId={null}` test (replaced above). Change every dismissal key in the file from `lifequest-evening-review-dismissed-` to `lifequest-ritual-evening_review-dismissed-`, and the held-back keys to `lifequest-ritual-weekly_review-dismissed-2026-07-27`. Use the shared `installLocalStorageStub` import.

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/components/dashboard/EveningReviewPrompt.test.tsx`
Expected: FAIL.

- [ ] **Step 8: Update `EveningReviewPrompt.tsx`**

Props become:

```tsx
interface EveningReviewPromptProps {
  /** The user's local date key (YYYY-MM-DD), so the dismissal resets every day. */
  today: string
  /** Whether the ritual's window is open right now (see isRitualWindow). */
  isEvening: boolean
  /** Whether an entry of the target template already exists for today. */
  reviewDone: boolean
  /** Where the call to action leads, or null when the ritual has no target — then the prompt stays closed. */
  href: string | null
  copy: PromptCopy
  habitsCompleted: number
  habitsTotal: number
  tasksCompletedToday: number
  heldBackBy?: string | null
}
```

Delete `EVENING_REVIEW_DISMISS_PREFIX` and the local `dismissKey`. Body changes:

```tsx
  const { dismissed, dismiss } = usePromptDismissal(ritualDismissKey('evening_review', today))
  const heldBack = usePromptHeldBack(heldBackBy)

  const open = isEvening && !reviewDone && !dismissed && !heldBack && href !== null
```

Title → `{copy.title}`, description → `{copy.description}`, and the footer link:

```tsx
          <Button asChild onClick={dismiss}>
            <Link href={href ?? '#'}>{copy.ctaLabel}</Link>
          </Button>
```

(`href ?? '#'` only satisfies the type; the dialog is never open with a null href.)

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run src/components/dashboard/EveningReviewPrompt.test.tsx`
Expected: PASS.

- [ ] **Step 10: Update the two weekly prompt tests (failing)**

`WeeklyReviewPrompt.test.tsx`: `defaultProps` gets `href: '/journal/new/weekly-review-id'` and `copy: { title: 'How was your week, Alex?', description: 'Step back.', ctaLabel: 'Start weekly review' }`; drop `username`. Replace the `Adventurer` test with a `href={null}` stays-closed test. The link test asserts `getAttribute('href')` is `'/journal/new/weekly-review-id'`. Dismissal keys become `lifequest-ritual-weekly_review-dismissed-<WEEK_START>` (and `…-2026-09-07` for the previous-week test). Remove the `WEEKLY_REVIEW_TEMPLATE_ID` import.

`WeeklyPlanPrompt.test.tsx`: same with `href: '/journal/new/weekly-plan-id'`, `copy: { title: 'New week, Alex 🗓️', description: 'Give the week a theme.', ctaLabel: 'Plan the week' }`, keys `lifequest-ritual-weekly_plan-dismissed-…`. Remove the `WEEKLY_PLAN_TEMPLATE_ID` import.

- [ ] **Step 11: Run to verify they fail**

Run: `npx vitest run src/components/dashboard/WeeklyReviewPrompt.test.tsx src/components/dashboard/WeeklyPlanPrompt.test.tsx`
Expected: FAIL.

- [ ] **Step 12: Update `WeeklyReviewPrompt.tsx` and `WeeklyPlanPrompt.tsx`**

Both: replace the `@/lib/weekly-rituals` import with `import { ritualDismissKey } from '@/lib/rituals'` and import `type PromptCopy` from `./prompt-dismissal`. Props: drop `username`, add `href: string | null` and `copy: PromptCopy`. Keys: `ritualDismissKey('weekly_review', weekStart)` / `ritualDismissKey('weekly_plan', weekStart)`. `open` gains `&& href !== null`. Title/description/CTA print `copy.*`; the link uses `href ?? '#'`. Everything else (icons, stats line, motion) stays.

- [ ] **Step 13: Run to verify they pass**

Run: `npx vitest run src/components/dashboard/`
Expected: PASS, all dashboard test files.

- [ ] **Step 14: Wire the dashboard page to the new props (defaults for now)**

In `src/app/(app)/dashboard/page.tsx`:

- Change the `@/lib/weekly-rituals` import to only `WEEKLY_PLAN_TEMPLATE_ID, WEEKLY_REVIEW_TEMPLATE_ID, weeklyEntryExists`.
- Add `import { DEFAULT_RITUAL_SETTINGS, fillName, ritualDismissKey } from '@/lib/rituals'`.
- Keep the existing `isEvening`, `weeklyReviewWindow`, `weeklyPlanWindow` computations for now but replace the two removed functions inline:

```ts
  const weeklyReviewWindow = weekdayOf(today) === 6 && nowMinutes >= 18 * 60
  const weeklyPlanWindow = weekdayOf(today) === 0
```

  (import `weekdayOf` from `@/lib/dates`).
- Held-back keys:

```ts
  const eveningReviewHeldBackBy =
    weeklyReviewWindow && !weeklyReviewDone ? ritualDismissKey('weekly_review', thisWeekStart) : null
  const dailyPlanHeldBackBy =
    weeklyPlanWindow && !weeklyPlanDone ? ritualDismissKey('weekly_plan', thisWeekStart) : null
```

- A helper above the component:

```ts
function promptCopy(setting: { title: string; description: string; ctaLabel: string }, username: string | null) {
  return {
    title: fillName(setting.title, username),
    description: fillName(setting.description, username),
    ctaLabel: fillName(setting.ctaLabel, username),
  }
}
```

- JSX:

```tsx
        <DailyPlanPrompt
          today={today}
          planCommitted={planCommitted}
          copy={promptCopy(DEFAULT_RITUAL_SETTINGS.daily_plan, profile.username)}
          heldBackBy={dailyPlanHeldBackBy}
        />
        <EveningReviewPrompt
          today={today}
          isEvening={isEvening}
          reviewDone={eveningReviewDone}
          href={eveningReviewTemplateId ? `/journal/new/${eveningReviewTemplateId}` : null}
          copy={promptCopy(DEFAULT_RITUAL_SETTINGS.evening_review, profile.username)}
          habitsCompleted={habitsCompletedToday}
          habitsTotal={briefingHabits.length}
          tasksCompletedToday={tasksCompletedToday}
          heldBackBy={eveningReviewHeldBackBy}
        />
        <WeeklyPlanPrompt
          weekStart={thisWeekStart}
          isWindow={weeklyPlanWindow}
          planDone={weeklyPlanDone}
          href={`/journal/new/${WEEKLY_PLAN_TEMPLATE_ID}`}
          copy={promptCopy(DEFAULT_RITUAL_SETTINGS.weekly_plan, profile.username)}
          openTaskCount={openTasksRes.count ?? 0}
        />
        <WeeklyReviewPrompt
          weekStart={thisWeekStart}
          isWindow={weeklyReviewWindow}
          reviewDone={weeklyReviewDone}
          href={`/journal/new/${WEEKLY_REVIEW_TEMPLATE_ID}`}
          copy={promptCopy(DEFAULT_RITUAL_SETTINGS.weekly_review, profile.username)}
          habitsCompletedThisWeek={habitsCompletedThisWeek}
          tasksCompletedThisWeek={tasksCompletedThisWeek}
        />
```

- [ ] **Step 15: Typecheck, lint, full tests**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/dashboard "src/app/(app)/dashboard/page.tsx" src/lib/rituals.ts src/lib/weekly-rituals.ts && npx vitest run`
Expected: all clean, all tests pass.

- [ ] **Step 16: Commit**

```bash
git add src/components/dashboard "src/app/(app)/dashboard/page.tsx"
git commit -m "refactor(dashboard): prompts print admin-shaped copy, share dismiss keys

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Dashboard reads `ritual_settings`

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `normalizeRitualSettings`, `isRitualWindow`, `fillName`, `ritualDismissKey`, `RitualSetting` from `@/lib/rituals`; `weeklyEntryExists` from `@/lib/weekly-rituals`.

No unit tests exist for the page (a server component against Supabase); the verification is `tsc`, the full suite, and a manual check in the browser.

- [ ] **Step 1: Fetch the settings in the first `Promise.all`**

```ts
  const [{ data: cityRowData }, avatarState, { data: ritualRows }] = await Promise.all([
    supabase.from('city_states').select('coins').eq('user_id', user.id).single(),
    fetchAvatarState(supabase, user.id),
    // Which prompts run, when, and where they lead. Read on every load so an
    // admin's change at /admin/rituals is live on the next dashboard visit;
    // a missing or malformed row falls back to the code's defaults.
    supabase.from('ritual_settings').select('*'),
  ])
  const rituals = normalizeRitualSettings(ritualRows)
```

Replace the `DEFAULT_RITUAL_SETTINGS` import with `normalizeRitualSettings, isRitualWindow`; drop `weekdayOf` if nothing else uses it.

- [ ] **Step 2: Use the configured template ids in the weekly entries query**

In the big `Promise.all`, the `journal_entries` query becomes:

```ts
    supabase
      .from('journal_entries')
      .select('template_id, entry_date')
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .in(
        'template_id',
        [rituals.weekly_review.templateId, rituals.weekly_plan.templateId].filter(
          (id): id is string => id !== null
        )
      )
      .gte('entry_date', thisWeekStart)
      .lte('entry_date', addDays(thisWeekStart, 6)),
```

Remove the `WEEKLY_PLAN_TEMPLATE_ID` / `WEEKLY_REVIEW_TEMPLATE_ID` imports from the page.

- [ ] **Step 3: Windows, targets, done-checks from settings**

Replace the block from `const nowMinutes = …` through `dailyPlanHeldBackBy` with:

```ts
  const nowMinutes = currentMinutesInTimezone(profile.timezone ?? 'UTC')
  const eveningReviewTemplateId = rituals.evening_review.templateId
  const eveningReviewDone =
    eveningReviewTemplateId !== null && completedTemplateIds.has(eveningReviewTemplateId)
  const habitsCompletedToday = briefingHabits.filter((habit) => habit.completed).length
  const tasksCompletedToday = tasksCompletedTodayRes.count ?? 0
  // The streak window already holds every completed log back to well before
  // Monday, so the week's check-ins are a filter rather than another query.
  const habitsCompletedThisWeek = habitLogRows.filter(
    (log) => log.log_date >= thisWeekStart && log.log_date <= today
  ).length
  const tasksCompletedThisWeek = tasksCompletedThisWeekRes.count ?? 0
  const weeklyEntries = (weeklyEntriesRes.data ?? []) as {
    template_id: string
    entry_date: string
  }[]
  const weeklyReviewDone = weeklyEntryExists(weeklyEntries, rituals.weekly_review.templateId, today)
  const weeklyPlanDone = weeklyEntryExists(weeklyEntries, rituals.weekly_plan.templateId, today)
  const dailyPlanWindow = isRitualWindow(rituals.daily_plan, today, nowMinutes)
  const eveningReviewWindow = isRitualWindow(rituals.evening_review, today, nowMinutes)
  const weeklyReviewWindow = isRitualWindow(rituals.weekly_review, today, nowMinutes)
  const weeklyPlanWindow = isRitualWindow(rituals.weekly_plan, today, nowMinutes)
  // While a weekly prompt is live, the daily one of the same kind waits for
  // it; see usePromptHeldBack. Null once the weekly entry exists or the
  // window is closed, so the daily prompt is not held by a prompt that will
  // never show. With admin-set windows the pair can meet on any day, not
  // only Sunday and Monday; the rule is the same.
  const eveningReviewHeldBackBy =
    weeklyReviewWindow && !weeklyReviewDone && rituals.weekly_review.templateId !== null
      ? ritualDismissKey('weekly_review', thisWeekStart)
      : null
  const dailyPlanHeldBackBy =
    weeklyPlanWindow && !weeklyPlanDone && rituals.weekly_plan.templateId !== null
      ? ritualDismissKey('weekly_plan', thisWeekStart)
      : null
```

Delete the old `isEvening`, the `briefingJournals.find((template) => template.name === 'Evening Review')` lookup and `eveningReviewTemplate`. (`briefingJournals` stays — the journal nudge uses it.)

- [ ] **Step 4: JSX**

```tsx
        <DailyPlanPrompt
          today={today}
          planCommitted={planCommitted || !dailyPlanWindow}
          copy={promptCopy(rituals.daily_plan, profile.username)}
          heldBackBy={dailyPlanHeldBackBy}
        />
        <EveningReviewPrompt
          today={today}
          isEvening={eveningReviewWindow}
          reviewDone={eveningReviewDone}
          href={eveningReviewTemplateId ? `/journal/new/${eveningReviewTemplateId}` : null}
          copy={promptCopy(rituals.evening_review, profile.username)}
          habitsCompleted={habitsCompletedToday}
          habitsTotal={briefingHabits.length}
          tasksCompletedToday={tasksCompletedToday}
          heldBackBy={eveningReviewHeldBackBy}
        />
        <WeeklyPlanPrompt
          weekStart={thisWeekStart}
          isWindow={weeklyPlanWindow}
          planDone={weeklyPlanDone}
          href={rituals.weekly_plan.templateId ? `/journal/new/${rituals.weekly_plan.templateId}` : null}
          copy={promptCopy(rituals.weekly_plan, profile.username)}
          openTaskCount={openTasksRes.count ?? 0}
        />
        <WeeklyReviewPrompt
          weekStart={thisWeekStart}
          isWindow={weeklyReviewWindow}
          reviewDone={weeklyReviewDone}
          href={rituals.weekly_review.templateId ? `/journal/new/${rituals.weekly_review.templateId}` : null}
          copy={promptCopy(rituals.weekly_review, profile.username)}
          habitsCompletedThisWeek={habitsCompletedThisWeek}
          tasksCompletedThisWeek={tasksCompletedThisWeek}
        />
```

`planCommitted || !dailyPlanWindow` keeps `DailyPlanPrompt`'s prop surface unchanged: a closed window reads, to the component, like a day that needs no prompt. Type `promptCopy`'s parameter as `RitualSetting`.

- [ ] **Step 5: Typecheck, lint, full tests**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/(app)/dashboard/page.tsx" && npx vitest run`
Expected: all clean.

- [ ] **Step 6: Manual check (requires the migration applied to the dev database)**

Start the dev server (`npm run dev` via the app's preview tooling), sign in as an admin, open `/dashboard`. With the seed in place nothing should look different from before this branch. In the Supabase SQL editor run `update ritual_settings set from_minutes = 0 where ritual = 'evening_review';`, reload `/dashboard`: the Evening Review prompt opens now (unless today's entry exists). Set `enabled = false` for it, reload: gone. Restore `from_minutes = 1200, enabled = true`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): run the ritual prompts from ritual_settings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `RitualsHub` admin form

**Files:**
- Create: `src/components/admin/RitualsHub.tsx`
- Create: `src/components/admin/RitualsHub.test.tsx`

**Interfaces:**
- Consumes: `RitualSettings`, `RitualSetting`, `RitualId`, `RITUAL_IDS`, `fillName` from `@/lib/rituals`; `timeToMinutes`, `minutesToTime` from `@/lib/today-plan`; `supabaseUpdateWhere` from `@/lib/supabase/helpers`; `createClient` from `@/lib/supabase/client`; `AdminPageHeader`, `Button`, `Input`, `Textarea`, `Label`, `Switch`, `Card`/`CardContent`.
- Produces:

```ts
export interface RitualsHubProps {
  userId: string
  /** hasTrustedAdminRole(user): only the JWT role may save; RLS enforces it, this only decides what to render. */
  trusted: boolean
  settings: RitualSettings
  templates: { id: string; name: string; icon: string }[]
}
export function RitualsHub(props: RitualsHubProps): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/admin/RitualsHub.test.tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RitualsHub } from '@/components/admin/RitualsHub'
import { DEFAULT_RITUAL_SETTINGS } from '@/lib/rituals'

const update = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/supabase/helpers', () => ({
  supabaseUpdateWhere: (...args: unknown[]) => update(...args),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const templates = [
  { id: 'tmpl-evening', name: 'Evening Review', icon: '🌙' },
  { id: 'tmpl-weekly', name: 'Weekly Review', icon: '📝' },
]

const settings = {
  ...DEFAULT_RITUAL_SETTINGS,
  evening_review: { ...DEFAULT_RITUAL_SETTINGS.evening_review, templateId: 'tmpl-evening' },
}

function card(name: RegExp) {
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  update.mockReset().mockResolvedValue({ error: null })
  refresh.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('RitualsHub', () => {
  it('shows one card per ritual in dashboard order', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Daily Plan', 'Evening Review', 'Weekly Review', 'Weekly Plan'])
  })

  it('offers a weekday only for the weekly rituals and a template only for the journal-backed ones', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    expect(card(/daily plan/i).querySelector('select[name="weekday"]')).toBeNull()
    expect(card(/daily plan/i).querySelector('select[name="template"]')).toBeNull()
    expect(card(/evening review/i).querySelector('select[name="weekday"]')).toBeNull()
    expect(card(/evening review/i).querySelector('select[name="template"]')).not.toBeNull()
    expect(card(/weekly review/i).querySelector('select[name="weekday"]')).not.toBeNull()
  })

  it('keeps Save disabled until something changed', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    const save = card(/evening review/i).querySelector('button[type="submit"]') as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(card(/evening review/i).querySelector('input[name="title"]')!, { target: { value: 'Evening, {name}' } })
    expect(save.disabled).toBe(false)
  })

  it('previews the title with a sample name', () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)

    fireEvent.change(card(/evening review/i).querySelector('input[name="title"]')!, { target: { value: 'Evening, {name}' } })
    expect(card(/evening review/i).textContent).toContain('Evening, Alex')
  })

  it('saves the row in snake_case, keyed by the ritual', async () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/evening review/i)

    fireEvent.change(region.querySelector('input[name="from"]')!, { target: { value: '21:30' } })
    fireEvent.change(region.querySelector('select[name="template"]')!, { target: { value: 'tmpl-weekly' } })
    fireEvent.change(region.querySelector('input[name="cta"]')!, { target: { value: 'Wrap up' } })
    fireEvent.submit(region.querySelector('form')!)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const [, table, payload, eqField, eqValue] = update.mock.calls[0]
    expect(table).toBe('ritual_settings')
    expect(eqField).toBe('ritual')
    expect(eqValue).toBe('evening_review')
    expect(payload).toMatchObject({
      enabled: true,
      weekday: null,
      from_minutes: 21 * 60 + 30,
      template_id: 'tmpl-weekly',
      title: settings.evening_review.title,
      description: settings.evening_review.description,
      cta_label: 'Wrap up',
      updated_by: 'admin-1',
    })
    expect(typeof payload.updated_at).toBe('string')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('saves a weekly ritual\'s weekday as a number and "none" as a null template', async () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/weekly review/i)

    fireEvent.change(region.querySelector('select[name="weekday"]')!, { target: { value: '4' } })
    fireEvent.change(region.querySelector('select[name="template"]')!, { target: { value: '' } })
    fireEvent.submit(region.querySelector('form')!)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][2]).toMatchObject({ weekday: 4, template_id: null })
    expect(region.textContent).toContain('will not show')
  })

  it('refuses an empty title without calling the database', async () => {
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/weekly plan/i)

    fireEvent.change(region.querySelector('input[name="title"]')!, { target: { value: '   ' } })
    fireEvent.submit(region.querySelector('form')!)

    expect(await screen.findByText(/title, description and call to action are required/i)).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })

  it('shows the database error inline when the save is rejected', async () => {
    update.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })
    render(<RitualsHub userId="admin-1" trusted settings={settings} templates={templates} />)
    const region = card(/daily plan/i)

    fireEvent.change(region.querySelector('input[name="title"]')!, { target: { value: 'Morning, {name}' } })
    fireEvent.submit(region.querySelector('form')!)

    expect(await screen.findByText(/row-level security/i)).toBeTruthy()
  })

  it('renders read-only for an allowlist admin', () => {
    render(<RitualsHub userId="admin-1" trusted={false} settings={settings} templates={templates} />)

    expect(screen.getByText(/read-only/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
    expect((card(/daily plan/i).querySelector('input[name="title"]') as HTMLInputElement).disabled).toBe(true)
    expect(card(/daily plan/i).querySelector('[role="switch"]')!.getAttribute('aria-disabled') ?? card(/daily plan/i).querySelector('[role="switch"]')!.getAttribute('data-disabled')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/admin/RitualsHub.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/admin/RitualsHub"`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/admin/RitualsHub.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import {
  RITUAL_IDS,
  fillName,
  type RitualId,
  type RitualSetting,
  type RitualSettings,
} from '@/lib/rituals'
import { minutesToTime, timeToMinutes } from '@/lib/today-plan'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from './AdminPageHeader'

export interface RitualsHubProps {
  userId: string
  /** hasTrustedAdminRole(user): only the JWT role may save. RLS enforces it; this only decides what to render. */
  trusted: boolean
  settings: RitualSettings
  templates: { id: string; name: string; icon: string }[]
}

const RITUAL_META: Record<RitualId, { label: string; blurb: string; weekly: boolean; journal: boolean }> = {
  daily_plan: {
    label: 'Daily Plan',
    blurb: 'The morning briefing. Opens the planner until today’s plan is committed.',
    weekly: false,
    journal: false,
  },
  evening_review: {
    label: 'Evening Review',
    blurb: 'Closes the day. Opens a journal template until today’s entry exists.',
    weekly: false,
    journal: true,
  },
  weekly_review: {
    label: 'Weekly Review',
    blurb: 'Closes the week. Opens a journal template until this week’s entry exists.',
    weekly: true,
    journal: true,
  },
  weekly_plan: {
    label: 'Weekly Plan',
    blurb: 'Opens the week. Opens a journal template until this week’s entry exists.',
    weekly: true,
    journal: true,
  },
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** The name the preview greets, so `{name}` reads as a person rather than a token. */
const PREVIEW_NAME = 'Alex'

/** The form's own shape: the time as the input holds it, the template as the select holds it. */
interface Draft {
  enabled: boolean
  weekday: number | null
  from: string
  templateId: string
  title: string
  description: string
  ctaLabel: string
}

function draftFrom(setting: RitualSetting): Draft {
  return {
    enabled: setting.enabled,
    weekday: setting.weekday,
    from: minutesToTime(setting.fromMinutes),
    templateId: setting.templateId ?? '',
    title: setting.title,
    description: setting.description,
    ctaLabel: setting.ctaLabel,
  }
}

function sameDraft(a: Draft, b: Draft) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function RitualsHub({ userId, trusted, settings, templates }: RitualsHubProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        eyebrow="Dashboard prompts"
        title="Rituals"
        description="When each ritual prompts, what it says, and where it leads. Changes apply to every user on their next dashboard visit."
      />
      {!trusted && (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          These settings are read-only for allowlist admins. Saving needs the admin role on the account.
        </p>
      )}
      <div className="grid gap-5">
        {RITUAL_IDS.map((ritual) => (
          <RitualCard
            key={ritual}
            ritual={ritual}
            setting={settings[ritual]}
            templates={templates}
            userId={userId}
            trusted={trusted}
          />
        ))}
      </div>
    </div>
  )
}

function RitualCard({
  ritual,
  setting,
  templates,
  userId,
  trusted,
}: {
  ritual: RitualId
  setting: RitualSetting
  templates: RitualsHubProps['templates']
  userId: string
  trusted: boolean
}) {
  const meta = RITUAL_META[ritual]
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [saved, setSaved] = useState(() => draftFrom(setting))
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const dirty = !sameDraft(draft, saved)
  const headingId = `ritual-${ritual}-heading`

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }))
    setSavedAt(null)
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const fromMinutes = timeToMinutes(draft.from)
    if (!draft.title.trim() || !draft.description.trim() || !draft.ctaLabel.trim()) {
      setError('Title, description and call to action are required.')
      return
    }
    if (Number.isNaN(fromMinutes)) {
      setError('Pick a time the prompt may open from.')
      return
    }
    setSaving(true)
    const { error: saveError } = await supabaseUpdateWhere(
      supabase,
      'ritual_settings',
      {
        enabled: draft.enabled,
        weekday: meta.weekly ? draft.weekday : null,
        from_minutes: fromMinutes,
        template_id: meta.journal && draft.templateId ? draft.templateId : null,
        title: draft.title,
        description: draft.description,
        cta_label: draft.ctaLabel,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      'ritual',
      ritual
    )
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setSaved(draft)
    setSavedAt(Date.now())
    router.refresh()
  }

  const noTarget = meta.journal && draft.templateId === ''

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <form onSubmit={save} aria-labelledby={headingId} role="region" className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={headingId} className="text-lg font-semibold">{meta.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
            </div>
            <Switch
              aria-label={`${meta.label} enabled`}
              checked={draft.enabled}
              disabled={!trusted}
              onCheckedChange={(next) => patch({ enabled: next })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`ritual-${ritual}-weekday`}>Weekday</Label>
              {meta.weekly ? (
                <select
                  id={`ritual-${ritual}-weekday`}
                  name="weekday"
                  className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                  value={draft.weekday ?? 0}
                  disabled={!trusted}
                  onChange={(event) => patch({ weekday: Number(event.target.value) })}
                >
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              ) : (
                <p className="flex h-9 items-center text-sm text-muted-foreground">Every day</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ritual-${ritual}-from`}>From</Label>
              <Input
                id={`ritual-${ritual}-from`}
                name="from"
                type="time"
                value={draft.from}
                disabled={!trusted}
                onChange={(event) => patch({ from: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ritual-${ritual}-template`}>Opens</Label>
              {meta.journal ? (
                <select
                  id={`ritual-${ritual}-template`}
                  name="template"
                  className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                  value={draft.templateId}
                  disabled={!trusted}
                  onChange={(event) => patch({ templateId: event.target.value })}
                >
                  <option value="">— none —</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.icon} {template.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="flex h-9 items-center text-sm text-muted-foreground">Today’s planner</p>
              )}
              {noTarget && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Without a template this prompt will not show.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`ritual-${ritual}-title`}>Title</Label>
              <Input
                id={`ritual-${ritual}-title`}
                name="title"
                value={draft.title}
                disabled={!trusted}
                onChange={(event) => patch({ title: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Preview: <span className="text-foreground">{fillName(draft.title, PREVIEW_NAME)}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ritual-${ritual}-cta`}>Call to action</Label>
              <Input
                id={`ritual-${ritual}-cta`}
                name="cta"
                value={draft.ctaLabel}
                disabled={!trusted}
                onChange={(event) => patch({ ctaLabel: event.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`ritual-${ritual}-description`}>Description</Label>
              <Textarea
                id={`ritual-${ritual}-description`}
                name="description"
                rows={3}
                value={draft.description}
                disabled={!trusted}
                onChange={(event) => patch({ description: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                <code>{'{name}'}</code> becomes the user’s name in any of these.
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {trusted && (
            <div className="flex items-center justify-end gap-3">
              {savedAt !== null && !dirty && (
                <span className="text-xs text-muted-foreground">Saved</span>
              )}
              <Button type="submit" disabled={!dirty || saving}>
                <BellRing className="mr-1.5 size-4" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/components/admin/RitualsHub.test.tsx`
Expected: PASS (9 tests). If the read-only test's switch assertion fails on attribute naming, inspect the rendered switch (`screen.debug(card(/daily plan/i))`) and assert on whichever of `aria-disabled` / `data-disabled` base-ui sets — do not loosen the test to "renders".

- [ ] **Step 5: Lint**

Run: `npx eslint src/components/admin/RitualsHub.tsx src/components/admin/RitualsHub.test.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/RitualsHub.tsx src/components/admin/RitualsHub.test.tsx
git commit -m "feat(admin): rituals hub form for the four prompt settings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Route, navigation entry, docs, end-to-end check

**Files:**
- Create: `src/app/(app)/admin/rituals/page.tsx`
- Modify: `src/components/admin/AdminShell.tsx` (`sections`, line 8–17)
- Modify: `docs/routes.md` (admin table, after `/admin/productivity`)
- Modify: `docs/superpowers/specs/2026-09-19-ritual-settings-admin-design.md` (status line)

**Interfaces:**
- Consumes: `RitualsHub` (Task 6), `normalizeRitualSettings` (Task 2), `hasTrustedAdminRole` from `@/lib/admin`.

- [ ] **Step 1: The page**

```tsx
// src/app/(app)/admin/rituals/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasTrustedAdminRole } from '@/lib/admin'
import { normalizeRitualSettings } from '@/lib/rituals'
import { RitualsHub } from '@/components/admin/RitualsHub'

export default async function AdminRitualsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: ritualRows }, { data: templateRows }] = await Promise.all([
    supabase.from('ritual_settings').select('*'),
    // Only system templates: a prompt every user sees cannot open one
    // user's private template.
    supabase
      .from('journal_templates')
      .select('id, name, icon')
      .eq('is_system', true)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const templates = ((templateRows ?? []) as { id: string; name: string; icon: string | null }[]).map(
    (template) => ({ id: template.id, name: template.name, icon: template.icon ?? '📓' })
  )

  return (
    <RitualsHub
      userId={user.id}
      trusted={hasTrustedAdminRole(user)}
      settings={normalizeRitualSettings(ritualRows)}
      templates={templates}
    />
  )
}
```

(The admin layout already 404s non-admins and previewing admins; the page does not repeat that.)

- [ ] **Step 2: Navigation**

In `src/components/admin/AdminShell.tsx`, add `BellRing` to the lucide import and insert after the Productivity entry:

```ts
  { href: '/admin/rituals', label: 'Rituals', icon: BellRing },
```

- [ ] **Step 3: Docs**

In `docs/routes.md`, after the `/admin/productivity` row:

```markdown
| `/admin/rituals` | Global settings for the four dashboard ritual prompts: enabled, window, target template, copy (saving needs the trusted admin role) |
```

In the spec, change `**Status:** Draft, awaiting review` to `**Status:** Approved, implemented`.

- [ ] **Step 4: Typecheck, lint, full suite**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/(app)/admin/rituals/page.tsx" src/components/admin/AdminShell.tsx && npx vitest run`
Expected: all clean.

- [ ] **Step 5: End-to-end check in the browser (migration applied)**

1. Sign in as a trusted admin, open `/admin/rituals`: four cards, current values, Save disabled.
2. Evening Review: set From to the current time, Save. Toast-free success ("Saved" label), no error.
3. Open `/dashboard`: the Evening Review prompt opens (if today's entry does not exist), with the configured title.
4. Back in `/admin/rituals`, turn Evening Review off, Save, reload `/dashboard`: no prompt.
5. Restore 20:00 and enabled.
6. If an allowlist-only admin account exists: open `/admin/rituals` with it — notice shown, fields disabled, no Save.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/admin/rituals/page.tsx" src/components/admin/AdminShell.tsx docs/routes.md docs/superpowers/specs/2026-09-19-ritual-settings-admin-design.md
git commit -m "feat(admin): /admin/rituals hub and navigation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- Spec coverage: storage + RLS + seed (Task 1); lib defaults/normalize (2); window rule, `fillName`, dismiss keys, trimmed `weekly-rituals` (3); prompts take copy, `EVENING_REVIEW_DISMISS_PREFIX` dropped (4); dashboard reads settings, name lookup removed, hold-back generalized, entries query on configured ids (5); admin hub with all controls, read-only mode, validation, inline errors (6); route, nav, docs (7). Error handling: defaults on failed read (5, Step 1), null target hides prompt (4/5/6), RLS rejection inline (6).
- The spec's "toast on success" is implemented as an inline "Saved" label: the project's `sonner` Toaster is not mounted anywhere in `src/app`, so a toast would render nothing. Same intent, visible result.
- Type consistency: `PromptCopy { title, description, ctaLabel }` is used identically in Tasks 4–6; `RitualSetting.fromMinutes` ↔ row `from_minutes`, `templateId` ↔ `template_id`, `ctaLabel` ↔ `cta_label` mapped only in `normalizeRitualSettings` (2) and the save payload (6).

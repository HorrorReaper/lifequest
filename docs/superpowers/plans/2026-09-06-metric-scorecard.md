# Metric Scorecard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each tracked metric an optional target, and show how the latest recorded value stands against it as a dashboard section.

**Architecture:** Targets live in a new `metric_targets` table keyed `(user_id, field_id)`, because `template_fields.config` is shared across users. A pure module joins tracked metrics, targets, and latest values into rows. Targets are set on `/journal/metrics`, beside the chart that shows where you stand; the dashboard section is read-only and renders nothing when no targets exist.

**Tech Stack:** Next.js 16 App Router (server components; `searchParams`/`cookies` are async), Supabase (SSR + browser client, RLS), Tailwind v4, Base UI (`@base-ui/react`), Vitest 4 + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-06-metric-scorecard-design.md`

## Global Constraints

- **No `@testing-library/jest-dom`.** Assertions use plain DOM properties and plain vitest matchers: `expect(el).toHaveProperty('value', 'x')`, `expect(el.getAttribute('aria-checked')).toBe('true')`, `expect(screen.getByText('…')).toBeTruthy()`.
- **A metric is a `number` template field with `config.track_as_metric === true`.** There is no metrics table. Values live in `journal_responses.value_number`, dated through `journal_entries.entry_date`.
- **Direction values are exactly `'at_least'` and `'at_most'`.** Equality counts as met in both directions.
- **A row appears only when the field has a target AND is still a tracked metric.** A tracked metric without a target does not appear; a target whose field stopped being tracked does not appear, and is not deleted.
- **`LATEST_VALUE_WINDOW_DAYS = 365`.** A metric with no value inside the window reads "no value yet" rather than showing a stale number.
- **Run tests with `npx vitest run <path>`**, typecheck with `npx tsc --noEmit`, lint with `npm run lint`. Lint has 32 pre-existing errors in `src/lib/city/unlock-engine.ts` and `src/lib/supabase/helpers.ts` — ignore those; only check that your own files produce none.
- **Git identity is not configured.** Every commit must pass it inline:
  `git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "…"`
- **Work on a branch** off `staging`: `git checkout -b feat/metric-scorecard`.
- **Do not apply the migration.** Writing the `.sql` file is the whole job; applying it is the repo owner's call.

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260906130000_create_metric_targets.sql` (create) | The table and its four RLS policies. |
| `src/lib/supabase/database.types.ts` (modify) | `MetricTargetRow` and its entry in the tables map. |
| `src/lib/metric-targets.ts` (create) | Types, the three pure functions, and the four Supabase calls. No React. |
| `src/lib/metric-targets.test.ts` (create) | Tests for the pure functions. |
| `src/components/journal/MetricTargetControl.tsx` (create) | Set, change and remove one metric's target. |
| `src/components/journal/MetricTargetControl.test.tsx` (create) | Tests for the above. |
| `src/app/(app)/journal/metrics/page.tsx` (modify) | Fetch targets, render a control under each chart. |
| `src/components/dashboard/ScorecardSection.tsx` (create) | Read-only rows with progress bars. Renders nothing when empty. |
| `src/components/dashboard/ScorecardSection.test.tsx` (create) | Tests for the above. |
| `src/lib/dashboard-sections.ts` (modify) | The `scorecard` registry entry. |
| `src/lib/dashboard-sections.test.ts` (modify) | Six assertions that a seventh section breaks. |
| `src/app/(app)/dashboard/page.tsx` (modify) | Fetch and render the section. |

---

### Task 1: The table

Enabling change. Nothing reads it yet, so no test should change behaviour.

**Files:**
- Create: `supabase/migrations/20260906130000_create_metric_targets.sql`
- Modify: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MetricTargetRow = { user_id: string; field_id: string; target_value: number; direction: 'at_least' | 'at_most'; created_at: string; updated_at: string }`, registered as `metric_targets` in the tables map.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260906130000_create_metric_targets.sql`:

```sql
create table public.metric_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.template_fields(id) on delete cascade,
  target_value numeric not null,
  direction text not null default 'at_least'
    check (direction in ('at_least', 'at_most')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, field_id)
);

comment on table public.metric_targets is
  'A user''s target for one tracked metric. Keyed by the template field the metric is, because template_fields.config belongs to the template and is shared by every user of a system template.';

alter table public.metric_targets enable row level security;

create policy "Users can read their own metric targets"
on public.metric_targets
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own metric targets"
on public.metric_targets
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own metric targets"
on public.metric_targets
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own metric targets"
on public.metric_targets
for delete
to authenticated
using ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Add the row type**

`src/lib/supabase/database.types.ts` is hand-maintained, not generated. Near the other `export type …Row` declarations at the top of the file, add:

```ts
export type MetricTargetRow = { user_id: string; field_id: string; target_value: number; direction: 'at_least' | 'at_most'; created_at: string; updated_at: string }
```

- [ ] **Step 3: Register the table**

In the same file, find the tables map containing the line
`workout_preferences: MutableTable<WorkoutPreferenceRow, 'user_id'>`
and add directly below it:

```ts
      metric_targets: MutableTable<MetricTargetRow, 'user_id' | 'field_id'>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all files pass. Nothing reads the table yet, so any failure means something else broke.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260906130000_create_metric_targets.sql src/lib/supabase/database.types.ts
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(metrics): add the metric_targets table

Keyed by user and template field, because template_fields.config belongs
to the template and system templates are shared by everyone -- a target
stored there would be imposed on every user."
```

---

### Task 2: The library

Pure functions plus the Supabase calls. Everything the feature decides is decided here.

**Files:**
- Create: `src/lib/metric-targets.ts`
- Test: `src/lib/metric-targets.test.ts`

**Interfaces:**
- Consumes: `MetricTargetRow` from Task 1; `TrackedMetric` from `src/lib/metrics.ts` (`{ fieldId, templateId, templateName, label, unit }`).
- Produces:
  - `type MetricTargetDirection = 'at_least' | 'at_most'`
  - `interface MetricTarget { fieldId: string; targetValue: number; direction: MetricTargetDirection }`
  - `interface LatestValue { value: number; date: string }`
  - `interface ScorecardRow { fieldId: string; label: string; unit: string | null; targetValue: number; direction: MetricTargetDirection; latestValue: number | null; latestDate: string | null; met: boolean }`
  - `const LATEST_VALUE_WINDOW_DAYS = 365`
  - `metTarget(value: number, target: number, direction: MetricTargetDirection): boolean`
  - `latestByFieldId(responses: { field_id: string; entry_id: string; value_number: number | null }[], entryDateById: Map<string, string>): Record<string, LatestValue>`
  - `buildScorecardRows(input: { metrics: TrackedMetric[]; targets: MetricTarget[]; latest: Record<string, LatestValue> }): ScorecardRow[]`
  - `fetchMetricTargets(supabase: SupabaseClient, userId: string): Promise<MetricTarget[]>`
  - `fetchLatestMetricValues(supabase: SupabaseClient, userId: string, fieldIds: string[]): Promise<Record<string, LatestValue>>`
  - `upsertMetricTarget(supabase: SupabaseClient, userId: string, input: { fieldId: string; targetValue: number; direction: MetricTargetDirection }): Promise<void>`
  - `deleteMetricTarget(supabase: SupabaseClient, userId: string, fieldId: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/metric-targets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { TrackedMetric } from '@/lib/metrics'
import {
  buildScorecardRows,
  latestByFieldId,
  metTarget,
  type MetricTarget,
} from '@/lib/metric-targets'

function metric(overrides: Partial<TrackedMetric> = {}): TrackedMetric {
  return {
    fieldId: 'field-steps',
    templateId: 'tpl-1',
    templateName: 'Daily check-in',
    label: 'Steps',
    unit: 'steps',
    ...overrides,
  }
}

function target(overrides: Partial<MetricTarget> = {}): MetricTarget {
  return {
    fieldId: 'field-steps',
    targetValue: 8000,
    direction: 'at_least',
    ...overrides,
  }
}

describe('metTarget', () => {
  it('meets an at_least target at or above it', () => {
    expect(metTarget(8000, 8000, 'at_least')).toBe(true)
    expect(metTarget(9000, 8000, 'at_least')).toBe(true)
  })

  it('misses an at_least target below it', () => {
    expect(metTarget(7999, 8000, 'at_least')).toBe(false)
  })

  it('meets an at_most target at or below it', () => {
    // Exactly two coffees against "at most two" is met, not missed.
    expect(metTarget(2, 2, 'at_most')).toBe(true)
    expect(metTarget(1, 2, 'at_most')).toBe(true)
  })

  it('misses an at_most target above it', () => {
    expect(metTarget(3, 2, 'at_most')).toBe(false)
  })
})

describe('latestByFieldId', () => {
  const dates = new Map([
    ['entry-old', '2026-08-01'],
    ['entry-new', '2026-09-01'],
  ])

  it('keeps the value from the most recent entry', () => {
    const result = latestByFieldId(
      [
        { field_id: 'field-steps', entry_id: 'entry-old', value_number: 5000 },
        { field_id: 'field-steps', entry_id: 'entry-new', value_number: 9000 },
      ],
      dates
    )

    expect(result['field-steps']).toEqual({ value: 9000, date: '2026-09-01' })
  })

  it('does not depend on the order responses arrive in', () => {
    const result = latestByFieldId(
      [
        { field_id: 'field-steps', entry_id: 'entry-new', value_number: 9000 },
        { field_id: 'field-steps', entry_id: 'entry-old', value_number: 5000 },
      ],
      dates
    )

    expect(result['field-steps']).toEqual({ value: 9000, date: '2026-09-01' })
  })

  it('keeps each field separate', () => {
    const result = latestByFieldId(
      [
        { field_id: 'field-steps', entry_id: 'entry-new', value_number: 9000 },
        { field_id: 'field-coffee', entry_id: 'entry-old', value_number: 3 },
      ],
      dates
    )

    expect(result['field-steps'].value).toBe(9000)
    expect(result['field-coffee'].value).toBe(3)
  })

  it('ignores a response with no number', () => {
    const result = latestByFieldId(
      [{ field_id: 'field-steps', entry_id: 'entry-new', value_number: null }],
      dates
    )

    expect(result['field-steps']).toBeUndefined()
  })

  it('ignores a response whose entry is not in the window', () => {
    const result = latestByFieldId(
      [{ field_id: 'field-steps', entry_id: 'entry-missing', value_number: 9000 }],
      dates
    )

    expect(result).toEqual({})
  })

  it('survives no responses at all', () => {
    expect(latestByFieldId([], dates)).toEqual({})
  })
})

describe('buildScorecardRows', () => {
  it('builds a row from a metric, its target and its latest value', () => {
    const rows = buildScorecardRows({
      metrics: [metric()],
      targets: [target()],
      latest: { 'field-steps': { value: 7400, date: '2026-09-01' } },
    })

    expect(rows).toEqual([
      {
        fieldId: 'field-steps',
        label: 'Steps',
        unit: 'steps',
        targetValue: 8000,
        direction: 'at_least',
        latestValue: 7400,
        latestDate: '2026-09-01',
        met: false,
      },
    ])
  })

  it('leaves out a tracked metric that has no target', () => {
    const rows = buildScorecardRows({
      metrics: [metric(), metric({ fieldId: 'field-coffee', label: 'Coffee' })],
      targets: [target()],
      latest: {},
    })

    expect(rows.map((row) => row.fieldId)).toEqual(['field-steps'])
  })

  it('leaves out a target whose field is no longer a tracked metric', () => {
    // The target is not deleted -- turning tracking back on restores the row.
    const rows = buildScorecardRows({
      metrics: [],
      targets: [target()],
      latest: { 'field-steps': { value: 9000, date: '2026-09-01' } },
    })

    expect(rows).toEqual([])
  })

  it('reports no value when nothing was recorded in the window', () => {
    const rows = buildScorecardRows({
      metrics: [metric()],
      targets: [target()],
      latest: {},
    })

    expect(rows[0].latestValue).toBeNull()
    expect(rows[0].latestDate).toBeNull()
    expect(rows[0].met).toBe(false)
  })

  it('follows the order of the metrics, not the targets', () => {
    const rows = buildScorecardRows({
      metrics: [
        metric({ fieldId: 'field-steps' }),
        metric({ fieldId: 'field-coffee', label: 'Coffee' }),
      ],
      targets: [
        target({ fieldId: 'field-coffee', targetValue: 2, direction: 'at_most' }),
        target({ fieldId: 'field-steps' }),
      ],
      latest: {},
    })

    expect(rows.map((row) => row.fieldId)).toEqual(['field-steps', 'field-coffee'])
  })

  it('marks a met target as met', () => {
    const rows = buildScorecardRows({
      metrics: [metric()],
      targets: [target()],
      latest: { 'field-steps': { value: 8200, date: '2026-09-01' } },
    })

    expect(rows[0].met).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/metric-targets.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/metric-targets"`.

- [ ] **Step 3: Write the module**

Create `src/lib/metric-targets.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TrackedMetric } from '@/lib/metrics'

export type MetricTargetDirection = 'at_least' | 'at_most'

export interface MetricTarget {
  fieldId: string
  targetValue: number
  direction: MetricTargetDirection
}

export interface LatestValue {
  value: number
  date: string
}

export interface ScorecardRow {
  fieldId: string
  label: string
  unit: string | null
  targetValue: number
  direction: MetricTargetDirection
  latestValue: number | null
  latestDate: string | null
  met: boolean
}

/**
 * How far back a value still counts as the current one.
 *
 * Outside this the row reads "no value yet" rather than showing a
 * two-year-old number against a target as though it were today's.
 */
export const LATEST_VALUE_WINDOW_DAYS = 365

/**
 * Whether a value satisfies its target.
 *
 * Equality counts as met in both directions: exactly two coffees against
 * "at most two" is the target, not a miss.
 */
export function metTarget(
  value: number,
  target: number,
  direction: MetricTargetDirection
): boolean {
  return direction === 'at_least' ? value >= target : value <= target
}

/**
 * The most recent recorded value per field.
 *
 * A response whose entry is outside the fetched window has no date here and
 * is dropped, which is what makes the window the definition of "current".
 */
export function latestByFieldId(
  responses: { field_id: string; entry_id: string; value_number: number | null }[],
  entryDateById: Map<string, string>
): Record<string, LatestValue> {
  const latest: Record<string, LatestValue> = {}

  for (const response of responses) {
    if (response.value_number === null) continue
    const date = entryDateById.get(response.entry_id)
    if (!date) continue

    const current = latest[response.field_id]
    if (!current || date > current.date) {
      latest[response.field_id] = { value: response.value_number, date }
    }
  }

  return latest
}

/**
 * Joins the three sources into the rows the scorecard renders.
 *
 * Driven by the metrics, so rows inherit their order, and so a target whose
 * field stopped being a tracked metric simply does not appear -- without
 * being deleted, which means turning tracking back on restores it.
 */
export function buildScorecardRows({
  metrics,
  targets,
  latest,
}: {
  metrics: TrackedMetric[]
  targets: MetricTarget[]
  latest: Record<string, LatestValue>
}): ScorecardRow[] {
  const targetByFieldId = new Map(targets.map((target) => [target.fieldId, target]))

  return metrics
    .map((metric) => {
      const target = targetByFieldId.get(metric.fieldId)
      if (!target) return null

      const value = latest[metric.fieldId] ?? null

      return {
        fieldId: metric.fieldId,
        label: metric.label,
        unit: metric.unit,
        targetValue: target.targetValue,
        direction: target.direction,
        latestValue: value ? value.value : null,
        latestDate: value ? value.date : null,
        met: value ? metTarget(value.value, target.targetValue, target.direction) : false,
      } satisfies ScorecardRow
    })
    .filter((row): row is ScorecardRow => row !== null)
}

export async function fetchMetricTargets(
  supabase: SupabaseClient,
  userId: string
): Promise<MetricTarget[]> {
  const { data } = await supabase
    .from('metric_targets')
    .select('field_id, target_value, direction')
    .eq('user_id', userId)

  const rows = (data ?? []) as {
    field_id: string
    target_value: number
    direction: MetricTargetDirection
  }[]

  return rows.map((row) => ({
    fieldId: row.field_id,
    targetValue: row.target_value,
    direction: row.direction,
  }))
}

/**
 * The latest value for every targeted field, in one pair of queries.
 *
 * Mirrors fetchMetricSeries' two-step shape rather than introducing
 * PostgREST embedding, which appears nowhere else here. Unlike that
 * function it runs once for the whole scorecard, not once per metric.
 */
export async function fetchLatestMetricValues(
  supabase: SupabaseClient,
  userId: string,
  fieldIds: string[]
): Promise<Record<string, LatestValue>> {
  if (fieldIds.length === 0) return {}

  const since = new Date()
  since.setDate(since.getDate() - LATEST_VALUE_WINDOW_DAYS)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data: entryRows } = await supabase
    .from('journal_entries')
    .select('id, entry_date')
    .eq('user_id', userId)
    .gte('entry_date', sinceDate)

  const entries = (entryRows ?? []) as { id: string; entry_date: string }[]
  if (entries.length === 0) return {}

  const entryDateById = new Map(entries.map((entry) => [entry.id, entry.entry_date]))

  const { data: responseRows } = await supabase
    .from('journal_responses')
    .select('field_id, entry_id, value_number')
    .in('field_id', fieldIds)
    .in(
      'entry_id',
      entries.map((entry) => entry.id)
    )
    .not('value_number', 'is', null)

  return latestByFieldId(
    (responseRows ?? []) as {
      field_id: string
      entry_id: string
      value_number: number | null
    }[],
    entryDateById
  )
}

export async function upsertMetricTarget(
  supabase: SupabaseClient,
  userId: string,
  input: { fieldId: string; targetValue: number; direction: MetricTargetDirection }
): Promise<void> {
  const { error } = await supabase.from('metric_targets').upsert(
    {
      user_id: userId,
      field_id: input.fieldId,
      target_value: input.targetValue,
      direction: input.direction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,field_id' }
  )

  if (error) throw error
}

export async function deleteMetricTarget(
  supabase: SupabaseClient,
  userId: string,
  fieldId: string
): Promise<void> {
  const { error } = await supabase
    .from('metric_targets')
    .delete()
    .eq('user_id', userId)
    .eq('field_id', fieldId)

  if (error) throw error
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/metric-targets.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm run lint 2>&1 | grep metric-targets`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/metric-targets.ts src/lib/metric-targets.test.ts
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(metrics): targets, latest values, and the rows they make

Equality counts as met in both directions. Rows are driven by the
metrics, so they inherit that order and a target whose field stopped
being tracked disappears without being deleted."
```

---

### Task 3: Setting a target

**Files:**
- Create: `src/components/journal/MetricTargetControl.tsx`
- Create: `src/components/journal/MetricTargetControl.test.tsx`
- Modify: `src/app/(app)/journal/metrics/page.tsx`

**Interfaces:**
- Consumes: `MetricTarget`, `MetricTargetDirection`, `upsertMetricTarget`, `deleteMetricTarget`, `fetchMetricTargets` from Task 2.
- Produces: `MetricTargetControl(props: { userId: string; fieldId: string; label: string; unit: string | null; initial: MetricTarget | null })`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/journal/MetricTargetControl.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetricTargetControl } from '@/components/journal/MetricTargetControl'

const upsertMetricTarget = vi.fn()
const deleteMetricTarget = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/metric-targets', async () => {
  const actual = await vi.importActual<typeof import('@/lib/metric-targets')>(
    '@/lib/metric-targets'
  )
  return {
    ...actual,
    upsertMetricTarget: (...a: unknown[]) => upsertMetricTarget(...a),
    deleteMetricTarget: (...a: unknown[]) => deleteMetricTarget(...a),
  }
})

const props = {
  userId: 'user-1',
  fieldId: 'field-steps',
  label: 'Steps',
  unit: 'steps',
}

beforeEach(() => {
  upsertMetricTarget.mockReset().mockResolvedValue(undefined)
  deleteMetricTarget.mockReset().mockResolvedValue(undefined)
  refresh.mockReset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MetricTargetControl', () => {
  it('invites a target when there is none', () => {
    render(<MetricTargetControl {...props} initial={null} />)

    expect(screen.getByRole('button', { name: /set a target/i })).toBeTruthy()
  })

  it('states the target it already has', () => {
    render(
      <MetricTargetControl
        {...props}
        initial={{ fieldId: 'field-steps', targetValue: 8000, direction: 'at_least' }}
      />
    )

    expect(screen.getByText(/at least 8000 steps/i)).toBeTruthy()
  })

  it('states an at_most target as a limit', () => {
    render(
      <MetricTargetControl
        {...props}
        label="Coffee"
        unit="cups"
        initial={{ fieldId: 'field-steps', targetValue: 2, direction: 'at_most' }}
      />
    )

    expect(screen.getByText(/at most 2 cups/i)).toBeTruthy()
  })

  it('tells you a target shows up on the dashboard', async () => {
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    expect(screen.getByText(/dashboard/i)).toBeTruthy()
  })

  it('saves what the dialog submits', async () => {
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '8000' } })
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'at_most' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    await waitFor(() =>
      expect(upsertMetricTarget).toHaveBeenCalledWith(expect.anything(), 'user-1', {
        fieldId: 'field-steps',
        targetValue: 8000,
        direction: 'at_most',
      })
    )
  })

  it('changes a target it already has', async () => {
    render(
      <MetricTargetControl
        {...props}
        initial={{ fieldId: 'field-steps', targetValue: 8000, direction: 'at_least' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /at least 8000 steps/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    // The dialog opens on the current value, so editing starts from it.
    expect(screen.getByLabelText('Target')).toHaveProperty('value', '8000')

    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '10000' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    await waitFor(() =>
      expect(upsertMetricTarget).toHaveBeenCalledWith(expect.anything(), 'user-1', {
        fieldId: 'field-steps',
        targetValue: 10000,
        direction: 'at_least',
      })
    )
    // And the button reflects the new target without a reload.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /at least 10000 steps/i })).toBeTruthy()
    )
  })

  it('removes the target it has', async () => {
    render(
      <MetricTargetControl
        {...props}
        initial={{ fieldId: 'field-steps', targetValue: 8000, direction: 'at_least' }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /at least 8000 steps/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /remove target/i }))

    await waitFor(() =>
      expect(deleteMetricTarget).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'field-steps'
      )
    )
  })

  it('explains a failed save instead of closing', async () => {
    upsertMetricTarget.mockRejectedValue(new Error('offline'))
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '8000' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    await waitFor(() => expect(screen.getByText(/could not save/i)).toBeTruthy())
    expect(screen.getByLabelText('Target')).toBeTruthy()
  })

  it('refuses a target that is not a number', async () => {
    render(<MetricTargetControl {...props} initial={null} />)
    fireEvent.click(screen.getByRole('button', { name: /set a target/i }))

    await waitFor(() => expect(screen.getByLabelText('Target')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Target'), { target: { value: '' } })
    fireEvent.submit(screen.getByLabelText('Target').closest('form') as HTMLFormElement)

    expect(upsertMetricTarget).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/journal/MetricTargetControl.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/journal/MetricTargetControl"`.

- [ ] **Step 3: Write the component**

Create `src/components/journal/MetricTargetControl.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target as TargetIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  deleteMetricTarget,
  upsertMetricTarget,
  type MetricTarget,
  type MetricTargetDirection,
} from '@/lib/metric-targets'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface MetricTargetControlProps {
  userId: string
  fieldId: string
  label: string
  unit: string | null
  initial: MetricTarget | null
}

function describeTarget(target: MetricTarget, unit: string | null) {
  const direction = target.direction === 'at_least' ? 'At least' : 'At most'
  return unit
    ? `${direction} ${target.targetValue} ${unit}`
    : `${direction} ${target.targetValue}`
}

/**
 * Sets one metric's target, next to the chart that shows where it stands.
 *
 * That placement is the point: a target is a number you can only judge
 * against the history already on this page.
 */
export function MetricTargetControl({
  userId,
  fieldId,
  label,
  unit,
  initial,
}: MetricTargetControlProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const [target, setTarget] = useState<MetricTarget | null>(initial)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initial ? String(initial.targetValue) : '')
  const [direction, setDirection] = useState<MetricTargetDirection>(
    initial?.direction ?? 'at_least'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = Number(value)
    // An empty field parses to 0, which is a legitimate target -- so the
    // blank has to be rejected before the number is looked at.
    if (value.trim() === '' || !Number.isFinite(parsed)) return

    setSaving(true)
    setError(null)
    try {
      await upsertMetricTarget(supabase, userId, {
        fieldId,
        targetValue: parsed,
        direction,
      })
      setTarget({ fieldId, targetValue: parsed, direction })
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not save this target. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    setError(null)
    try {
      await deleteMetricTarget(supabase, userId, fieldId)
      setTarget(null)
      setValue('')
      setDirection('at_least')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not remove this target. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start"
      >
        <TargetIcon />
        {target ? describeTarget(target, unit) : 'Set a target'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Target for {label}</DialogTitle>
            <DialogDescription>
              A metric with a target shows up on your dashboard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`target-direction-${fieldId}`}>Direction</Label>
              <select
                id={`target-direction-${fieldId}`}
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as MetricTargetDirection)
                }
                className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="at_least">At least</option>
                <option value="at_most">At most</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`target-value-${fieldId}`}>Target</Label>
              <Input
                id={`target-value-${fieldId}`}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={unit ? `8000 ${unit}` : '8000'}
                autoFocus
                className="h-11"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between gap-3">
              {target ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleRemove()}
                  disabled={saving}
                  className="text-destructive"
                >
                  Remove target
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save target'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/journal/MetricTargetControl.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 5: Render it on the metrics page**

In `src/app/(app)/journal/metrics/page.tsx`, add to the imports:

```tsx
import { fetchMetricTargets } from '@/lib/metric-targets'
import { MetricTargetControl } from '@/components/journal/MetricTargetControl'
```

After the existing `const series = await Promise.all(...)` block, add:

```tsx
  const targets = await fetchMetricTargets(supabase, user.id)
  const targetByFieldId = new Map(targets.map((target) => [target.fieldId, target]))
```

Replace the `metrics.map(...)` block. It currently reads:

```tsx
            {metrics.map((metric, index) => (
              <MetricChart
                key={metric.fieldId}
                label={metric.label}
                unit={metric.unit}
                templateName={metric.templateName}
                data={series[index]}
              />
            ))}
```

with — note the `key` moves to the wrapper:

```tsx
            {metrics.map((metric, index) => (
              <div key={metric.fieldId} className="space-y-2">
                <MetricChart
                  label={metric.label}
                  unit={metric.unit}
                  templateName={metric.templateName}
                  data={series[index]}
                />
                <MetricTargetControl
                  userId={user.id}
                  fieldId={metric.fieldId}
                  label={metric.label}
                  unit={metric.unit}
                  initial={targetByFieldId.get(metric.fieldId) ?? null}
                />
              </div>
            ))}
```

- [ ] **Step 6: Typecheck, test and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx vitest run`
Expected: all files pass.

Run: `npm run lint 2>&1 | grep -iE "MetricTargetControl|metrics/page"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/components/journal/MetricTargetControl.tsx src/components/journal/MetricTargetControl.test.tsx "src/app/(app)/journal/metrics/page.tsx"
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(metrics): set a target beside the chart that justifies it

The metrics page already draws each metric's history, which is the only
place you can judge whether 8000 is a sensible number. The dialog says a
target shows on the dashboard, because otherwise that connection is
invisible."
```

---

### Task 4: The scorecard on the dashboard

**Files:**
- Create: `src/components/dashboard/ScorecardSection.tsx`
- Create: `src/components/dashboard/ScorecardSection.test.tsx`
- Modify: `src/lib/dashboard-sections.ts`
- Modify: `src/lib/dashboard-sections.test.ts`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `ScorecardRow`, `buildScorecardRows`, `fetchMetricTargets`, `fetchLatestMetricValues` from Task 2; `fetchTrackedMetrics` from `src/lib/metrics.ts`; `isSectionVisible` / the `shows()` helper already present in the dashboard page.
- Produces: `ScorecardSection(props: { rows: ScorecardRow[] })`, and the `scorecard` id in `DASHBOARD_SECTIONS`.

- [ ] **Step 1: Add the registry entry**

In `src/lib/dashboard-sections.ts`, insert this **before** the `metric` entry, so the scorecard sits above the chart in both the settings list and the dashboard:

```ts
  {
    id: 'scorecard',
    label: 'Scorecard',
    description: 'How your latest numbers stand against the targets you set.',
  },
```

- [ ] **Step 2: Fix the six assertions a seventh section breaks**

`src/lib/dashboard-sections.test.ts` pins the exact section list and the counts. All of these must change, or the suite fails for reasons unrelated to your work:

1. The id list (around line 12) gains `'scorecard'` **before** `'metric'`:

```ts
    expect(DASHBOARD_SECTIONS.map((section) => section.id)).toEqual([
      'today_plan',
      'habits',
      'tasks',
      'scorecard',
      'metric',
      'quests',
      'routines',
    ])
```

2. `expect(ids).toHaveLength(5)` becomes `toHaveLength(6)`.
3. `expect(sectionsFor({ isAdmin: true })).toHaveLength(6)` becomes `toHaveLength(7)`.
4. `expect(visibleSectionCount({}, { isAdmin: false })).toBe(5)` becomes `toBe(6)`.
5. `expect(visibleSectionCount({}, { isAdmin: true })).toBe(6)` becomes `toBe(7)`.
6. The `allOff` fixture in the last test must gain the new id, or a non-admin's count is 1 rather than 0 — a missing id means visible:

```ts
    const allOff = {
      today_plan: false,
      habits: false,
      tasks: false,
      scorecard: false,
      metric: false,
      quests: false,
    }
```

- [ ] **Step 3: Run the registry tests to verify they pass**

Run: `npx vitest run src/lib/dashboard-sections.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 4: Write the failing section tests**

Create `src/components/dashboard/ScorecardSection.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScorecardSection } from '@/components/dashboard/ScorecardSection'
import type { ScorecardRow } from '@/lib/metric-targets'

function row(overrides: Partial<ScorecardRow> = {}): ScorecardRow {
  return {
    fieldId: 'field-steps',
    label: 'Steps',
    unit: 'steps',
    targetValue: 8000,
    direction: 'at_least',
    latestValue: 7400,
    latestDate: '2026-09-01',
    met: false,
    ...overrides,
  }
}

afterEach(cleanup)

describe('ScorecardSection', () => {
  it('renders nothing at all when no targets are set', () => {
    const { container } = render(<ScorecardSection rows={[]} />)

    // Opt-in by construction: a permanently empty card on every dashboard is
    // the clutter the section switches exist to remove.
    expect(container.innerHTML).toBe('')
  })

  it('shows the latest value against the target', () => {
    render(<ScorecardSection rows={[row()]} />)

    expect(screen.getByText('Steps')).toBeTruthy()
    expect(screen.getByText(/7400 of 8000 steps/i)).toBeTruthy()
  })

  it('names an at_most target as a limit', () => {
    render(
      <ScorecardSection
        rows={[
          row({
            label: 'Coffee',
            unit: 'cups',
            targetValue: 2,
            direction: 'at_most',
            latestValue: 1,
            met: true,
          }),
        ]}
      />
    )

    expect(screen.getByText(/1 of at most 2 cups/i)).toBeTruthy()
  })

  it('says so when nothing has been recorded in the window', () => {
    render(<ScorecardSection rows={[row({ latestValue: null, latestDate: null })]} />)

    expect(screen.getByText(/no value yet/i)).toBeTruthy()
  })

  it('lists every row it is given', () => {
    render(
      <ScorecardSection
        rows={[row(), row({ fieldId: 'field-coffee', label: 'Coffee' })]}
      />
    )

    expect(screen.getByText('Steps')).toBeTruthy()
    expect(screen.getByText('Coffee')).toBeTruthy()
  })

  it('links to where targets are set', () => {
    render(<ScorecardSection rows={[row()]} />)

    expect(
      screen.getByRole('link', { name: /metrics/i }).getAttribute('href')
    ).toBe('/journal/metrics')
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/components/dashboard/ScorecardSection.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/dashboard/ScorecardSection"`.

- [ ] **Step 6: Write the section**

Create `src/components/dashboard/ScorecardSection.tsx`:

```tsx
import Link from 'next/link'
import { Target } from 'lucide-react'
import type { ScorecardRow } from '@/lib/metric-targets'
import { cn } from '@/lib/utils'

interface ScorecardSectionProps {
  rows: ScorecardRow[]
}

function formatNumber(value: number) {
  return String(Math.round(value * 100) / 100)
}

function describeRow(row: ScorecardRow) {
  const target =
    row.direction === 'at_most'
      ? `at most ${formatNumber(row.targetValue)}`
      : formatNumber(row.targetValue)
  const suffix = row.unit ? ` ${row.unit}` : ''

  if (row.latestValue === null) return `No value yet · ${target}${suffix}`
  return `${formatNumber(row.latestValue)} of ${target}${suffix}`
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * The latest number for each metric that has a target.
 *
 * Read-only and fed entirely by server props. Renders nothing without
 * targets: the section is opt-in by construction, so an empty one would be
 * clutter on every dashboard that never asked for it.
 */
export function ScorecardSection({ rows }: ScorecardSectionProps) {
  if (rows.length === 0) return null

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Target className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">Scorecard</h2>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground sm:text-xs">
          {rows.filter((row) => row.met).length} of {rows.length} met
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          // Fill means closeness to the target in both directions. Only the
          // colour flips: for a limit, full is bad and beyond it worse.
          const fill =
            row.latestValue === null || row.targetValue === 0
              ? 0
              : Math.min((row.latestValue / row.targetValue) * 100, 100)

          return (
            <li key={row.fieldId} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-base sm:text-sm">
                  {row.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground sm:text-xs">
                  {describeRow(row)}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    row.latestValue === null
                      ? 'bg-transparent'
                      : row.met
                        ? 'bg-primary'
                        : 'bg-destructive'
                  )}
                  style={{ width: `${fill}%` }}
                />
              </div>

              {row.latestDate && (
                <p className="text-xs text-muted-foreground">
                  Last recorded {formatDate(row.latestDate)}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-4 border-t pt-3">
        <Link
          href="/journal/metrics"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
        >
          All metrics →
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/components/dashboard/ScorecardSection.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 8: Fetch the rows on the dashboard**

In `src/app/(app)/dashboard/page.tsx`, add to the imports:

```tsx
import { ScorecardSection } from '@/components/dashboard/ScorecardSection'
import {
  buildScorecardRows,
  fetchLatestMetricValues,
  fetchMetricTargets,
} from '@/lib/metric-targets'
```

The metric block currently reads (around line 140):

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

Replace it with — note that **both** sections need the tracked metrics, but only the chart needs the per-metric series:

```tsx
  // Both sections need the metric list; only the chart needs a full series
  // per metric, which is the expensive part.
  const trackedMetrics =
    shows('metric') || shows('scorecard')
      ? await fetchTrackedMetrics(supabase, user.id)
      : []
  const trackedMetricSeries = shows('metric')
    ? await Promise.all(
        trackedMetrics.map((metric) =>
          fetchMetricSeries(supabase, user.id, metric.fieldId)
        )
      )
    : []
```

Then, directly after the `primaryMetricSeries` assignment that follows it, add:

```tsx
  const metricTargets = shows('scorecard')
    ? await fetchMetricTargets(supabase, user.id)
    : []
  const scorecardRows = shows('scorecard')
    ? buildScorecardRows({
        metrics: trackedMetrics,
        targets: metricTargets,
        latest: await fetchLatestMetricValues(
          supabase,
          user.id,
          metricTargets.map((target) => target.fieldId)
        ),
      })
    : []
```

- [ ] **Step 9: Render the section**

In the same file, find the metric widget block:

```tsx
        {shows('metric') && primaryMetric && (
          <MetricDashboardWidget
```

and insert directly **above** it:

```tsx
        {shows('scorecard') && <ScorecardSection rows={scorecardRows} />}

```

- [ ] **Step 10: Typecheck, test, lint and check by hand**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx vitest run`
Expected: all files pass.

Run: `npm run lint 2>&1 | grep -iE "ScorecardSection|dashboard-sections|dashboard/page"`
Expected: no output.

By hand, with both migrations applied (`npx supabase db push`) and signed in:
1. `/journal/metrics` — a metric shows "Set a target". Set "At least 8000".
2. `/dashboard` — the Scorecard section appears above the metric chart, with that row.
3. `/settings` — "Start screen" now lists a Scorecard switch. Turn it off.
4. `/dashboard` — the section is gone; the metric chart is unaffected.
5. Turn it back on, then remove the target on `/journal/metrics`.
6. `/dashboard` — the section is gone again, this time because it has no rows.

- [ ] **Step 11: Commit**

```bash
git add src/components/dashboard/ScorecardSection.tsx src/components/dashboard/ScorecardSection.test.tsx src/lib/dashboard-sections.ts src/lib/dashboard-sections.test.ts "src/app/(app)/dashboard/page.tsx"
git -c user.name="Patrick Eger" -c user.email="pe.business004@outlook.de" commit -m "feat(dashboard): show the scorecard section

Rows come from the targets, so the section renders nothing until one is
set -- opt-in by construction rather than an empty card on every
dashboard.

Both this and the metric chart need the tracked-metric list, so that
fetch now runs for either; only the chart pays for a full series per
metric. The registry entry needs no migration: a missing id means
visible, so the section appears for everyone who saved their switches
before it existed."
```

---

## Done

- Both migrations applied (`npx supabase db push`) — targets cannot save without `metric_targets`.
- `npx vitest run` green.
- `npx tsc --noEmit` clean.
- `npm run lint` produces nothing for the touched files.
- The manual walk in Task 4, Step 10 passes.

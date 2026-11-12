# Standalone Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn metrics from flagged journal-template fields into standalone records that users create from the + menu, log on the dashboard or on a per-metric page, and optionally ask for in a journal template.

**Architecture:** Two new tables: `metrics` (definition, target, optional template link) and `metric_values` (one row per metric per day, upserted, so the latest value wins). A one-time SQL migration turns existing `track_as_metric` fields into metrics, and a re-runnable function copies their values. The UI reads only the new tables. Journal entries write linked values into `metric_values` dated by the entry. The old field-based code is parked in `src/lib/legacy-metrics.ts` during the build and deleted in the last task.

**Tech Stack:** Next.js 16 (App Router, server components), Supabase (Postgres, RLS, supabase-js), React 19, Tailwind, `src/components/ui/*` (Base UI dialog), recharts, vitest + Testing Library, PGlite for SQL checks.

**Spec:** `docs/superpowers/specs/2026-11-01-standalone-metrics-design.md`. Read it before starting any task. Its "Approved interaction details" and "Decisions" sections are binding.

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing route or server-component code (`AGENTS.md`: "This is NOT the Next.js you know").
- **No commits or pushes unless the user explicitly asks.** The "Checkpoint" step at the end of each task means: stop, report and propose the commit message. It does not mean commit.
- Every task updates `docs/` in the same task, per `AGENTS.md` and the table in `docs/reference/maintenance.md`. Do not touch the "Last verified" line in `docs/README.md`.
- Create and edit flows open in `src/components/ui/dialog.tsx` dialogs, modelled on `src/components/habits/HabitEditorDialog.tsx`. Never as an inline expanding form.
- App UI copy is English. Exact strings:
  - Log dialog button: `Save for today`
  - Replace warning: `You already logged {value} today. Saving replaces it.` (`{value}` = number plus unit, e.g. `81.6 kg`)
  - Last value line: `Last: {value} · {Mon D}`, or `Last: nothing yet`
  - Log dialog link: `Open {name} ›`
  - Empty state: title `Track a number over time`, body `Weight, steps, sleep, revenue — anything you can count. Log it in a tap, see the trend, set a target.`, button `Create your first metric`
  - Created hint: `Almost there.` + `Want the app to tell you when you're on track, or ask for this number in your journal?`, buttons `Set a target`, `Ask in journal`, `Later`
  - Quick action: title `Metric`, description `Track a number over time — weight, steps, sleep…`
  - History source: `Entered` for manual values, otherwise the template name
  - Template builder: `Also asks for: {names}`, field editor: `Feeds metric: {name}`
  - Archived link: `Asked in {template} (archived)` with action `Change template`
- Validation: name 1–60 characters after trim; unit optional, at most 12 characters. Numbers are parsed with `parseDecimal` (`src/lib/decimal.ts`), so `81,6` is accepted.
- "Today" is always `dateInTimezone(new Date(), timezone)` (`src/lib/dates.ts`), computed on the server from the profile's timezone and passed down as a `today: string` prop. It is never `new Date().toISOString()` in a client component.
- One value per metric per day. Every write is an upsert on `(metric_id, value_date)`.

## Review Focus

1. **Comma decimals** (`81,6` on a German keyboard) must save `81.6` everywhere a number is typed: log dialog, log box, value dialog, settings target, journal block. Pinned in Task 3 and Task 9 tests.
2. **Late-evening logging across time zones:** a value logged at 23:30 in Berlin goes to that Berlin day, not to the UTC next day. Pinned in Task 3 (dialog uses the `today` prop) and Task 9 (entry date).
3. **Float drift from the stepper:** `81.6 − 0.1` must show `81.5`, not `81.49999999999999`. Pinned in Task 2 (`applyStep`).
4. **Double-tap on Save** must not send two writes or show an error. The button is disabled while busy. Pinned in Task 3.
5. **Empty or non-numeric input:** Save is disabled and nothing is written. An empty journal-block input leaves the day's value alone. Pinned in Task 3 and Task 9.

---

### Task 1: Schema, RLS and data migration

**Files:**
- Create: `supabase/migrations/20261101120000_create_standalone_metrics.sql`
- Create: `supabase/migrations/20261101120100_migrate_tracked_metrics.sql`
- Create: `scripts/verify-standalone-metrics.mjs`
- Modify: `src/lib/supabase/database.types.ts` (add `metrics`, `metric_values` Row/Insert/Update, in the style of the existing tables)
- Modify: `docs/backend/data-model.md`, `docs/backend/auth-security.md`, `docs/operations/testing.md`, `docs/operations/deployment.md`

**Interfaces:**
- Produces: tables `public.metrics`, `public.metric_values`, `public.metric_legacy_fields(metric_id uuid references metrics on delete cascade, field_id uuid primary key)`, and function `public.backfill_metric_values() returns integer`.

- [ ] **Step 1: Write the PGlite check script `scripts/verify-standalone-metrics.mjs`.** Copy the bootstrap shape of `scripts/verify-focus-timer.mjs`: roles, `auth.uid()`, users alice and bob. Add minimal `journal_templates(id, user_id, name, is_active, is_system, created_at)`, `template_fields(id, template_id, field_type, label, config jsonb)`, `journal_entries(id, user_id, template_id, entry_date, created_at)`, `journal_responses(entry_id, field_id, value_number)` and the real `metric_targets` migration. Seed:
  - alice "Weight" (unit `kg`) on archived template T1 with values on day D1 and D2;
  - alice "weight " (unit `kg`) on active template T2 with values on D2 (later entry) and D3, plus a target `at_most 80` on the T2 field;
  - alice "Steps" on T2 with no values;
  - bob "Weight" on his own template.

  Then apply both migrations and assert:
  - alice has exactly 2 metrics. "Weight" has `template_id = T2` and `source_field_id` = the T2 field, target `80 / at_most`, and values D1, D2 (the T2 value), D3. "Steps" has no values.
  - bob has 1 metric.
  - `select public.backfill_metric_values()` run a second time changes nothing.
  - After inserting a manual alice value (source null) for D3 and re-running the backfill, the manual value stays.
  - A new journal value on D4 is picked up by a re-run.
  - RLS: as bob, alice's `metrics` and `metric_values` are invisible. Bob cannot insert a `metric_values` row for alice's metric (`42501` or 0 rows). Inserting two values for one metric and day fails with `23505`.
  - `anon` sees nothing.
  - `authenticated` cannot execute `backfill_metric_values` (`42501`).
- [ ] **Step 2: Run it and watch it fail.** Run: `LIFEQUEST_PGLITE_MODULE=<file URL of pglite dist/index.js> node scripts/verify-standalone-metrics.mjs`. Expected: fails because the migration file is not found.
- [ ] **Step 3: Write `20261101120000_create_standalone_metrics.sql`.**
  - Tables exactly as in the spec's "Storage" section, plus `metric_legacy_fields`.
  - Four RLS policies on `metrics` and on `metric_values`, in the `metric_targets` style. The `metric_values` insert/update `with check` also requires `exists (select 1 from public.metrics m where m.id = metric_id and m.user_id = (select auth.uid()))`.
  - RLS enabled on `metric_legacy_fields` with no policies and no grants.
  - Grants to `authenticated` on the two user tables.
  - `comment on table` lines in the style of `metric_targets`.
- [ ] **Step 4: Write `20261101120100_migrate_tracked_metrics.sql`.**
  - **Part A** (plain SQL, runs once): group user-owned `number` fields with `config->>'track_as_metric' = 'true'` per owner by `lower(trim(label))` + `nullif(trim(config->>'metric_unit'), '')`. Insert one metric per group:
    - link fields from the group's field on an active template, newest template first;
    - otherwise both link fields are null;
    - fill `metric_legacy_fields` for every field in the group;
    - copy targets from `metric_targets` via the mapping, preferring the linked field's target.
  - **Part B:** `create function public.backfill_metric_values() returns integer language sql security definer set search_path = public`. Per (metric, entry_date), take the response with the latest `journal_entries.created_at`. Insert with `on conflict (metric_id, value_date) do update` only when the existing row's `source_entry_id` is not null and its entry's `created_at` is older than the incoming one. Return the number of rows written.
  - Revoke execute from `public, anon, authenticated`. Call it once at the end of the migration.
- [ ] **Step 5: Run the script and watch it pass.** Same command. Expected: `ok: N checks`, exit 0.
- [ ] **Step 6: Add the types to `database.types.ts` and update the docs.**
  - `data-model.md`: the new tables and the fact that `metric_targets` is now legacy.
  - `auth-security.md`: the RLS rules.
  - `testing.md`: how to run the script.
  - `deployment.md`: the rollout. Apply both migrations. Deploy. Run `select public.backfill_metric_values();` once more right after the new code reaches Production. Dropping `metric_targets`, `metric_legacy_fields` and the function happens in a later migration, which is not part of this plan.
- [ ] **Step 7: Run `npx tsc --noEmit`.** Expected: no new errors.
- [ ] **Step 8: Checkpoint.** Proposed message: `feat(metrics): add standalone metrics tables and migrate tracked fields`.

### Task 2: Metrics data layer

**Files:**
- Move: `src/lib/metrics.ts` → `src/lib/legacy-metrics.ts`, and `src/lib/metrics.test.ts` → `src/lib/legacy-metrics.test.ts`. Update the importers: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/journal/metrics/page.tsx`, `src/lib/metric-targets.ts` and anything `grep -rn "@/lib/metrics'" src` finds.
- Create: `src/lib/metrics.ts`, `src/lib/metrics.test.ts`

**Interfaces:**
- Produces (all exported from `src/lib/metrics.ts`):
  ```ts
  export type MetricTargetDirection = 'at_least' | 'at_most'
  export interface Metric { id: string; name: string; unit: string | null; targetValue: number | null; targetDirection: MetricTargetDirection | null; templateId: string | null; templateName: string | null; templateArchived: boolean; sourceFieldId: string | null; createdAt: string }
  export interface MetricValue { date: string; value: number; sourceEntryId: string | null; sourceLabel: string | null }
  export interface LatestValue { value: number; date: string }
  export interface ScorecardRow { metricId: string; name: string; unit: string | null; targetValue: number | null; direction: MetricTargetDirection | null; latestValue: number | null; latestDate: string | null; met: boolean | null }
  export const METRIC_NAME_MAX = 60; export const METRIC_UNIT_MAX = 12
  export function validateMetricInput(input: { name: string; unit: string }): string | null
  export function metTarget(value: number, target: number, direction: MetricTargetDirection): boolean
  export function stepFor(latest: number | null): number
  export function applyStep(value: number, step: number, sign: 1 | -1): number
  export function formatMetricValue(value: number, unit: string | null): string
  export function buildScorecardRows(metrics: Metric[], latest: Record<string, LatestValue>): ScorecardRow[]
  export function matchFieldsByLabel(oldFields: { id: string; label: string }[], newFields: { id: string; label: string }[]): Map<string, string | null>
  export function entryMetricWrites(input: { linked: Metric[]; fieldValues: Record<string, number | null>; blockValues: Record<string, string> }): { metricId: string; value: number }[]
  export function buildMetricAssistantContext(metrics: Metric[], values: Record<string, MetricValue[]>): { name: string; unit: string | null; target: string | null; recent: { date: string; value: number }[] }[]
  export async function fetchMetrics(supabase: SupabaseClient, userId: string): Promise<Metric[]>
  export async function fetchMetric(supabase: SupabaseClient, userId: string, metricId: string): Promise<Metric | null>
  export async function fetchMetricValues(supabase: SupabaseClient, metricId: string, sinceDate?: string): Promise<MetricValue[]>
  export async function fetchLatestValues(supabase: SupabaseClient, metricIds: string[]): Promise<Record<string, LatestValue>>
  export async function fetchLinkedMetrics(supabase: SupabaseClient, userId: string, templateId: string, fieldIds: string[]): Promise<Metric[]>
  export async function createMetric(supabase: SupabaseClient, userId: string, input: { name: string; unit: string }): Promise<Metric>
  export async function updateMetric(supabase: SupabaseClient, metricId: string, patch: { unit?: string | null; targetValue?: number | null; targetDirection?: MetricTargetDirection | null; templateId?: string | null }): Promise<void>
  export async function deleteMetric(supabase: SupabaseClient, metricId: string): Promise<void>
  export async function logMetricValue(supabase: SupabaseClient, userId: string, input: { metricId: string; date: string; value: number; sourceEntryId?: string | null }): Promise<void>
  export async function updateMetricValue(supabase: SupabaseClient, metricId: string, date: string, value: number): Promise<void>
  export async function deleteMetricValue(supabase: SupabaseClient, metricId: string, date: string): Promise<void>
  ```
  The spec's `fetchMetricSeries(metricId, days)` becomes `fetchMetricValues(…, sinceDate)`. The spec's `shapeSeries` is unnecessary, because the table already holds one row per day.

- [ ] **Step 1: Move the old files and fix the imports.** Run `npm test`. Expected: same pass count as before.
- [ ] **Step 2: Write the failing tests in `src/lib/metrics.test.ts`:**
  - `stepFor`: `null→1`, `0→0.1`, `9.9→0.1`, `10→0.5`, `99→0.5`, `100→1`, `999→1`, `1000→10`, `9999→10`, `10000→100`.
  - `applyStep`: `applyStep(81.6, 0.1, -1) === 81.5`, `applyStep(0.2, 0.1, 1) === 0.3`, `applyStep(8000, 500, 1) === 8500`.
  - `metTarget`: both directions, with equality counting as met (carry over the cases from `metric-targets.test.ts`).
  - `validateMetricInput`: `''` and `'   '` give an error; 61 characters give an error; a 13-character unit gives an error; `{ name: 'Weight', unit: '' }` gives `null`.
  - `buildScorecardRows`:
    - a metric without a target gives `targetValue: null, met: null`;
    - `at_most 2` with latest 3 gives `met: false`;
    - a metric with no latest value gives `latestValue: null`;
    - order follows the input.
  - `matchFieldsByLabel`: exact label maps to the new id; a missing label maps to `null`; duplicate labels map in order.
  - `entryMetricWrites`:
    - a metric with `sourceFieldId` takes `fieldValues[sourceFieldId]`;
    - a block metric takes `parseDecimal(blockValues[id])`, so `'81,6' → 81.6`;
    - empty or unparsable values are omitted.
  - `buildMetricAssistantContext`: at most 14 most recent values per metric, newest last, and a target string like `at most 80 kg`.
  - `logMetricValue`: with a fake client, records `upsert({ metric_id, user_id, value_date, value, source_entry_id: null }, { onConflict: 'metric_id,value_date' })`.
- [ ] **Step 3: Run `npx vitest run src/lib/metrics.test.ts`.** Expected: FAIL, functions not defined.
- [ ] **Step 4: Implement `src/lib/metrics.ts` with the signatures above.**
  - `fetchMetrics` orders by `created_at`. It joins template name and active flag with a second query on `journal_templates`. There is no PostgREST embedding, to match `legacy-metrics.ts`.
  - `fetchMetricValues` returns rows in ascending date order. `sourceLabel` is the template name of `source_entry_id`'s entry (two-step query), or `null`.
  - `applyStep` rounds to the step's decimal places.
  - Every write throws on a Supabase error.
- [ ] **Step 5: Run `npx vitest run src/lib/metrics.test.ts`.** Expected: PASS.
- [ ] **Step 6: Note the new module in `docs/features/journal.md`** under "Metrics", with one line saying the section is being rebuilt and pointing to the spec. Task 12 rewrites the section.
- [ ] **Step 7: Checkpoint.** Proposed message: `feat(metrics): add data layer for standalone metrics`.

### Task 3: Stepper, log dialog and create dialog

**Files:**
- Create: `src/components/metrics/MetricStepper.tsx`, `MetricLogDialog.tsx`, `MetricCreateDialog.tsx`, `MetricEmptyState.tsx`, each with a co-located `*.test.tsx`

**Interfaces:**
- Consumes: Task 2 `applyStep`, `stepFor`, `formatMetricValue`, `validateMetricInput`, `logMetricValue`, `createMetric`.
- Produces:
  ```ts
  MetricStepper(props: { value: string; onChange: (value: string) => void; step: number; unit: string | null; label: string })
  MetricLogDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; userId: string; metric: Pick<Metric, 'id' | 'name' | 'unit'>; latest: LatestValue | null; today: string })
  MetricCreateDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; userId: string })
  MetricEmptyState(props: { onCreate: () => void })
  ```

- [ ] **Step 1: Write the failing tests:**
  - **Stepper:**
    - `+` on `'81.6'` with step 0.1 calls `onChange('81.7')`;
    - `+` on an empty value with step 1 steps from `0` and calls `onChange('1')`;
    - the buttons are labelled `Decrease {label}` / `Increase {label}`.
  - **Log dialog:**
    - prefilled with `latest.value`;
    - with `latest.date === today` it shows `You already logged 81.6 kg today. Saving replaces it.`;
    - otherwise it shows `Last: 81.6 kg · Oct 30`;
    - typing `81,2` and clicking `Save for today` calls `logMetricValue` once with `{ metricId, date: today, value: 81.2 }`, then `router.refresh()`;
    - a second click while pending does not call it again;
    - an empty value disables the button;
    - on a rejected write, an error message shows and the dialog stays open;
    - an `Open Weight ›` link points to `/journal/metrics/{id}?from=home`.
  - **Create dialog:**
    - `Create` is disabled until a name is typed;
    - submitting calls `createMetric({ name: 'Water', unit: 'glasses' })`, then `router.push('/journal/metrics/{id}?created=1')`;
    - a 13-character unit cannot be typed (`maxLength=12`).
  - **Empty state:** renders the exact copy, and the button calls `onCreate`.
- [ ] **Step 2: Run `npx vitest run src/components/metrics`.** Expected: FAIL.
- [ ] **Step 3: Implement the four components** with `Dialog`, `Button`, `Input` and `Label` from `src/components/ui/`, following `HabitEditorDialog`'s busy/error pattern. Mock `@/lib/supabase/client` and `next/navigation` in the tests, as `MetricTargetControl.test.tsx` does.
- [ ] **Step 4: Run `npx vitest run src/components/metrics`.** Expected: PASS.
- [ ] **Step 5: Add one paragraph to the Metrics section of `docs/features/journal.md`:** log dialog, create dialog, "latest wins" warning.
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(metrics): add stepper, log and create dialogs`.

### Task 4: Metric page: view, log box, chart, history

**Files:**
- Create: `src/app/(app)/journal/metrics/[metricId]/page.tsx`, `loading.tsx` (copy the shape of `../loading.tsx`)
- Create: `src/components/metrics/MetricLogBox.tsx`, `MetricHistoryList.tsx`, `MetricPageHeader.tsx`, with tests
- Modify: `src/components/journal/MetricChart.tsx`: replace `templateName: string` with `subtitle?: string`; add `targetValue?: number | null` (dashed `ReferenceLine`), `today: string`, and an internal range selector `30d | 90d | 180d` (default 30) that filters `data` to `date >= addDays(today, -range)`.
- Modify: `docs/routes.md`

**Interfaces:**
- Consumes: Task 2 `fetchMetric`, `fetchMetricValues`; Task 3 `MetricStepper`.
- Produces:
  ```ts
  MetricLogBox(props: { userId: string; metric: Pick<Metric, 'id' | 'name' | 'unit'>; latest: LatestValue | null; today: string })
  MetricHistoryList(props: { metric: Pick<Metric, 'id' | 'name' | 'unit'>; values: MetricValue[]; onSelect?: (value: MetricValue) => void })
  MetricPageHeader(props: { metric: Metric; backHref: '/dashboard' | '/journal/metrics'; settingsSlot?: React.ReactNode })
  ```
  The page reads `searchParams` `from` (`home` → back to `/dashboard` with label `‹ Home`, otherwise `‹ Metrics`) and `created` (used in Task 6).

- [ ] **Step 1: Write the failing tests:**
  - **Log box:** heading `Log today`, or `Update today` when `latest.date === today`; save behaviour as in the Task 3 log dialog (same assertions, including `81,2`, double-click and empty input).
  - **History list:**
    - rows newest first;
    - source label `Entered` for `sourceLabel: null`, otherwise the template name;
    - each row is a button that calls `onSelect` with its value;
    - with no values it shows `Nothing logged yet.`
  - **Header:** back link text and href for both `backHref` values; the subtitle shows the target text (`at most 80 kg`) or `No target`.
  - **`MetricChart`:** with values on today−40 and today−5, `30d` shows one point and `90d` shows two.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** The page is a server component:
  - `redirect('/login')` without a user;
  - `notFound()` when `fetchMetric` returns `null`;
  - `today` from the profile timezone, as in `habits/page.tsx`;
  - values since `addDays(today, -180)`.

  It composes `MetricPageHeader`, `MetricLogBox`, `MetricChart` and `MetricHistoryList`. `MetricLogBox` and `MetricLogDialog` share `MetricStepper` and the same save logic. Extract a hook `useLogMetricValue(userId)` into `src/components/metrics/use-log-metric-value.ts` if both would otherwise duplicate the busy/error/refresh code.
- [ ] **Step 4: Run the tests.** Expected: PASS. Then run `npm test` to make sure the old metrics page still passes with the changed `MetricChart` props (pass `subtitle={metric.templateName}` there).
- [ ] **Step 5: Add `/journal/metrics/[metricId]` to `docs/routes.md`.**
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(metrics): add per-metric page with log box, chart and history`.

### Task 5: Correct or delete a past value

**Files:**
- Create: `src/components/metrics/MetricValueDialog.tsx`, with a test
- Modify: `src/components/metrics/MetricHistoryList.tsx` (owns the dialog's open state when no `onSelect` is passed)

**Interfaces:**
- Consumes: Task 2 `updateMetricValue`, `deleteMetricValue`.
- Produces: `MetricValueDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; metric: Pick<Metric, 'id' | 'name' | 'unit'>; value: MetricValue })`

- [ ] **Step 1: Write the failing tests:**
  - the title shows the formatted date (`Oct 29`), and the input is prefilled;
  - saving `82,0` calls `updateMetricValue(id, '2026-10-29', 82)`, then `router.refresh()`;
  - `Delete value` asks `Delete this value?` and calls `deleteMetricValue` only after confirming;
  - the source line still reads the template name after editing (the dialog never touches `source_entry_id`);
  - there is no date input.
- [ ] **Step 2: Run the test.** Expected: FAIL.
- [ ] **Step 3: Implement** with `Dialog` and `MetricStepper`, plus the busy/error pattern.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Add a sentence to the journal.md Metrics section:** past values can be edited or deleted, not added; deleting never touches the journal entry.
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(metrics): edit or delete past values from the history`.

### Task 6: Settings dialog and created hint

**Files:**
- Create: `src/components/metrics/MetricSettingsDialog.tsx`, `MetricCreatedHint.tsx`, with tests
- Modify: `src/components/metrics/MetricPageHeader.tsx` (gear button opens settings; renders the hint when `created`), `src/app/(app)/journal/metrics/[metricId]/page.tsx` (loads the templates for the select)

**Interfaces:**
- Consumes: Task 2 `updateMetric`, `deleteMetric`.
- Produces:
  ```ts
  MetricSettingsDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; metric: Metric; templates: { id: string; name: string; archived: boolean }[]; focus?: 'target' | 'journal' })
  MetricCreatedHint(props: { onSetTarget: () => void; onAskInJournal: () => void; onDismiss: () => void })
  ```
  The template list is the user's active templates plus active system templates, the same filter `legacy-metrics.ts` uses. It also includes the currently linked template when that template is archived.

- [ ] **Step 1: Write the failing tests:**
  - **Settings dialog:**
    - the target switch reveals `At least` / `At most` and a value. Saving `8000` with `at_least` calls `updateMetric(id, { targetValue: 8000, targetDirection: 'at_least', ... })`. Switching the target off sends both as `null`.
    - "Also ask in my journal" with a selected template sends `templateId`; switching it off sends `templateId: null`.
    - when `metric.templateArchived`, it shows `Asked in Morning check-in (archived)` and `Change template`, which focuses the select.
    - `Delete metric` asks `Delete {name} and all its values?`, then calls `deleteMetric` and `router.push('/journal/metrics')`.
    - the unit is limited to 12 characters.
  - **Created hint:** the three buttons call their callbacks. `Later` calls `onDismiss`, and the header then calls `router.replace` on the URL without `created`.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** `MetricPageHeader` holds the dialog open state and the `focus` value, so both hint buttons open the same dialog at the right section.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Update the journal.md Metrics section:** settings, archived-template hint, created hint.
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(metrics): add metric settings and first-run hint`.

### Task 7: Metrics list, create entry points, quick action

**Files:**
- Modify: `src/app/(app)/journal/metrics/page.tsx` (rewrite)
- Create: `src/components/metrics/MetricList.tsx`, `MetricCreateLauncher.tsx`, with tests
- Modify: `src/components/layout/quick-action-button.tsx` (add the `Metric` action after `Habit`, with the `LineChart` icon and `href: '/journal/metrics?new=1'`), plus its existing test if it asserts the list
- Modify: `docs/features/core-app.md` (quick actions)

**Interfaces:**
- Consumes: Task 2 `fetchMetrics`, `fetchLatestValues`; Task 3 `MetricCreateDialog`, `MetricEmptyState`.
- Produces:
  ```ts
  MetricList(props: { metrics: Metric[]; latest: Record<string, LatestValue>; previous: Record<string, number | null> })
  MetricCreateLauncher(props: { userId: string; initiallyOpen: boolean; variant: 'button' | 'empty' })
  ```

- [ ] **Step 1: Write the failing tests:**
  - **List:**
    - each row links to `/journal/metrics/{id}`;
    - it shows the latest value with unit and date, or `No value yet`;
    - it shows the trend arrow `↗` / `↘` / `→` compared with `previous`;
    - linked rows show `📓 {templateName}`.
  - **Launcher:**
    - `initiallyOpen` opens the create dialog on mount;
    - `variant='empty'` renders `MetricEmptyState`;
    - `variant='button'` renders `+ New`.
  - **Quick actions:** the `Metric` item exists with the exact description and href.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** Rewrite the page: `searchParams.new === '1'` sets `initiallyOpen`, with a remount key exactly like `habits/page.tsx`. Show the empty state when there are no metrics. `previous` comes from the second-newest value; compute it from one `metric_values` query ordered by date. Remove `MetricTargetControl` from this page.
- [ ] **Step 4: Run the tests and `npm test`.** Expected: PASS.
- [ ] **Step 5: Update the docs** (`core-app.md` quick actions, journal.md list paragraph).
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(metrics): metrics list, create from + menu`.

### Task 8: Dashboard scorecard and metric widget

**Files:**
- Modify: `src/components/dashboard/ScorecardSection.tsx` (becomes `'use client'`), `ScorecardSection.test.tsx` (rewrite)
- Modify: `src/components/dashboard/MetricDashboardWidget.tsx` (`label` → `name`, add `metricId`, link to `/journal/metrics/{id}?from=home`)
- Modify: `src/app/(app)/dashboard/page.tsx:214-251` and `:663-670`
- Modify: `src/lib/dashboard-sections.ts` (scorecard description: `Your metrics: log a number, see where you stand.`)
- Modify: `docs/features/core-app.md`, `docs/superpowers/specs/2026-09-06-metric-scorecard-design.md` (status line: `Superseded by 2026-11-01-standalone-metrics-design.md`)

**Interfaces:**
- Consumes: Task 2 `fetchMetrics`, `fetchLatestValues`, `fetchMetricValues`, `buildScorecardRows`; Task 3 `MetricLogDialog`, `MetricCreateLauncher` (Task 7).
- Produces: `ScorecardSection(props: { rows: ScorecardRow[]; userId: string; today: string })`

- [ ] **Step 1: Rewrite the failing tests:**
  - with `rows=[]` it renders the empty state, not nothing;
  - a row without a target shows the value and date but no progressbar;
  - a row with `at_most` shows `1 of at most 2 cups`, as before;
  - the row's name and value are a link to `/journal/metrics/{id}?from=home`;
  - the `+` button (`aria-label="Log {name}"`) opens `MetricLogDialog` for that metric;
  - the header count `{met} of {withTarget} met` counts only rows with a target, and is hidden when none has one.
- [ ] **Step 2: Run `npx vitest run src/components/dashboard/ScorecardSection.test.tsx`.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Replace the section-wide `ClickableSection` with a plain card. A whole-section link cannot contain row links and buttons.
  - Keep the fill and colour logic.
  - In the dashboard page: when `shows('scorecard') || shows('metric')`, call `fetchMetrics` and `fetchLatestValues`. When `shows('metric')`, call `fetchMetricValues` per metric since `addDays(today, -180)` and keep the "first metric with data" choice.
  - Pass `today` and `userId`.
- [ ] **Step 4: Run the tests and `npm test`.** Expected: PASS.
- [ ] **Step 5: Update the docs** listed above.
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(dashboard): log metrics from the scorecard`.

### Task 9: Journal entries write linked metrics

**Files:**
- Create: `src/components/journal/JournalMetricsBlock.tsx`, with a test
- Modify: `src/components/journal/entry-form.tsx` (new props `entryDate?: string` and `linkedMetrics?: { metric: Metric; value: number | null }[]`; render the block; write after the response insert, next to the learnings sync)
- Modify: `src/app/(app)/journal/new/[templateId]/page.tsx`, `src/app/(app)/journal/[entryId]/page.tsx` (load `fetchLinkedMetrics` plus each metric's value for the entry date; `[entryId]` passes `entryDate={entry.entry_date}`)
- Modify: `src/components/journal/entry-form.test.tsx` if it exists, otherwise create it for these cases only

**Interfaces:**
- Consumes: Task 2 `fetchLinkedMetrics`, `entryMetricWrites`, `logMetricValue`, `formatMetricValue`.
- Produces: `JournalMetricsBlock(props: { metrics: { metric: Metric; value: number | null }[]; values: Record<string, string>; onChange: (metricId: string, value: string) => void; entryDate: string; today: string })`

- [ ] **Step 1: Write the failing tests:**
  - the block lists only metrics without a `sourceFieldId` among the template's fields;
  - each input is prefilled with the entry date's value;
  - when the value exists, the hint reads `Already logged for this day ({value}). Changing it replaces it.`;
  - submitting a new entry writes `logMetricValue` with `date` = the computed `today` and `sourceEntryId` = the new entry id, for both a block metric (`'81,6' → 81.6`) and a `sourceFieldId` metric (its number field's value);
  - editing an entry with `entryDate='2026-10-20'` writes `date: '2026-10-20'`;
  - an empty block input writes nothing for that metric;
  - a failing metric write shows the form's existing error message and does not lose the entry (the entry and responses are already saved; the message tells the user to retry).
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The write date is `entryDate ?? today`, where `today` is the existing `dateInTimezone` value at `entry-form.tsx:379`.
  - The writes come from `entryMetricWrites`.
  - Place the block below the template's fields. In the mobile wizard, it is the last step before submit; it is rendered as part of the final step, not as a new step type.
- [ ] **Step 4: Run the tests and `npm test`.** Expected: PASS.
- [ ] **Step 5: Update the journal.md Metrics section:** journal link, entry date, no template field is added.
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(journal): write linked metric values from entries`.

### Task 10: Template builder keeps links intact

**Files:**
- Modify: `src/components/template-builder/template-builder.tsx` (around lines 195–240: before deleting fields, read `metrics` with `source_field_id` in the old field ids plus the old `{id, label}`s; after inserting, re-point with `matchFieldsByLabel` via `updateMetric`-style updates on `source_field_id`; show `Also asks for: {names}` from `metrics.template_id`)
- Modify: `src/components/template-builder/field-config-editor.tsx:275-302` (remove the switch and unit input; show `Feeds metric: {name}` when the field id is in a new `feedsMetricByFieldId: Record<string, string>` prop)
- Modify: `src/lib/field-registry.ts:59` (`defaultConfig` for `number` drops `track_as_metric` and `metric_unit`)
- Tests: `template-builder.test.tsx`, plus a new `field-config-editor.test.tsx` if none exists

**Interfaces:**
- Consumes: Task 2 `matchFieldsByLabel`, `fetchMetrics` (or a direct select on `metrics`).
- Produces: none for later tasks.

- [ ] **Step 1: Write the failing tests:**
  - the field editor shows no `Track as metric` text, and shows `Feeds metric: Weight` for the mapped field;
  - the builder shows `Also asks for: Weight, Sleep` when two metrics link the template;
  - saving a response-free template whose field `Weight` feeds a metric issues an update setting `source_field_id` to the re-inserted `Weight` field's id;
  - a removed field leads to `source_field_id: null`.
- [ ] **Step 2: Run the tests.** Expected: FAIL.
- [ ] **Step 3: Implement.** Do not change the delete-and-reinsert approach itself.
- [ ] **Step 4: Run the tests and `npm test`.** Expected: PASS.
- [ ] **Step 5: Update journal.md** (template builder paragraph).
- [ ] **Step 6: Checkpoint.** Proposed message: `feat(templates): keep metric links when templates change`.

### Task 11: Assistant sees metric values

**Files:**
- Modify: `src/app/api/chat/route.ts`: add `metrics` to the `AssistantContext` type (around line 131) and fill it in `fetchAssistantContext` (line 303) from `fetchMetrics` plus `metric_values` of the last 30 days, via `buildMetricAssistantContext`
- Modify: `docs/backend/api.md`

**Interfaces:**
- Consumes: Task 2 `fetchMetrics`, `buildMetricAssistantContext`.

- [ ] **Step 1: Covered by the Task 2 unit test for `buildMetricAssistantContext`.** Add one more case: a metric with no values gives `recent: []`.
- [ ] **Step 2: Implement.** Use the same `db` client and error handling as the other context queries. Use one query for all values: `.in('metric_id', ids).gte('value_date', since)`.
- [ ] **Step 3: Run `npx vitest run src/lib/metrics.test.ts` and `npx tsc --noEmit`.** Expected: PASS, no new type errors.
- [ ] **Step 4: Update `docs/backend/api.md`** (chat context now includes metrics).
- [ ] **Step 5: Checkpoint.** Proposed message: `feat(chat): include metric values in assistant context`.

### Task 12: Remove legacy code, final docs, verification

**Files:**
- Delete: `src/lib/legacy-metrics.ts`, `src/lib/legacy-metrics.test.ts`, `src/lib/metric-targets.ts`, `src/lib/metric-targets.test.ts`, `src/components/journal/MetricTargetControl.tsx` and its test
- Modify: `docs/features/journal.md` (replace the whole "Metrics" section with the new behaviour), `docs/operations/testing.md` (new test files), `docs/reference/known-limitations.md` (no daily sums; no logging for past dates; `metric_targets` and `metric_legacy_fields` still to be dropped)

- [ ] **Step 1: Confirm no references remain.** Run `grep -rn "legacy-metrics\|metric-targets\|MetricTargetControl\|track_as_metric" src`. Expected: no matches.
- [ ] **Step 2: Delete the files and rewrite the docs.**
- [ ] **Step 3: Run the full checks:** `npm test -- --maxWorkers=2`, `npx tsc --noEmit`, `npx eslint <changed files>`, `npm run build`. Expected: all pass. Full ESLint may still show the pre-existing errors in untouched files (see `docs/operations/testing.md`).
- [ ] **Step 4: Browser check on `localhost:3000`** (the preview config `lifequest-attach` attaches to the running server), on a mobile viewport:
  1. + menu → `Metric` → create `Water` / `glasses` → you land on its page with the hint.
  2. `Set a target` → at least 8 → save.
  3. Dashboard → `+` on Water → `3` → `Save for today` → the row shows 3.
  4. `+` again → the replace warning shows → `5` → the row shows 5.
  5. Tap the Water row → the page shows the history with one `Entered` value.
  6. Settings → `Ask in journal` → pick a template → write that entry with `6` → the history shows 6 with the template name.
  7. Tap the history row → change it to `7` → then delete it.

  This requires the migrations on the shared database (Task 1 rollout). If they are not applied yet, stop and report it instead of applying them yourself.
- [ ] **Step 5: Checkpoint.** Report the results and propose the final commit or PR. Nothing is committed without the user's go-ahead.

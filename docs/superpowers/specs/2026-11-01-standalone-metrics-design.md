# Standalone metrics

**Date:** 2026-11-01
**Status:** Approved concept, not implemented

Make a metric its own thing, something a user creates, logs and looks at directly. It no longer depends on a field hidden inside a journal template.

Clickable sketch of the approved concept ("Kombi 1+3"):
`.superpowers/brainstorm/20875-1793544126/content/metrics-concepts-v2.html`
(local scratch, not committed).

## Why

Today a metric is a `number` template field with `config.track_as_metric = true` (`src/lib/metrics.ts`, `src/components/template-builder/field-config-editor.tsx`). To track your weight you have to open Journal, then Templates, then a template, add a Number field, open its settings and switch on "Track as metric". Values can only come from a journal entry with that template. A new user has no way to guess that a metric is a template field, so the feature is effectively invisible.

The user's goal: create a metric from the menu, and enter values without going through a template.

## Goals

- A metric is a standalone record owned by the user: name, optional unit, optional target (`at_least` / `at_most`), and an optional link to one journal template.
- **Create** from the + menu (new "Metric" quick action) or from "+ New" on `/journal/metrics`. The dialog asks only for name and unit. Afterwards the user lands on the new metric's page, where a hint offers "Set a target" and "Ask in journal".
- **Log** in three places, all writing to the same history:
  1. Dashboard scorecard: a **+** button on each row opens a small log dialog.
  2. The metric's own page: a log box at the top.
  3. A journal entry, when the metric is linked to that entry's template. The value goes to the entry's date.
- **One value per metric per day: the latest wins.** A second value on the same day replaces the first. Every place where a user logs shows this before saving ("You already logged 81.6 kg today. Saving replaces it.").
- **Metric page** `/journal/metrics/[metricId]`: large latest value and date, on/off-target pill, log box, trend chart with 30 / 90 / 180-day range, and a history list that shows where each value came from ("Entered" or the template name). A settings button (gear) opens a dialog for unit, target, journal link and delete.
- **Correct or delete a past value** (user decision): tapping a row in the metric page's history list opens a small dialog with that day's value. The user can change the value or delete it. The date is fixed: logging for another day stays out of scope. Editing keeps `source_entry_id`, so the row still shows where the value came from. Deleting removes only the `metric_values` row, never the journal entry or its response. If the entry is saved again later, it writes its value back, which is consistent with "latest wins".
- **Dashboard scorecard:** tapping a row's name or value opens the metric page. The **+** opens the log dialog.
- **`/journal/metrics`** becomes a compact list (name, latest value and date, small trend, link indicator). Each row opens the metric page.
- Existing tracked fields, their values and their targets carry over without data loss.

## Non-goals

- Daily sums or averages (e.g. adding up glasses of water). Only the latest value counts, for now ("erstmal").
- Several scorecards, reordering, reminders, sharing.
- Logging a value for a date other than today. Past values can be corrected or deleted, but not added.
- Metrics on system templates' own fields. No system template has `track_as_metric` today. Checked: no seed migration sets it.

## Anti-goals

- A new user must not need to know what a template is to track a number.
- Logging must never silently create two values on one day.
- Migration must not lose or duplicate an existing value.

## Approved interaction details

These come from the sketch the user signed off.

- **Log dialog** (dashboard **+**): stepper `–  [value]  +`, prefilled with the latest value. The step size depends on the metric: 0.1 for kg, 500 for steps, and so on (see "Step size" below). It shows either "Last: 81.6 kg · Oct 30" or the replace warning. Buttons: "Save for today" and a small "Open Weight ›" link to the metric page. Built on `src/components/ui/dialog.tsx`, modelled on `HabitEditorDialog`.
- **Create dialog:** Name (required) and Unit (optional, max 12 chars, like today's `metric_unit`). "Create" is disabled until a name is entered. After creating, the app navigates to `/journal/metrics/[id]` with a dismissible hint: "Set a target", "Ask in journal", "Later".
- **Quick action:** a "Metric" entry in `QUICK_ACTIONS` (`src/components/layout/quick-action-button.tsx`) pointing to `/journal/metrics?new=1`. That route opens the create dialog, the same way `/habits?new=1` does.
- **Back navigation** from the metric page returns to wherever the user came from: dashboard ("‹ Home") or the list ("‹ Metrics").
- **Empty states** (new user): the dashboard scorecard and `/journal/metrics` show "Track a number over time" with a "Create your first metric" button that opens the create dialog.

## Decisions made while writing this (Claude's calls, flagged to the user)

### Journal link: the template asks for the metric; no template field is added

The approved sketch has "Also ask in my journal → pick a template". Adding a number field to the template is the obvious way to do that, but it does not work. `template-builder.tsx` refuses any field change once a template has responses ("Cannot modify template fields because there are existing responses…"). That covers almost every template a user actually uses. On top of that, system templates are shared and cannot get per-user fields.

So the link lives on the metric: `metrics.template_id`. When the entry form (`src/components/journal/entry-form.tsx`) renders a template, it also loads the user's metrics linked to that template. It shows them in a "Metrics" block below the template's own fields, one number input per metric, prefilled with today's value if one exists. On submit, those inputs write to `metric_values` (see storage), not to `journal_responses`. This works for every template, including system templates and templates with history, and it never touches `template_fields`.

As a result, the earlier idea that "Track as metric becomes Link to metric" in the field editor is dropped. The template builder instead gets a read-only line, "Also asks for: Weight, Sleep", with a link to each metric's page. New links are made from the metric's settings.

### Legacy field link, for migrated metrics only

A migrated metric's values came from a real template field, and that field is still in the template. If the migration only set `template_id`, the entry form would ask for the same number twice. So migrated metrics keep `metrics.source_field_id` (nullable, FK to `template_fields`, `on delete set null`):

- The entry form does not add an extra input for a metric whose `source_field_id` is one of the template's own fields. Instead, on submit, that field's `value_number` is also written to `metric_values` for the entry date.
- The field editor drops the "Track as metric" switch for new fields. For a field that is some metric's `source_field_id`, it shows "Feeds metric: Weight" instead.

New metrics never get a `source_field_id`.

### Scorecard shows every metric, not only those with a target

The current scorecard builds its rows from `metric_targets`, so a metric without a target does not appear (`docs/superpowers/specs/2026-09-06-metric-scorecard-design.md`). In the new model the scorecard is a place to log, and a fresh metric has no target yet. Hiding it would mean the user creates a metric and sees nothing on the dashboard. So every metric gets a row:

- with a target: value / target, progress bar, on/off colour, as today;
- without a target: name, latest value and date, no bar.

When the user has no metrics, the section shows the empty state instead of rendering nothing, so new users can find the feature. Hiding the section stays possible through the dashboard section switches.

### The `metric` dashboard section (single chart) stays

It now charts a metric from the new tables and still picks the first metric that has data. Removing it would change users' saved section switches. That is out of scope.

## Storage

Two new tables. They replace the `track_as_metric` flag and `metric_targets`.

```sql
create table public.metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  unit text check (unit is null or char_length(unit) <= 12),
  target_value numeric,
  target_direction text check (target_direction in ('at_least', 'at_most')),
  template_id uuid references public.journal_templates(id) on delete set null,
  source_field_id uuid references public.template_fields(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_value is null) = (target_direction is null))
);

create table public.metric_values (
  metric_id uuid not null references public.metrics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value_date date not null,
  value numeric not null,
  source_entry_id uuid references public.journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (metric_id, value_date)
);
create index on public.metric_values (user_id, value_date);
```

- **"Latest wins" is the primary key.** Every write is an upsert on `(metric_id, value_date)`. The database cannot hold two values for one day, so no reader has to resolve a conflict.
- `source_entry_id` null means "Entered" in the history. Otherwise the history shows the entry's template name. When an entry is deleted, its value stays as a plain value (`set null`). Values are the user's numbers, not part of the entry text.
- Editing an entry upserts its metric values again. If the user changes a linked value in the entry, the day's value changes. If the user clears it, the day's value stays: an empty input means "not answered", not "delete".
- **Journal values always go to the entry's `entry_date`, not to today.** That holds for a new entry and for one edited later at `/journal/[entryId]`. `EntryForm` therefore needs the entry date passed in. The "Metrics" block is prefilled with that date's value. When that date already has a value, the form shows the same replace warning as everywhere else. An old entry also shows inputs for metrics linked to its template after it was written. An empty input changes nothing. *(Claude's call.)*
- **RLS:** the four-policy `to authenticated` / `(select auth.uid()) = user_id` shape, as `metric_targets` and `tool_entries` use. On insert and update, `metric_values` also checks that the metric belongs to the same user.
- `value_date` is the user's local date, as `journal_entries.entry_date` is today.

### Step size

The stepper needs an increment, and none is stored. It is derived from the latest value's magnitude: below 10 → 0.1, below 100 → 0.5, below 1,000 → 1, below 10,000 → 10, otherwise 100. If there is no value yet, the step is 1. *Builder may refine; storing a per-metric step is a non-goal.*

### Migration of existing data

The migration has two parts: creating the metrics, and copying values into them.

**Part A: create metrics (runs once).**

1. Collect every user-owned template field with `field_type = 'number'` and `config->>'track_as_metric' = 'true'`. This includes fields on archived (`is_active = false`) templates. "Duplicate or archive the template first" means many users have the same "Weight" field on an archived original and on its active copy.
2. **Merge per user by `lower(trim(label))` + unit.** Each group becomes one `metrics` row:
   - `user_id` = the template owner
   - `name` = the label
   - `unit` = `config->>'metric_unit'`, or null if blank
   - `template_id` and `source_field_id` from the group's field on an **active** template. If there are several, take the most recently created template. If every field in the group is on archived templates, both are null and the metric keeps its history only.
   - Every field in the group is recorded in a migration-only mapping table, `metric_legacy_fields(metric_id, field_id)`, so that Part B can find all of them, including on its re-run after deploy. It is dropped together with `metric_targets` later. *(Claude's call: one "Weight" with its whole history beats two half-histories. The risk of merging two unrelated fields with the same name and unit is small.)*
3. Copy each target from `metric_targets` into the merged metric (`target_value` / `target_direction`), matched through the mapping. If several targets exist, the active field's target wins.

**Part B: copy values (idempotent, can be re-run).**

4. Take `journal_responses` for the mapped fields joined to `journal_entries`, with `value_number is not null`. When one day has several values, across entries or across merged fields, keep the one with the latest `journal_entries.created_at` (latest wins). Upsert into `metric_values` on `(metric_id, value_date)` with `source_entry_id` set, updating only if the incoming entry is newer.
5. Drop `metric_targets` in a **later** migration, once the new code is live. Keep `config.track_as_metric` in place. It stops being read but costs nothing, and it makes a rollback possible.

**Rollout.** Staging and Production share one Supabase database, and migrations are applied before code is deployed (`docs/operations/deployment.md`). In between, the old code keeps writing tracked values only to `journal_responses`.

- Part B is written as a re-runnable SQL function or script. Run it once more right after the new code reaches Production to catch values written in that window.
- Part A is not re-run. Re-running it would bring back metrics a user has already deleted. A "Track as metric" switch turned on in the short window between migration and deploy is accepted as lost. The field still collects its values in `journal_responses`.
- Testing on Staging writes real `metric_values` for the tester's own account, the same as every other feature on this shared database.

### Keeping links intact when templates change

- **Template save re-creates fields.** When a template has no responses yet, `template-builder.tsx` deletes all of its `template_fields` and inserts them again with new ids. Before deleting, the save looks up metrics whose `source_field_id` is one of the template's fields. After inserting, it points each one at the new field with the same label. If no field with that label remains, `source_field_id` becomes null. The metric keeps `template_id`, so the entry form shows it in the extra "Metrics" block instead. *(Claude's call.)*
- **Template duplicate** leaves links on the original template. When a metric's `template_id` points to an archived template, the metric page and its settings show "Asked in Morning check-in (archived)" with a "Change template" action. *(Claude's call: guessing which copy the user means is worse than asking at the point where they look.)*

## Code shape

- `src/lib/metrics.ts` is rewritten around the new tables. It provides `fetchMetrics(userId)`, `fetchMetric(id)`, `fetchMetricSeries(metricId, days)`, `logMetricValue(metricId, date, value, sourceEntryId?)`, `updateMetricValue(metricId, date, value)`, `deleteMetricValue(metricId, date)` and pure helpers for tests (`shapeSeries`, `stepFor`). `metTarget` and the row-building logic in `src/lib/metric-targets.ts` move here, or that file switches to metric ids. The old field-based functions go.
- New components in `src/components/metrics/`:
  - `MetricCreateDialog`
  - `MetricLogDialog`
  - `MetricSettingsDialog`
  - `MetricLogBox` (the page's inline stepper)
  - `MetricHistoryList`, with rows that open `MetricValueDialog`
  - `MetricValueDialog` (edit or delete one past value)
  - `MetricEmptyState`
  - Reuse `MetricChart` (`src/components/journal/MetricChart.tsx`), extended with a range prop and target line, instead of copying it. Shared stepper markup becomes one component used by both the log dialog and the log box.
- `ScorecardSection.tsx`: rows from all metrics, row link to the metric page, **+** opening `MetricLogDialog`. It stays fed by server props. The log dialog writes from the client and then calls `router.refresh()`.
- `src/app/api/chat/route.ts` builds its context from `journal_responses.value_number`. It switches to reading `metric_values` for metrics, so the chat also sees values entered directly. *(Claude's call.)*
- `entry-form.tsx`: load linked metrics for the template, render the "Metrics" block, write `metric_values` after the responses succeed. Mirror the existing journal-learnings sync, which runs after the response insert.
- Routes:
  - `/journal/metrics`: list, plus `?new=1` to open the create dialog
  - `/journal/metrics/[metricId]` (new): metric page, `notFound()` for another user's or a missing id
- `field-config-editor.tsx`: remove the switch, add the "Feeds metric" note. `template-builder` / `template-preview`: the "Also asks for" line.

## Tests (vitest)

- Upsert semantics: a second value on the same day replaces the first; the series has one point per day.
- `stepFor` boundaries.
- Scorecard rows: metric without target (no bar), `at_most` colouring, empty state when there are no metrics.
- Create dialog: disabled without a name; after creating, navigates to the metric page.
- Log dialog: prefilled with the latest value, stepper increments, shows the replace warning when today has a value.
- Entry form: linked metric input appears for its template only; submit writes `metric_values` with `source_entry_id`; a `source_field_id` metric does not get a duplicate input.
- Migration logic, where expressed in TS, or a SQL test file per repo convention: several entries on one day keep the latest.
- Metric page: another user's id gives not found.
- Value dialog: editing changes only that day and keeps the source; deleting removes the point from chart and history and leaves the journal entry untouched.
- Browser check before commit, per the user's habit: create → log from dashboard → open page → link to template → journal entry updates the history.

## Docs to update in the same change (per `docs/reference/maintenance.md`)

- `docs/features/journal.md`: rewrite the "Metrics" section.
- `docs/features/core-app.md`: scorecard and quick actions.
- `docs/routes.md`: new metric page route.
- `docs/backend/data-model.md` and `docs/backend/auth-security.md`: new tables and RLS.
- `docs/operations/testing.md`: new tests.
- Mark `2026-09-06-metric-scorecard-design.md` as superseded in its status line.

## Left to the builder

- Exact copy and microcopy beyond what the sketch shows.
- Whether `metric_targets` helpers are moved or rewritten.
- Chart library details (recharts is already used).
- Loading skeletons for the new route (follow `src/app/(app)/journal/metrics/loading.tsx`).

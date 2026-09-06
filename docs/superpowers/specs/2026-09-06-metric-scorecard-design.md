# Metric scorecard

**Date:** 2026-09-06
**Status:** Approved, not implemented

Give each tracked metric an optional target, and show how the latest value
stands against it as a dashboard section.

## Problem

A metric today is a `number` journal field carrying `track_as_metric: true`
in its config (`src/lib/metrics.ts`). There is no metrics table — values live
in `journal_responses.value_number`, dated through their journal entry.

Almost none of that reaches the user. `/journal/metrics` draws every metric
as a line chart, and the dashboard shows exactly **one** — whichever has data
first. Nowhere can you say what a number should be, so nowhere can the app
tell you whether you are hitting it.

## What a scorecard is here

Each metric may carry a target and a direction: **at least** 8,000 steps, **at
most** 2 coffees. The card shows how the latest recorded value stands against
that target — progress bars, not charts.

**One scorecard per user.** The dashboard section *is* the card: a list of
rows, no name, no picker, no management layer.

**The comparison is against the latest recorded value**, not an average, a
sum, or a hit rate. Those need a window and a rule for days without an entry;
the latest value needs neither and works whatever someone's journalling
cadence is.

Deliberately not in scope: several named scorecards, reordering rows,
weighting metrics into a single grade, and period-over-period comparison.

## Storage

Targets need per-user storage, and the obvious shortcut does not work.
`template_fields` has no `user_id` — its `config` belongs to the template —
and `fetchTrackedMetrics` reads system templates (`is_system.eq.true`) that
every user shares. A target written next to `track_as_metric` would be
imposed on everyone.

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
```

The composite primary key means one target per user per metric, with no
duplicate possible. `on delete cascade` on both sides: delete the journal
field and its targets go with it.

`direction` is `text` with a check rather than a Postgres enum. The schema
has both conventions (`skill_category` is an enum, `set_type` is checked
text); the check wins here because widening an enum needs `alter type`, while
widening a check needs only a changed constraint.

**RLS** follows the `tool_entries` convention: four policies — select,
insert, update, delete — each `to authenticated` with
`(select auth.uid()) = user_id`. Not the admin-gated shape used by
`exercise_preferences`; metrics belong to every user.

**Why not a JSONB column on `profiles`.** That is what
`dashboard_sections` does, and it was right there because the key space is
small and owned by code. Here the keys are unbounded, user-created field
UUIDs: a target for a deleted field would sit in the blob forever, and the
column would ride along on every `select('*')` on every page. Referential
integrity is worth something here and was not there.

**No `sort_order`.** Rows inherit the order the metrics already have.
Reordering was not asked for and would need its own column and its own
migration.

## Reading

A row needs the label and unit (which `fetchTrackedMetrics` already
returns), the target and direction, and the latest recorded value with its
date.

### The latest-value query

`fetchMetricSeries` pulls 180 days for one metric — far too much for "the
last value", and once per metric. The scorecard instead mirrors that
function's two-step shape, rather than introducing PostgREST embedding that
appears nowhere else in this codebase:

1. the user's entries in the window (`id, entry_date`),
2. the responses for **all** targeted fields at once,
3. per field, keep the newest.

One query pair for the whole scorecard, not one per metric.

The window is a named constant, `LATEST_VALUE_WINDOW_DAYS = 365`. A metric
with no value inside it reads **"no value yet"** rather than showing a
two-year-old number as though it were current. That is a decision, not a
limitation: putting a stale value against a target would be a lie.

### Two pure functions

Testable without a Supabase client, following `shapeMetricSeries`:

- `latestByFieldId(responses, entryDateById)` — per field, the value with the
  greatest date.
- `buildScorecardRows({ metrics, targets, latest })` — joins the three
  sources into rows.

The join runs both ways, and both directions matter. A tracked metric with
no target does not appear on the scorecard — the rows come from the targets,
not from the metrics. And a target appears only while its field is still a
tracked metric. Turning `track_as_metric` off removes the row from
the scorecard without deleting the target; turning it back on restores it.

### The `at_most` subtlety

For "at least 8,000 steps" the bar is `value / target` and full is good. For
"at most 2 coffees" the same bar fills, but full is **bad** and beyond it is
worse. Fill means "closeness to the target" in both cases; only the colour
inverts — under the limit good, over it a warning.

`metTarget(value, target, direction)` carries this and is tested in both
directions including equality: exactly 2 against "at most 2" is met, not
missed.

## The two surfaces

### Setting a target, on `/journal/metrics`

Each metric gains a `MetricTargetControl` — a small client component showing
either the target it has ("at least 8,000 steps") or a "Set a target". Its
dialog holds a number field, the direction, and a remove, built like the
existing `HabitEditorDialog`. It also states that a target set here appears
on the dashboard; without that the connection is invisible.

This is the right place because the metric's own chart is already on this
page: you can see where you stand while deciding what to aim at.

### The dashboard section

`ScorecardSection.tsx` is read-only and fed entirely by server props, with no
fetching on mount. Each row: label, "7,400 of 8,000 steps", the bar, the
date the value came from, and a link back to `/journal/metrics`.

**With no targets set it renders nothing** — no empty state, no prompt. The
section is opt-in by construction: you get it by setting a target. A
permanently empty scorecard on every dashboard is exactly the clutter the
section switches were built to remove.

### Registry

A new `scorecard` entry in `DASHBOARD_SECTIONS`. Two consequences, both
welcome: the section is switchable like the others, and **no migration is
needed for it** — "a missing id means visible" makes it appear for everyone,
including users who saved their switches before it shipped. That invariant
exists for exactly this.

Its queries are cleanly separable — only the scorecard needs targets and
latest values — so they are **skipped entirely when the section is hidden**,
unlike habits and tasks whose rows the always-visible prompts share.

The existing `metric` section stays alongside it. That one charts the history
of a single metric; the scorecard shows targets across several. Two different
questions, each switchable on its own.

## Testing

- `metTarget`: both directions, including equality.
- `latestByFieldId`: takes the newest, ignores `null` values, survives no
  entries.
- `buildScorecardRows`: a target on a field that is no longer tracked is
  dropped; a field with no value in the window becomes "no value yet".
- `ScorecardSection`: renders the rows, shows the `at_most` case correctly,
  and renders **nothing** when there are no targets.
- `MetricTargetControl`: set, change, remove, and a failed write shows a
  message.

## Migration dependency

Targets cannot be saved until the migration is applied. The table is new, so
applying it needs no downtime and touches no existing rows.

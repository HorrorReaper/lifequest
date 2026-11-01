# Journal and insights

## Purpose

Journaling is the core reflection loop in LifeQuest. A journal template defines a sequence of fields; an entry stores the user's responses, can create related application data, awards progression, and can surface durable learnings.

Primary implementation areas:

- `src/app/(app)/journal/`
- `src/components/journal/`
- `src/components/template-builder/`
- `src/lib/field-registry.ts`
- `src/lib/insights.ts`
- `src/lib/learnings.ts`

## Journal home

`/journal` shows:

- A recommended template for the current part of the day.
- All active system and user templates available to the user.
- The five most recent entries.
- Links to the archive, insights, and template management.

The current recommendation rule prefers a morning template before noon and an evening template after 17:00, with free writing as the middle-of-day fallback. If the preferred template has already been completed, the UI can indicate that it is a repeat.

The hour and the day both come from the profile's IANA timezone via `src/lib/dates.ts`. They used to be read from a hard-coded `Europe/Berlin`, which recommended the wrong template and counted today's entries against the wrong date for everyone else.

## Templates

System templates are globally readable and protected from user modification. Users can create and edit their own templates.

The field registry supports:

| Field type | Intended use |
| --- | --- |
| `heading` | Section title |
| `divider` | Visual separation |
| `text` | Short response |
| `textarea` | Long response |
| `number` | Numeric value, decimals allowed ("72,5" or "72.5"); optional min/max |
| `slider` | Bounded numeric reflection |
| `select` | One option from a configured list |
| `mood` | Mood selection |
| `rating` | Star/scale rating |
| `checkbox` | Single boolean |
| `checklist` | Multiple checklist items |
| `prompt` | Random or configured writing prompt |
| `tasks` | Create tasks from the entry |
| `day_planner` | Define a day plan from the entry |
| `habit_tracker` | Check configured habits |
| `learning` | Capture a structured learning |

Template fields carry position, labels, descriptions, required state, and type-specific configuration. The builder supports reordering and editing these definitions.

## Entry experience

### Desktop

At widths of 768px and above, the existing full-form layout remains visible. All fields can be reviewed as one reflection.

### Number fields

A number field takes decimals with a comma or a point, so a weight like 72,5 can be tracked. It is a text field with the decimal keyboard (`DecimalInput` in `src/components/ui/decimal-input.tsx`, parsing in `src/lib/decimal.ts`) rather than `type="number"`: some mobile browsers drop a typed comma, and the browser's own step/min/max check blocked saving silently, since the invalid field was usually on a wizard step that was not shown. Any `step` stored in a template's config is ignored for number fields.

Min and max are optional (empty in the template editor means no limit), and new number fields start without them. When set, they are checked by the journal itself (`numberRangeError` in `src/components/journal/journal-wizard.tsx`): Next stays on the step and Save jumps back to it, with "Enter 100 or less." or "Enter 40 or more." under the field. Templates created before this keep the 1–100 limits they were saved with until they are cleared in the editor. Metric targets (`MetricTargetControl`) accept a comma too.

The values are stored in `journal_responses.value_number`. This repository's migrations do not define that column, so whether the hosted database keeps decimals is not visible here; check with `select data_type from information_schema.columns where table_name = 'journal_responses' and column_name = 'value_number'` (`numeric`, `real` or `double precision` keep them; `integer` would not).

### Mobile wizard

Below 768px, the entry becomes a one-answerable-field-per-screen flow:

- Display-only headings, dividers, and prompts are grouped with the next answerable field.
- A close control, segmented progress, and accessible “Step X of Y” status are shown.
- Back and Next actions remain sticky.
- Required fields block forward navigation and show an inline error.
- Optional fields may be skipped.
- The final action is “Save Reflection”.
- "Next" and "Save Reflection" are two separate buttons (`key`s in `src/components/journal/journal-navigation.tsx`), never one whose `type` flips. When they were one, tapping Next on the second-to-last step re-rendered it as a submit button before the browser ran the tap's default action, so the entry was saved without the last step ever being shown.

All field components remain mounted and inactive steps are hidden with CSS. This preserves random prompt selection and local child state while moving between steps.

## Draft recovery

Mobile drafts use `sessionStorage` and are scoped by:

- User ID.
- Template ID for a new entry, or entry ID for editing.

Only fields belonging to the current template are restored. Malformed drafts are rejected. A saved entry or explicit discard clears the draft. Closing a dirty entry presents Continue and Discard choices.

Drafts intentionally:

- Stay within the current browser tab session.
- Do not sync to another device.
- Cause no Supabase write before final submission.

## Entry submission

The existing final submission pipeline performs the following work as applicable:

1. Create or update the journal entry.
2. Replace stored field responses when editing.
3. Store the current response set.
4. Synchronize structured learning fields to the learning library.
5. Apply habit field check-ins.
6. Create tasks emitted by task fields.
7. Upsert day-plan data emitted by planner fields.
8. Record entry XP and update profile progression.
9. Update streak, streak-freeze, milestone, and streak-history state.

Steps 8 and 9 run only for a new entry. Every entry is complete from its first save (drafts live in local storage), so saving an edit (`existingEntryId`) stores the changed responses and their side effects (steps 1 to 7) and keeps the entry's `xp_earned`, the profile XP and the streak as they were. The success screen then says "Changes saved" and shows no XP. Before this, an edit recorded the entry XP a second time and set `last_journal_date` to today, so editing an older entry kept a streak alive without a new entry.

Morning and evening completion can award an additional daily bonus. Streak milestones award larger bonuses at configured thresholds, once on the day the milestone is reached; a further entry that day earns no second bonus (see [Gamification](./gamification.md#streaks)). A save that grows the streak also raises the streak celebration (see [Gamification](./gamification.md#streak-celebration)).

Every date key the pipeline writes — `entry_date`, the same-day bonus lookup, `last_journal_date` — is resolved once from the profile timezone at the start of the submission, so a submission that straddles midnight cannot file its side effects under two different days. The streak decision itself is not in the pipeline: `resolveStreak` in `src/lib/streak.ts` is a pure function over date keys, unit-tested, and the pipeline only applies its result. It previously compared a wall-clock "yesterday" against a UTC-formatted date, which drifted apart at daylight-saving transitions and reset live streaks.

This pipeline is sequential rather than a single database transaction. A partial network/database failure can therefore leave some side effects completed; see [Known constraints](../reference/known-limitations.md).

## XP rules

Template fields can define conditional XP rules using operators such as:

- Equals / not equals.
- Greater than / less than.
- Contains.
- Is checked / is not checked.

Rules should be deterministic from the saved field value. They must not trust hidden client-only state.

## Insights and learnings

Responses can be marked as:

- Learning.
- Problem.
- Idea.
- Decision.
- Win.

The insight type vocabulary is defined once, in `INSIGHT_TYPES` (`src/lib/insights.ts`), and consumed by both the marker dialog and the insights list. The one exception is `src/components/journal/mobile-journal-wizard.tsx`, which validates a restored sessionStorage draft against its own hardcoded copy of the valid values — not type-checked against `InsightType`, so a new type added there without updating that Set fails validation silently and the whole draft is discarded on restore.

Marked responses appear in `/journal/insights`. Users can add up to five normalized tags and favorite important items.

The structured learning library provides a longer-lived view of captured lessons. Legacy `learning` fields synchronize into this library so older templates remain useful.

## Metrics

Any `number` field can be flagged as a tracked metric from the template builder (`config.track_as_metric = true`, optional `config.metric_unit`). No dedicated table: the flag lives on the existing `template_fields.config` JSON column, and the values are the same `journal_responses.value_number` rows already written by ordinary entry submission.

The field-based flag above is the predecessor of the standalone metrics below (`src/lib/legacy-metrics.ts`); no page lists those tracked fields any more. Slider and rating fields are intentionally out of scope: their bounded scales don't need the same free-range charting `number` fields do.

`/journal/metrics` (`src/app/(app)/journal/metrics/page.tsx`) is the list of the user's standalone metrics. It is a server component: it redirects to `/login` without a user, reads the metrics (`fetchMetrics`), each one's newest value (`fetchLatestValues`) and second-newest value (`fetchPreviousValues`, one `range(1, 1)` query per metric so the 1000-row response cap is never an issue), and renders `MetricList` (`src/components/metrics/MetricList.tsx`). Each row links to `/journal/metrics/{id}` and shows the name, `📓 {template name}` when the metric is linked to a journal template, and the latest value with its unit and day (`81.6 kg`, `Oct 29`) or `No value yet`. A trend arrow follows the value when there is a previous one: `↗` when the latest is higher, `↘` when lower, `→` when equal; there is no arrow with a single value. The list does not judge direction (`↘` is not "good" or "bad"), since a target is per metric.

Creating happens in `MetricCreateDialog` through `MetricCreateLauncher` (`src/components/metrics/MetricCreateLauncher.tsx`), which the page places twice: as a `+ New` button in the header once there is at least one metric, and as `MetricEmptyState` (`variant="empty"`) in place of the list while there are none. `/journal/metrics?new=1` (the + menu's `Metric` entry) opens the dialog on mount; the page keys the launcher on that param, like `src/app/(app)/habits/page.tsx`, so the + menu reopens the dialog from this page too, and `?new=1` is removed from the address (`history.replaceState`) when the dialog closes.

The Metrics section is being rebuilt around standalone metrics (design: `docs/superpowers/specs/2026-11-01-standalone-metrics-design.md`). The new data layer is `src/lib/metrics.ts`, over the `metrics` and `metric_values` tables (one value per metric and day, latest wins). The `/journal/metrics` list and the per-metric page read it; the field-based module was moved to `src/lib/legacy-metrics.ts` and is still used by the other pages that have not switched over yet. This section is rewritten once they have.

The UI building blocks for the new metrics live in `src/components/metrics/`; `MetricCreateDialog` and `MetricEmptyState` are placed on `/journal/metrics` (above), `MetricLogDialog` is not placed on a page yet. `MetricLogDialog` logs today's value of one metric: it opens on the latest value, steps it with `MetricStepper` (the step size comes from `stepFor` in `src/lib/metrics.ts`; a comma decimal such as `81,2` is accepted), and saves it with `logMetricValue` for the `today` it is given by the server. Because a day holds one value and the latest write wins, the dialog shows `You already logged 81.6 kg today. Saving replaces it.` when today already has a value, and `Last: 81.6 kg · Oct 30` otherwise. Save is disabled while the field is empty or a write is pending, a failed write shows an error and keeps the dialog open, and an `Open {name} ›` link goes to `/journal/metrics/{id}?from=home`. `MetricCreateDialog` creates a metric from a name (1-60 characters) and an optional unit (at most 12), then navigates to `/journal/metrics/{id}?created=1`. `MetricEmptyState` is the placeholder shown while the user has no metrics, with a `Create your first metric` button.

The per-metric page is `/journal/metrics/[metricId]` (`src/app/(app)/journal/metrics/[metricId]/page.tsx`, with a `loading.tsx`). It is a server component: it redirects to `/login` without a user, returns 404 for an id that is not a UUID or not the user's metric, computes `today` from the profile time zone, and reads the values of the last 180 days (`fetchMetricValues` with a `sinceDate`, so the 1000-row response cap is not reached) plus the newest value overall (`fetchLatestValues`), which may be older than that window. It composes four components:

- `MetricPageHeader` (`src/components/metrics/MetricPageHeader.tsx`): the back link (`‹ Home` to `/dashboard` when the page is opened with `?from=home`, otherwise `‹ Metrics` to `/journal/metrics`), the name, and the target as `at least 8000` / `at most 80 kg` or `No target`. It is a client component that owns the settings: a gear button (`Metric settings`) opens `MetricSettingsDialog`, and when the page is opened with `?created=1` it shows `MetricCreatedHint` above it. The page passes the `templates` list for the journal link.
- `MetricLogBox` (`src/components/metrics/MetricLogBox.tsx`): logs today's value in place with `MetricStepper`. The heading is `Log today`, or `Update today` when the latest value is from today. It saves like `MetricLogDialog`; both use the `useLogMetricValue` hook (`src/components/metrics/use-log-metric-value.ts`), which holds the single-write guard, the error message and the router refresh.
- `MetricChart` (`src/components/journal/MetricChart.tsx`): a line chart with a `30d` / `90d` / `180d` range selector (30 by default; it keeps points with `date >= addDays(today, -range)`), a dashed target line when the metric has a target, and the newest value overall in the card header. The old `/journal/metrics` page passes the template name as `subtitle` and its charts start on the 30-day range too.
- `MetricHistoryList` (`src/components/metrics/MetricHistoryList.tsx`): the values newest first, each row a button showing the date, the value with its unit and its source (`Entered` for a value typed in, otherwise the template name), or `Nothing logged yet.` A row opens `MetricValueDialog` (`src/components/metrics/MetricValueDialog.tsx`) for that day, unless the caller passes its own `onSelect`, which the page does not. Past values can be edited or deleted, not added: the dialog is titled with the day (`Oct 29`) and has no date field, so a value cannot be moved to another day. Saving writes only the number (`updateMetricValue`; a comma decimal such as `82,0` is accepted), so a value that came from a journal entry keeps its source line (the template name) and its link to the entry. `Delete value` first asks `Delete this value?` inside the dialog, with `Cancel` and `Delete`, and only then calls `deleteMetricValue`; deleting never touches the journal entry the value came from. Both writes disable the buttons while pending, refresh the page on success, and show an error with the dialog kept open on failure. The `Oct 29` day label comes from `formatMetricDay` in `src/lib/metrics.ts`, shared by the history list, the chart and `MetricLogDialog`.

Settings and the first-run hint (`src/components/metrics/MetricSettingsDialog.tsx`, `src/components/metrics/MetricCreatedHint.tsx`):

- `MetricSettingsDialog` edits the unit (at most 12 characters; blank saves `null`), the target and the journal link with one `Save` (`updateMetric`, which always receives all four fields; a refresh and close follow on success, an error keeps the dialog open). The `Target` switch reveals an `At least` / `At most` choice and a value (a comma decimal such as `79,5` is accepted); switching it off saves both target fields as `null`. `Also ask in my journal` reveals a `Journal template` select; switching it off saves `templateId: null`, and Save stays disabled until a target number and a template are chosen where those switches are on. With no template to offer the switch is disabled and says `Create a journal template first to ask for this number there.`
- The template list is built by the page: the user's active templates plus active system templates (the filter `src/lib/legacy-metrics.ts` uses), plus the metric's linked template when that one is archived or otherwise missing. For an archived link the dialog shows `Asked in {template} (archived)` with a `Change template` button that focuses the select.
- `Delete metric` asks `Delete {name} and all its values?` inside the dialog with `Cancel` and `Delete`; only `Delete` calls `deleteMetric`, then goes to `/journal/metrics`.
- `focus` (`target` or `journal`) puts the focus on that section's switch when the dialog opens.
- `MetricCreatedHint` (`Almost there.` with `Set a target`, `Ask in journal` and `Later`) appears after creating a metric. The first two open the settings on the target or the journal link; `Later` hides the hint and replaces the URL without `created` (keeping `from=home`).

Journal entries write metric values (`src/components/journal/entry-form.tsx`, `src/components/journal/JournalMetricsBlock.tsx`). The link lives on the metric (`metrics.template_id`), so no field is added to the template and templates with history or system templates work unchanged. Both entry pages (`src/app/(app)/journal/new/[templateId]/page.tsx` and `src/app/(app)/journal/[entryId]/page.tsx`) load the metrics the template feeds with `fetchJournalMetrics` (`src/lib/metrics.ts`: `fetchLinkedMetrics` plus one `fetchValuesForDate` query for the entry's day) and pass them to `EntryForm` as `linkedMetrics`; a failed read is logged and the form opens without them, so journaling never depends on metrics.

- Entry date: values go to the entry's day, not to today. `/journal/{entryId}` passes `entryDate={entry.entry_date}`, so an entry edited later keeps filing its numbers on its own day; a new entry has no `entryDate` and uses `today`, `dateInTimezone(new Date(), timezone)` resolved at submit with the profile time zone (a value typed at 23:30 in Berlin goes to that Berlin day). An entry opened for a day other than today shows `Saved for Oct 20` in the block.
- Metrics block: `JournalMetricsBlock` shows one text input per linked metric (a comma decimal such as `81,6` is accepted) below the template's own fields. It is part of the final step of the wizard (`JournalStepPanel` active on the last step, on phone and desktop alike), not a step of its own. Each input starts with the entry day's value, and when that day already has one the block says `Already logged for this day (81.6 kg). Changing it replaces it.` Typing in the block counts as an unsaved change for the discard prompt.
- Legacy field link: a metric whose `source_field_id` is one of the template's own fields gets no input; on submit that field's `value_number` is written instead. A metric whose `source_field_id` points at a field that is not in this template is treated as a normal block metric.
- Submit: after the responses and learnings are saved, `entryMetricWrites` (`src/lib/metrics.ts`) turns the inputs and field numbers into writes, and `logMetricValue` upserts each on `(metric_id, value_date)` with `source_entry_id` set to the entry, so the metric's history names the template. An empty or unparsable input writes nothing and leaves the day's value as it was. The values are not stored in `journal_responses`.
- Failure: if a metric write fails the entry and its responses stay saved, XP is not yet awarded, and the form shows `Your reflection is saved, but a metric value could not be saved. Please try again.` with the typed values kept. Saving again updates that same entry (`EntryForm` remembers its id) instead of creating a second one, repeats the metric writes and then awards the XP.

## Archive and editing

- `/journal/entries` provides the full chronological archive.
- `/journal/[entryId]` loads an existing entry and responses for review/editing. Saving there earns no XP and does not count towards the streak (see [Entry submission](#entry-submission)).
- Entries are always filtered to the authenticated owner through both application queries and RLS.

## Important integration points

When modifying journal behavior, re-test:

- Dashboard template and completion state.
- Today Plan journal anchors.
- Task, habit, learning, and day-plan side effects.
- XP/streak updates.
- Mobile draft keys and final single submission.
- Desktop behavior at 768px and above.


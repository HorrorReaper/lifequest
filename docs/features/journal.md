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
| `number` | Numeric value |
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

### Mobile wizard

Below 768px, the entry becomes a one-answerable-field-per-screen flow:

- Display-only headings, dividers, and prompts are grouped with the next answerable field.
- A close control, segmented progress, and accessible “Step X of Y” status are shown.
- Back and Next actions remain sticky.
- Required fields block forward navigation and show an inline error.
- Optional fields may be skipped.
- The final action is “Save Reflection”.

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

Morning and evening completion can award an additional daily bonus. Streak milestones award larger bonuses at configured thresholds.

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

`/journal/metrics` (`src/lib/metrics.ts`) lists every tracked field the user can see (their own templates plus active system templates) and charts its value history — one point per journal entry, not aggregated per day, since the right aggregation for something like daily revenue vs. a single weigh-in is a per-metric modeling choice this feature doesn't make yet. Slider and rating fields are intentionally out of scope: their bounded scales don't need the same free-range charting `number` fields do.

## Archive and editing

- `/journal/entries` provides the full chronological archive.
- `/journal/[entryId]` loads an existing entry and responses for review/editing.
- Entries are always filtered to the authenticated owner through both application queries and RLS.

## Important integration points

When modifying journal behavior, re-test:

- Dashboard template and completion state.
- Today Plan journal anchors.
- Task, habit, learning, and day-plan side effects.
- XP/streak updates.
- Mobile draft keys and final single submission.
- Desktop behavior at 768px and above.


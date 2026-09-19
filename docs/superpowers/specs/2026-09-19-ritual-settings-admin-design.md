# Ritual settings, editable by admins

**Date:** 2026-09-19
**Status:** Draft, awaiting review
**Series:** 1 of 3 — followed by *user overrides for ritual times* and
*admin editing of system templates*, each with its own spec.

Let trusted admins decide, for every user, when the four dashboard rituals
prompt, what they say, and where they lead.

## Problem

The dashboard runs four automatic rituals, each a dialog that opens itself
on `/dashboard` and leads somewhere:

| Ritual | Prompt | Opens when | Leads to |
|---|---|---|---|
| Daily Plan ("morning briefing") | `DailyPlanPrompt` | today's plan not committed | `/plan` |
| Evening Review | `EveningReviewPrompt` | from 20:00, no entry today | `/journal/new/<Evening Review>` |
| Weekly Review | `WeeklyReviewPrompt` | Sunday from 18:00, no entry this week | `/journal/new/<Weekly Review>` |
| Weekly Plan | `WeeklyPlanPrompt` | Monday, no entry this week | `/journal/new/<Weekly Plan>` |

Every one of those facts is hard-coded: the hour in `dashboard/page.tsx`,
the weekday in `src/lib/weekly-rituals.ts`, the copy inside each component,
the target template as a constant or a name lookup. Changing the evening
hour is a deploy. Turning a ritual off for everyone is a deploy.

The admin workspace cannot help: its hubs are the admin's *own* productivity,
training and nutrition data, guarded by `role = 'admin' and uid = user_id`.
Nothing in the app is configuration that one admin sets and every user
reads.

## What changes

A table `ritual_settings` with one row per ritual, readable by every signed-in
user and writable only by trusted admins. The dashboard reads it instead of
its constants. A new admin hub, **Rituals**, edits it.

Per ritual, an admin sets:

- **enabled** — off hides the prompt for everyone.
- **window** — a weekday (weekly rituals) and a time the prompt may open from.
- **target** — which journal template the prompt opens (not for the Daily
  Plan, which opens the planner).
- **copy** — the dialog's title, description and call-to-action, with
  `{name}` standing for the user's name.

Deliberately not in scope here: per-user overrides (spec 2), editing the
templates' fields (spec 3), the "Not now" label, the stats line each dialog
shows, more than one prompt per ritual, and any change to *what counts as
done* — that stays "an entry with the target template exists today / this
week", or "the plan is committed".

## Storage

```sql
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
  title text not null,
  description text not null,
  cta_label text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
```

One row per ritual, keyed by the ritual's name: there is nothing to
paginate, join or migrate between rows, and the four names are the same
four the code already uses. A generic `app_settings` key/value table was
considered and rejected — it trades the foreign key, the range checks and a
readable row for not needing a migration when a column is added, and
columns will be added rarely.

`weekday` and `from_minutes` are the same shape for all four rituals so the
dashboard needs one rule, not four. The Daily Plan gains a `from_minutes`
it never had (default 0, "as soon as you open the dashboard"); admins may
raise it.

### Access

```sql
alter table public.ritual_settings enable row level security;

create policy "ritual settings are readable by every signed-in user"
  on public.ritual_settings for select
  to authenticated using (true);

create policy "trusted admins update ritual settings"
  on public.ritual_settings for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

No insert or delete policy: the four rows are seeded by the migration and
the set never changes from the app. Trusted means the JWT role, the same
test `admin_app_stats` makes; env-allowlisted admins (`ADMIN_EMAILS`) can
open the hub but not save, and the hub tells them so up front rather than
letting a save fail.

### Seed

The migration inserts the four rows with today's hard-coded behaviour, so
nothing changes for anyone on the day it ships:

| ritual | enabled | weekday | from_minutes | template_id | title / description / cta |
|---|---|---|---|---|---|
| `daily_plan` | true | null | 0 | null | current `DailyPlanPrompt` copy |
| `evening_review` | true | null | 1200 | `(select id from journal_templates where is_system and name = 'Evening Review' limit 1)` | current `EveningReviewPrompt` copy |
| `weekly_review` | true | 6 | 1080 | `5c1c3f0e-…` | current `WeeklyReviewPrompt` copy |
| `weekly_plan` | true | 0 | 0 | `a7d4e2b1-…` | current `WeeklyPlanPrompt` copy |

The Evening Review template was created by hand, not by a migration, so its
id is found by name once, at seed time, and stored. If no such template
exists on an environment the row gets `template_id = null` and the prompt
stays hidden there — which is what happens today.

`on conflict (ritual) do nothing`, so re-running never overwrites an
admin's edits.

## The lib: `src/lib/rituals.ts`

Pure functions, no I/O, fully unit-tested. Replaces the window logic in
`src/lib/weekly-rituals.ts`, which keeps only the two template id constants
and the week-scoped entry check.

```ts
export type RitualId = 'daily_plan' | 'evening_review' | 'weekly_review' | 'weekly_plan'

export interface RitualSetting {
  ritual: RitualId
  enabled: boolean
  weekday: number | null      // 0 = Monday … 6 = Sunday
  fromMinutes: number
  templateId: string | null
  title: string
  description: string
  ctaLabel: string
}

export type RitualSettings = Record<RitualId, RitualSetting>
```

- `DEFAULT_RITUAL_SETTINGS: RitualSettings` — the same values the migration
  seeds, minus the Evening Review id (null, since it is environment-specific).
  Used when a row is missing or unreadable, so the dashboard never depends
  on the seed having run. The duplication with the SQL is deliberate and
  noted in both places.
- `normalizeRitualSettings(rows: unknown): RitualSettings` — the
  `normalizeDashboardSections` pattern: take what the database returned,
  keep what passes the checks (integer ranges, non-empty strings, known
  ritual ids), fall back to the default for anything else, per field. A
  malformed row degrades to defaults; it never throws on the dashboard.
- `isRitualWindow(setting, today, nowMinutes): boolean` —
  `enabled && (weekday === null || weekdayOf(today) === weekday) && nowMinutes >= fromMinutes`.
  This one rule replaces `isEvening`, `isWeeklyReviewWindow` and
  `isWeeklyPlanWindow`.
- `fillName(text, username): string` — replaces every `{name}` with the
  username or `Adventurer`, the fallback the dashboard hero already uses.
- `ritualDismissKey(ritual, periodKey)` — moves the four `dismissKey`
  helpers into one place: `lifequest-ritual-<ritual>-dismissed-<period>`.
  The period is the date for daily rituals and the week's Monday for weekly
  ones. **This renames the stored keys.** The cost is that anyone who
  dismissed a prompt on release day sees it once more; the old keys expire
  on their own and nothing reads them, so no migration of localStorage is
  needed. `EVENING_REVIEW_DISMISS_PREFIX` is dropped (nothing imports it).

The `RitualSetting` shape is camelCase because it is the app's type; the
row is snake_case because it is the database's. `normalizeRitualSettings`
is the one place that maps between them.

## Dashboard

`dashboard/page.tsx` fetches the four rows in the first `Promise.all`
(alongside `city_states` and the avatar) and normalizes them. Everything
downstream reads `settings`:

- **Windows.** `isEvening` becomes `isRitualWindow(settings.evening_review, today, nowMinutes)`,
  and likewise for the other three. The Daily Plan condition is now
  `isRitualWindow(...) && !planCommitted`.
- **Targets.** The Evening Review's name lookup goes; its "done" check
  becomes `completedTemplateIds.has(settings.evening_review.templateId)`.
  The weekly entries query uses the two configured template ids instead of
  the constants, which is why settings must be fetched before that query
  (the first `Promise.all` runs before the second already).
- **Copy.** Each prompt receives a `copy` prop:
  `{ title, description, ctaLabel }`, already run through `fillName`.
- **Hold-back.** Unchanged in behaviour: the Weekly Review holds the Evening
  Review, the Weekly Plan holds the Daily Plan, whenever both windows are
  open and the weekly entry does not exist yet. With configurable windows
  the pair can now also collide on other days — a Weekly Review moved to
  Friday evening holds Friday's Evening Review — which is the intended
  outcome, not a new case.

The four prompt components lose their hard-coded strings and their own
`dismissKey` functions. They keep their icons, their stats line and their
tests; the tests pass copy explicitly.

Because settings are read on every dashboard request (the page is already
dynamic per user), an admin's save is live on the next load. No cache
invalidation.

## Admin hub: `/admin/rituals`

A ninth entry in `AdminShell`'s `sections`, labelled **Rituals** with the
`BellRing` icon, placed after Productivity.

The server page (`src/app/(app)/admin/rituals/page.tsx`) loads the settings
rows, the system journal templates (`id, name, icon` where `is_system`),
and `hasTrustedAdminRole(user)`, and renders `RitualsHub` (client).

`RitualsHub` shows four cards, one per ritual, in dashboard order (Daily
Plan, Evening Review, Weekly Review, Weekly Plan). Each card:

- **Enabled** — `Switch`.
- **Weekday** — `Select` of Monday…Sunday; weekly rituals only. The daily
  rituals show "Every day" as static text.
- **From** — `<Input type="time">`, stored as `from_minutes`.
- **Opens** — `Select` of system templates; not shown for the Daily Plan,
  which reads "Today's planner". An option "— none —" is offered so an
  admin can hide a ritual's target explicitly; the card then warns that the
  prompt will not show.
- **Copy** — `Input` for title and call-to-action, `Textarea` for the
  description, with a one-line hint that `{name}` becomes the user's name
  and a small live preview of the title with a sample name.
- **Save** — per card, disabled while nothing changed; on success a toast
  and `router.refresh()`; on error the message inline, the way
  `ProductivityHub` shows its errors.

Saving is a client-side `update` on `ritual_settings` by `ritual`, with
`updated_at = now()` and `updated_by = user.id`. RLS is the authorization;
the page only decides what to render.

Not trusted (allowlist admin): every control is disabled and a notice at
the top says the settings are read-only for allowlist admins. No save
button appears.

Validation on the client mirrors the database checks so a bad value never
reaches the request: title, description and call-to-action must be
non-empty; time must parse. There is no length limit beyond what the
dialog can sensibly show; the preview is the guide.

## Error handling

- Settings query fails on the dashboard → `normalizeRitualSettings(null)`
  returns the defaults and the page renders as today. The failure is not
  surfaced to the user; the dashboard already treats optional data this way.
- `template_id` null (deleted template, or admin chose none) → the prompt
  stays closed. The admin card says so.
- Save rejected by RLS (trusted flag stale, role removed mid-session) → the
  card shows the error inline; nothing else changes.

## Testing

- `src/lib/rituals.test.ts` — `normalizeRitualSettings` (missing rows,
  out-of-range numbers, empty strings, unknown ritual ids, snake→camel),
  `isRitualWindow` (enabled off, weekday match and mismatch, time boundary,
  daily null weekday), `fillName` (replacement, fallback, several
  placeholders), `ritualDismissKey`.
- Prompt component tests — updated to pass `copy` and assert on it; the
  dismiss-key assertions move to the new key format.
- `RitualsHub.test.tsx` — with the supabase client mocked as in
  `FullscreenFocusTimer.test.tsx`: renders four cards from settings; Save is
  disabled until a field changes; saving calls `update` with the snake_case
  row and the chosen ritual; time input round-trips to `from_minutes`;
  untrusted renders everything disabled with the notice; a rejected save
  shows the error.
- `src/lib/weekly-rituals.test.ts` — window tests removed with the
  functions; the entry-check tests stay.

Manual check on the branch: open `/admin/rituals`, move the Evening Review
to the current time, open `/dashboard`, see the prompt; set it disabled, see
it gone.

## Files

New: `supabase/migrations/20260919120000_create_ritual_settings.sql`,
`src/lib/rituals.ts` (+ test), `src/app/(app)/admin/rituals/page.tsx`,
`src/components/admin/RitualsHub.tsx` (+ test).

Changed: `src/app/(app)/dashboard/page.tsx`, the four prompt components and
tests, `src/lib/weekly-rituals.ts` (+ test), `src/components/admin/AdminShell.tsx`,
`src/lib/supabase/database.types.ts` (new table), `docs/backend/data-model.md`
(one row in the table list), `docs/routes.md` (the new admin route).

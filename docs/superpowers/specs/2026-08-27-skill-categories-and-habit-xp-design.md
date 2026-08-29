# Skill categories and habit XP

> Date: 2026-08-27
> Status: Approved (design), pending spec review
> Scope: `habits`, `quests`, and `xp_events` tables (new nullable columns); `src/components/habits/HabitManager.tsx` (habit check-in XP grant/clawback); habit and custom-quest creation/edit forms (new optional skill picker); `src/lib/quest-ideas.ts` (pre-tagging); the `/analytics` route (reactivated with a new Skills section). No changes to journal entries, tasks, system quests, or challenge programs — those stay untagged/general for this iteration.

## Problem

LifeQuest's XP system is a single flat number (`profiles.total_xp`) with no categorization anywhere in the schema. There's no way for a user to see *what kind* of progress they're making — someone who only exercises and someone who only journals about their career both just watch the same one number go up. The app's own city-builder metaphor already implies multi-dimensional growth; the XP system doesn't reflect that.

Separately, habit check-ins currently award **zero XP or coins** — the only XP-granting actions today are task completion (flat 5 XP, and duplicated across three separate code paths), journal entry submission (template `xp_reward` + per-field bonus rules), and quest/challenge completion. Habits — arguably the most core, recurring behavior the app is built around — sit outside the reward loop entirely. The landing page's own marketing copy ("Streak multipliers stack your rewards") describes a mechanic that doesn't exist in the code today.

## Design

### Skill taxonomy

A fresh, purpose-built list — not a reuse of the existing `goals.category` enum (`personal | health | career | relationships | learning | finance | other`), which has odd-fit buckets like "personal"/"other" that don't work well as things-you-level-up:

```
physical_health | mental_health | focus | learning | relationships | career
```

Implemented as a Postgres enum type `skill_category`, nullable everywhere it's referenced. Untagged habits/quests simply don't contribute to any skill total — there is no forced migration or default-category assignment for existing data.

### Data model

Three additive, nullable-column migrations — no existing column changes, no data backfill:

1. **`habits.skill_category skill_category NULL`** — set (optionally) when a user creates or edits a habit.
2. **`quests.skill_category skill_category NULL`** — same, for custom quests. (System quests and challenge programs are untouched — out of scope, see below.)
3. **`xp_events.skill_category skill_category NULL`** — copied from the source habit/quest at the moment an XP event is inserted. This is the column every skill-level computation reads from; it is populated by application code, not a database trigger, since `xp_events` rows are inserted from several different code paths (task completion, journal submission, quest completion, and now habit check-ins) and only the habit/quest paths have a category to copy.

Per-category totals are computed on read as `SUM(xp_amount) FROM xp_events WHERE user_id = ? AND skill_category = ?` — no new denormalized totals table. This mirrors how the global level is already derived from a sum (`profiles.total_xp`, maintained incrementally) but for skills we don't need incremental maintenance since the per-category page is a low-traffic read (visited far less often than every XP grant), so a plain aggregate query is the right level of engineering for v1.

### Habit check-in XP (new mechanic)

Today, `saveCompletion` in `src/components/habits/HabitManager.tsx:170-228` performs an optimistic UI update and calls `setHabitLogCompletion()` to insert/delete/update a `habit_logs` row, with rollback on error. This is the single hook point for the new XP mechanic — no other code path touches habit completion state.

**On check (completed: false → true):**
- Base XP: **10**
- Streak multiplier: `min(2.0, 1 + currentStreak * 0.02)`, applied to base XP and rounded to the nearest integer. `currentStreak` is the streak *including* the day just checked (i.e., computed from `completionDates` — see `buildHabitSummary()` in `src/lib/habit-manager.ts:61-87` — with today's date already added to the set, not the pre-check-in streak).
  - Streak 0 (first-ever check-in): 1.0× → 10 XP
  - Streak 10: 1.2× → 12 XP
  - Streak 25: 1.5× → 15 XP
  - Streak 50+: capped at 2.0× → 20 XP
- Coins: flat **+3**, not streak-scaled. Coins stay a simple currency; the streak-reward feeling lives entirely in the XP multiplier.
- Insert one `xp_events` row: `source_type: 'habit'`, `source_id: `${habitId}:${date}`` (a composite string — `xp_events.source_id` is a plain text column, not a UUID foreign key, so this needs no schema change), `xp_amount` set to the computed value, `skill_category` copied from the habit's `skill_category` (or `null` if untagged).
- Call the existing `addXp`/`setCoins` store actions (`src/lib/stores/user-store.ts`) with the computed amounts, exactly as other XP-granting paths already do.

**On uncheck (completed: true → false):**
- Look up the `xp_events` row with `source_type: 'habit'` and `source_id: `${habitId}:${date}`` for that user.
- If found: delete it, and reverse its `xp_amount`/coin amount from the user's totals (subtract from `profiles.total_xp` and `coins`, mirroring the store's existing rollback pattern for optimistic updates). If not found (e.g., the row predates this feature, or was already clawed back), do nothing — this is not an error case.
- This dedup-by-composite-key design means a habit can only ever have one XP grant per calendar day, and toggling on/off repeatedly nets to zero — it isn't a way to farm XP.

### Skill picker in creation/edit forms

Habit creation/edit and custom-quest creation both get one new optional field: a 6-chip "Skill" picker (the six categories above, plus an implicit "none" when nothing is selected). This is presentational only — selecting a chip sets `skill_category` on the create/update payload; no other behavior changes.

### Quest-idea picker pre-tagging

`src/lib/quest-ideas.ts`'s 30 built-in ideas already group into 6 thematic categories (`QUEST_IDEA_CATEGORIES`). Each maps onto exactly one new skill category, so every quest added from the picker arrives pre-tagged with zero user effort:

| Quest-idea category | Skill category |
|---|---|
| Skills & Learning | `learning` |
| Creative & Technical | `focus` |
| Adventure & Travel | `mental_health` |
| Health & Fitness | `physical_health` |
| Money & Career | `career` |
| Relationships & Community | `relationships` |

`QuestIdea` gets a new `skillCategory: SkillCategory` field (derived once from this table, not hand-tagged per idea), and `QuestPageClient.tsx`'s `handleAddIdea` passes it through to `createCustomQuest` as the new quest's `skill_category`.

### Skills UI

`src/app/(app)/analytics/page.tsx` currently redirects to `/dashboard` unconditionally (`redirect('/dashboard')` at the top of the file) despite already having built-out components (`StatsCards`, `MoodChart`, `TemplateChart`, `ActivityHeatmap`, `WeeklySummary`). This work reactivates that route and adds a new "Skills" section: six mini level bars, one per category, each computed with the *same* `getLevel`/`getXpProgress` functions already used for the global level (`src/lib/gamification.ts`) — just applied to that category's XP sum instead of `profiles.total_xp`. Categories with zero XP still render (as a level-0/empty bar), so the empty state clearly invites tagging a habit or quest rather than looking broken.

Reactivating the rest of the already-built analytics page (mood chart, template chart, activity heatmap, weekly summary) is in scope only to the extent needed to remove the blocking redirect — those components are pre-existing and not part of this feature's design; if any of them are broken or need real work to un-block the route, that's a separate, explicitly flagged decision at implementation time, not silently absorbed into this feature.

## Explicitly out of scope

- **Journal entries, tasks, system quests, and challenge programs** are not tagged with a skill category in this iteration, and none of their XP grants populate `xp_events.skill_category`. Extending tagging to these is a plausible fast-follow but is a materially bigger lift (journal entries in particular build XP from per-field `xp_rules`, which would need per-field or per-template category tagging) and is deliberately deferred.
- **No backfill of historical `xp_events` rows.** Skill totals only reflect XP granted after this feature ships; nothing is retroactively categorized.
- **Consolidating the triplicated task-completion XP logic** (`src/components/tasks/TaskManager.tsx`, `src/components/dashboard/DailyBriefingWidget.tsx`, `src/app/api/chat/route.ts`) is a real, separate piece of technical debt surfaced during research for this spec — it is not part of this feature and should be tracked independently.
- **No skill-based unlocks, badges, or gating** (e.g., "reach Focus level 5 to unlock X") — this iteration is measurement and display only.
- **No changes to the coin economy beyond the new flat +3 per habit check-in** — no rebalancing of existing coin amounts elsewhere.

## Testing

- Pure-function unit tests for the streak-multiplier formula (`min(2.0, 1 + streak * 0.02)`, rounding behavior at the boundaries — streak 0, a mid-range value, and the point where the cap kicks in).
- Unit tests for the dedup/clawback logic: checking a habit twice in a row (without unchecking) does not double-grant; unchecking removes exactly the previously-granted amount; unchecking a habit with no prior grant (e.g. data from before this feature existed) is a no-op, not an error.
- Component-level test coverage for the new skill picker (selecting a chip sets the right value on the create/update payload) follows this codebase's existing convention of testing user-facing behavior, not implementation details.
- The reactivated `/analytics` Skills section gets the same kind of test already used for the global level display: given a set of `xp_events` with known `skill_category`/`xp_amount` values, the right per-category level/progress renders.
- No new tests for the pre-existing analytics components (`MoodChart` etc.) beyond confirming the route no longer redirects — their own correctness is out of scope for this feature.

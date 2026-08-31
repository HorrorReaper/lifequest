# Data model

## Source of truth

The runtime database is Supabase Postgres. The repository represents its contract through:

- `supabase/migrations/` — additive migrations available in this repository.
- `src/lib/supabase/database.types.ts` — browser/server TypeScript table and RPC types.
- Feature query modules and components — some foundational tables are used even though their original creation migrations are not checked in.

The checked-in migrations are not a complete bootstrap schema for a brand-new Supabase project. Preserve/export the production base schema before attempting a clean rebuild.

## Ownership convention

Most personal tables include `user_id` or use `id = auth.uid()` for profiles. RLS should enforce that users can only read/write their own rows.

Current exceptions include:

- Globally readable system journal templates/prompts.
- Global immutable system exercises that trusted admins can read alongside their own custom exercises.
- Globally readable published challenge definitions where required by the user challenge experience.
- City building catalog rows.
- Trusted-admin-only tables and functions.

Application filters such as `.eq('user_id', user.id)` improve clarity and performance but do not replace RLS.

## Core identity and journal

| Table | Purpose and important relationships |
| --- | --- |
| `profiles` | One row per Auth user; name, onboarding, timezone, XP, streak, AI consent |
| `journal_templates` | System or user-owned reflection templates |
| `template_fields` | Ordered field definitions belonging to a template |
| `journal_entries` | User entry, template, entry date, completion and XP |
| `journal_responses` | Typed values for an entry and template field |
| `journal_prompts` | Prompt library used by prompt fields |
| `journal_learnings` | Durable user learning/insight records |

Responses support text, numeric, boolean, and JSON value columns. The field definition determines which representation is meaningful.

Insight metadata is stored on journal responses so a saved answer can be marked as a learning, problem, idea, or decision without duplicating its source text.

## Planning and productivity

| Table | Purpose |
| --- | --- |
| `tasks` | User tasks, completion, priority, due date, and optional project metadata |
| `day_plans` | Date-keyed plan, blocks, and serialized Today Plan envelope |
| `habits` | Daily binary habit definitions, ordering, archive state, optional `skill_category` |
| `habit_logs` | One user/habit/date completion record; false rows are preserved |
| `routines` | Named habit groups |
| `routine_items` | Ordered habit membership in a routine |
| `goals` | Admin-restricted longer-term goals |
| `productivity_daily_priorities` | Admin top-three task priorities by date |
| `focus_sessions` | Planned/actual admin focus sessions |

`tasks` and `day_plans` are actively used but are not included as complete table mappings in the current `Database` type. Their original creation migrations are also absent from this repository snapshot.

## Workout domain

| Table | Purpose |
| --- | --- |
| `exercises` | Global system exercises and user-owned custom exercises |
| `exercise_preferences` | Per-user favorite/recent metadata for an exercise |
| `workout_preferences` | Rest timer and previous-performance preferences |
| `workout_templates` | Routine header |
| `workout_template_exercises` | Ordered exercises in a routine, notes, supersets |
| `workout_template_sets` | Planned set type, targets, RIR, rest |
| `workout_sessions` | Active/completed workout header |
| `workout_session_exercises` | Ordered session exercises and copied context |
| `workout_sets` | Actual set values, completion, set type, RIR |

The model separates template intent from performed session data. Starting a workout copies the relevant structure so later template edits do not rewrite history.

Only one active workout is allowed for a user. `start_workout` and `finish_workout` enforce session lifecycle consistency.

## Nutrition domain

| Table | Purpose |
| --- | --- |
| `nutrition_targets` | User daily calorie and macro goals |
| `nutrition_entries` | Date/meal diary entries with nutrient snapshots |
| `food_items` | User foods and imported external foods, values per 100g |
| `food_portions` | Named gram portions for a food |
| `food_favorites` | User-to-food favorite relation |
| `saved_meals` | Reusable meal header |
| `saved_meal_items` | Food quantities inside a saved meal |
| `recipes` | Recipe header, portions, optional yield |
| `recipe_ingredients` | Food quantities inside a recipe |

Historical diary integrity comes from copying nutrient values into `nutrition_entries`. Consumers must not calculate old entries from the current `food_items` row.

External foods are owned cached records. Their primary import identity is `(user_id, source, external_id)`.

## Challenges and quests

| Table | Purpose |
| --- | --- |
| `quests` | User/custom quest definitions and completion, optional `skill_category` |
| `quest_daily_logs` | Date-keyed check-ins for daily quests |
| `quest_completions` | Durable completion/claim record |
| `challenge_templates` | Admin-authored program definition |
| `challenge_days` | Ordered day instructions |
| `challenge_enrollments` | User enrollment and start state |
| `challenge_day_progress` | Per-day completion in an enrollment |
| `lesson_completions` | Idempotent user lesson completion |

Reward RPCs update the completion record, XP, and coins together.

## Gamification and city

| Table | Purpose |
| --- | --- |
| `xp_events` | XP audit trail with source type/ID and optional `skill_category` |
| `streak_history` | Date-keyed streak history |
| `city_buildings` | Global building catalog |
| `user_buildings` | User-owned/placed building instances |
| `city_states` | User coins and claimed-entry state |
| `city_buildings_placing` | Placement-related state retained by the existing city model |

The profile total is the canonical XP total. `xp_events` explains its sources and supports idempotency checks.

### Skill categories

`skill_category` is a nullable Postgres enum column (`public.skill_category`: `physical_health | mental_health | focus | learning | relationships | career`) on `habits`, `quests`, and `xp_events`. Untagged rows contribute to no per-category total — there is no forced migration or default assignment. Journal entries, tasks, system quests, and challenge programs are not tagged in this iteration, and their XP grants never populate `xp_events.skill_category`. `xp_events.skill_category` is copied from the source habit/quest by application code at insert time, not by a trigger, since XP-granting code paths differ.

Per-category totals are computed on read (`SUM(xp_amount) FROM xp_events WHERE user_id = ? AND skill_category = ?`, wrapped by `fetchSkillXpTotals` in `src/lib/skill-categories.ts`) rather than maintained as a denormalized total — unlike `profiles.total_xp`, which is updated incrementally. There is no backfill of historical `xp_events` rows.

### Habit check-in rewards

Habit check-ins grant XP and coins, using the same atomic-RPC pattern as the other reward claims below:

- `check_in_habit_reward(p_habit_id, p_date, p_xp, p_skill_category)` — inserts an `xp_events` row (`source_type = 'habit'`, `source_id = '<habit_id>:<date>'`), adds `p_xp` to `profiles.total_xp`, and adds a flat 3 coins to `city_states.coins`, all in one transaction. A partial unique index, `xp_events_habit_dedup_idx` on `(user_id, source_id) where source_type = 'habit'`, backs an `insert ... on conflict do nothing`, so a duplicate call for the same habit/date is a no-op (`awarded: false`) rather than a double grant.
- `undo_habit_check_in_reward(p_habit_id, p_date)` — deletes the matching `xp_events` row and reverses the same XP/coin amounts. If no row exists (e.g. pre-feature data, or an already-clawed-back grant), it is a no-op (`reversed: false`), not an error.
- `xp_events.source_id` is `text`, not a UUID foreign key, to hold this composite `habit_id:date` key.

XP is `round(10 * min(2.0, 1 + currentStreak * 0.02))` — 10 XP at streak 0, capped at 20 XP (2.0×) from streak 50 on. Coins are a flat 3, not streak-scaled. `src/lib/habit-xp.ts` holds the pure formula (`calculateHabitCheckInXp`) and the two RPC wrapper functions; `HabitManager.tsx`'s `saveCompletion` calls them on the false→true and true→false transitions. A reward-grant failure is caught separately from the habit-log save and does not roll back the completion — the log write is the source of truth for whether the habit was checked, and a lost reward is logged, not surfaced as a failed check-in.

## Knowledge and projects

| Table | Purpose |
| --- | --- |
| `knowledge_folders` | User note folders |
| `knowledge_notes` | Markdown note, metadata, optimistic version |
| `knowledge_note_links` | Parsed outgoing wiki links and resolution |
| `knowledge_note_versions` | Immutable note checkpoints |
| `knowledge_note_templates` | Reusable knowledge note templates |
| `knowledge_note_projects` | Note/project links |
| `knowledge_note_tasks` | Note/task links |
| `projects` | Project outcome, workflow, health, dates, home note |
| `project_milestones` | Project milestones and completion |
| `admin_notes` | Earlier lightweight admin notes retained by the schema |

Project tasks reuse `tasks` rather than having a separate task table.

## Other tables

| Table | Purpose |
| --- | --- |
| `waitlist_signups` | Typed legacy/future waitlist storage; current endpoint does not insert into it |

## Database functions

### Transactional feature functions

- `start_workout`
- `finish_workout`
- `clone_workout_template`
- `save_workout_template`
- `log_saved_meal`
- `log_recipe`
- `save_knowledge_note`
- `create_project_with_home_note`

### Challenge and reward functions

- `check_in_daily_challenge_quest`
- `admin_save_challenge_template`
- `start_challenge_program`
- `restart_challenge_program`
- `complete_challenge_program_day`
- `claim_system_quest_reward`
- `complete_custom_quest_reward`
- `complete_lesson_reward`
- `check_in_habit_reward`
- `undo_habit_check_in_reward`

### Utility/admin functions

- `admin_app_stats`
- `get_level`
- `get_city_tier`
- `xp_to_next_level`

Functions that mutate protected data validate the authenticated user and, for admin domains, the trusted app-metadata role.

## Migration inventory

Migrations currently cover:

1. Atomic reward claims and fixes.
2. Goals and later admin restriction.
3. Journal learnings and response insights.
4. Routines and later admin restriction.
5. Admin productivity, workout, and nutrition hubs.
6. Admin application statistics.
7. Daily challenge quests and challenge programs.
8. AI assistant consent.
9. Workout/nutrition daily-driver expansion.
10. Knowledge and projects.
11. The metadata-only exercise catalog import.
12. Skill categories (`habits`/`quests`/`xp_events`) and habit check-in reward RPCs, including the `xp_events.source_id` widening to `text` and the habit-dedup unique index.

Apply migrations strictly in filename timestamp order.

## Type maintenance

After changing the database:

1. Add an additive migration.
2. Add/verify RLS policies and explicit grants.
3. Regenerate Supabase TypeScript types where possible.
4. Reconcile any handwritten `MutableTable` definitions.
5. Run `npx tsc --noEmit`.
6. Add RLS tests for owner, foreign user, non-admin, and system-record behavior.

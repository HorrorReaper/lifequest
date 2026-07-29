# Interactive learning paths

## Product scope

LifeQuest now has two separate learning concepts:

1. The Academy at `/learn`: authored, interactive curriculum.
2. Journal insights at `/journal/insights`: knowledge discovered by the user.

The Academy contains three paths:

- Social Intelligence.
- Entrepreneurship.
- Strength & Fitness.

Each path has three units, six lessons, and 24 exercises. The v1 catalog therefore ships with 9 units, 18 lessons, and 72 exercises across concept, multiple-choice, scenario, ordering, and reflection interactions.

The original 13 article/quiz lessons remain available as the foundation archive.

## Backend implementation

Migrations:

- `20260726180730_interactive_learning_paths_backend.sql`
- `20260726182058_learning_paths_covering_indexes.sql`

The first migration creates and seeds the complete curriculum backend. The second adds covering foreign-key indexes and explicit RPC-only deny policies identified during Supabase advisor review.

### Versioned curriculum

The schema contains:

- `learning_paths`
- `learning_path_versions`
- `learning_units`
- `learning_lessons`
- `learning_exercises`

Published versions are immutable. Admin edits are written into one draft per path. Publishing archives the prior active version and atomically advances `published_version_id`.

Learners are pinned to the path version on which they first submit an exercise. A later publication therefore does not change lesson content, answer keys, order, or rewards in the middle of an enrollment.

Exercise content and answer keys are stored separately. Choice indexes and correct ordering never leave the database through the learner catalog RPC.

### Learner state

The schema contains:

- `learning_enrollments`
- `learning_lesson_progress`
- `learning_attempts`
- `learning_exercise_responses`

The backend records every submitted answer, correctness, retries, mistakes, best score, reflections, completion time, and enrollment completion.

Reflections are owner-only data. They must be included in future account export/deletion work and must never be copied into broad analytics payloads.

### RPC contracts

Learner RPCs:

- `get_published_learning_catalog()`
- `get_learning_progress()`
- `submit_learning_exercise(p_lesson_slug, p_exercise_slug, p_response)`

Admin RPCs:

- `admin_get_learning_catalog()`
- `admin_save_learning_catalog(p_catalog, p_change_summary)`
- `admin_publish_learning_catalog(p_change_summary)`

Internal helper functions are revoked from `anon` and `authenticated`.

Exercise submission:

1. Requires an authenticated user.
2. Resolves the learner’s pinned or currently published version.
3. Verifies the previous lesson is complete.
4. Grades against the server-only answer key.
5. Records each response and mistake.
6. Completes only after every non-concept exercise has a valid response.
7. Computes the score on the server.
8. Awards XP and coins once in the same transaction.

The v1 reward rule is derived from authored mastery points and currently resolves to 50 XP and 20 coins for each seeded lesson. A per-user/per-lesson completion constraint, row lock, active-attempt constraint, and completion-state check prevent retry double-awards.

### Authorization

- Curriculum tables have RLS enabled and no browser table grants.
- Explicit deny policies document that curriculum access is RPC-only.
- Learners can select only their own enrollments, progress, attempts, and responses.
- Progress writes are RPC-only.
- Answer keys and drafts are not returned by learner RPCs.
- Admin mutations require `auth.jwt().app_metadata.role = 'admin'`.
- Route/email allowlisting alone cannot mutate curriculum.
- Every security-definer function uses an empty `search_path`, schema-qualified names, and an internal authorization check where it is callable.

## Frontend integration

The learner experience now reads the catalog and progress from Supabase. Correctness is server-authoritative, and lesson completion displays actual XP/coin rewards.

The admin Learning Studio now:

- Loads the current database draft or published version.
- Validates catalog JSON.
- Saves protected drafts to Supabase.
- Publishes immutable versions.
- Accepts a change summary.
- Keeps JSON copy/import and learner preview tools.

The authored in-code catalog and local-storage helpers remain only as a resilience fallback if the learning RPCs are temporarily unavailable. They are not the primary persistence path.

## Verification

Completed checks:

- 3 paths, 9 units, 18 lessons, and 72 exercises seeded and published.
- Admin catalog loaded from Supabase.
- Identical JSON imported, saved as a draft, and published as a new immutable version.
- Wrong answer rejected by the server.
- Corrected answer accepted and both responses retained.
- Reflection persisted.
- First lesson completed at 90% with one recorded mistake.
- Exactly one XP event written.
- 50 XP and 20 coins awarded once.
- Progress reloaded after navigation.
- Next lesson unlocked after completion.
- TypeScript, targeted ESLint, 120 tests, database advisor review, and production build passed.

## Remaining backend work

The new learning-path backend is complete for the three Academy paths. These cross-product follow-ups remain:

1. Legacy archive migration
   - Decide whether the 13 original lessons stay as a permanent archive or become a fourth versioned path.
   - Seed them into the normalized curriculum if migrated.
   - Map existing `lesson_completions.lesson_id` slugs without changing historical timestamps or rewards.
   - Retire the hard-coded legacy `complete_lesson_reward` RPC after compatibility URLs are covered.

2. Account lifecycle
   - Include learning enrollments, attempts, responses, and reflections in account export.
   - Confirm account deletion removes them through the existing `auth.users` cascades.
   - Update privacy copy to name stored exercise responses and reflections.

3. Analytics
   - Add privacy-conscious path/lesson start, completion, abandonment, first-try correctness, and time-to-completion metrics.
   - Aggregate reflection completion only; never send reflection text to general analytics.

4. Admin operations
   - Add explicit archive and rollback controls in the UI.
   - Add drag-and-drop ordering.
   - Add a version history/diff view and enrollment counts before publication.

5. Platform security backlog found by advisor review
   - Existing functions outside this module still have mutable search paths or overly broad execution grants.
   - Supabase leaked-password protection is disabled.
   - Existing non-learning tables have unrelated missing foreign-key indexes.
   - These were not changed because they predate and sit outside the learning-module scope.

Relevant advisor references:

- [Supabase database linter](https://supabase.com/docs/guides/database/database-linter)
- [Password security and leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

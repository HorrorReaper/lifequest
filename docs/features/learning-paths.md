# Interactive learning paths

## Audience and routes

The normal user Library remains the article/tool/journal-insight interface in `AcademyLibrary`. Admins see the course interface in `LearningPathLibrary`, with the personal Business, Tech & AI course selected initially. `/learn`, `/learn/courses/[pathId]` and course lessons use `showAdminUi`, including its normal-user preview cookie. Normal-user direct links redirect to `/learn` before curriculum loads. Original article URLs and `LessonReader` remain unchanged.

The course interface uses the approved learning-path design: sage surfaces, editorial headings, a CSS cover, expandable units, sequentially unlocked lessons, a next-lesson action and two practical perspectives. Styles in `src/components/learn/academy.module.css` are scoped to courses and support light/dark themes. Other published paths and the article archive remain available. Overviews retain existing app navigation; lesson routes remain immersive.

## Personal curriculum

`src/lib/personal-learning.ts` authors **Unternehmerische Wirtschaftsinformatik** (`entrepreneurial-information-systems`). Eight modules cover opportunities, economics, processes/systems, data, software, AI foundations, AI integration and introduction/growth. The 32 four-step lessons contain explanation, knowledge check, application and reflection, with product-building and company-improvement cases. Each module's final reflection is a separately labelled practice assignment (45 minutes, or 120 minutes/multiple sessions for prototype assignments). These estimates are separate from the four-minute lesson estimate.

This is a distinct path; existing Entrepreneurship completions are not reinterpreted. The original fallback retains three paths and 19 lessons. The original database seed has 18 lessons; database versions remain authoritative.

`withPersonalLearningPath` adds an authored preview only when the personal path is absent. It never replaces a published or enrollment-pinned version. An absent course or unavailable backend is explicitly labelled as a device-only preview, without XP/coin awards. A failed submission on a connected lesson never silently switches to local grading.

## Player and content

`InteractiveLessonPlayer` composes `LearningBlocks`, the existing `LessonToolExercise`, existing buttons/textarea and `useLessonPlayer`. All existing exercise types remain supported: concept, choice, scenario, order, reflection and tool. A restrained progress indicator replaces hearts. Wrong answers remain retryable; feedback is announced and headings receive focus on step changes.

Concepts retain `body` and `takeaway`. Optional typed `blocks` support sequences, comparisons and callouts. Optional `perspectives.product` and `perspectives.company` supply case text and their own blocks. `practiceMinutes` identifies a longer reflection assignment. Fields round-trip through existing exercise `content` JSONB without another scoring type/table. Catalog validation checks optional structures and durations.

The controller locks duplicate submissions, preserves failed reflections, and uses server grading, mistakes and actual reward amounts when connected. A completion returned by an earlier graded step is retained across a trailing concept; a reflection/tool need not be last. Existing server idempotency remains authoritative. Tool steps require a real stored tool entry verified by the backend.

## Preview state and privacy

Unpublished previews store progress/reflections under `lifequest.learning.progress.v1:<user-id>`. Local progress merges only for unpublished paths and cannot override synchronized published progress. Unscoped historical progress is not adopted into an account. This prevents accidental cross-account display, not access by code on the same origin or someone using the same browser profile. Clearing storage removes local preview results.

Studio preview serializes current curriculum to tab session storage and opens `/learn/[lessonId]?preview=draft` in another tab. Without a snapshot it loads the saved admin draft. Draft previews bypass sequencing for inspection, never call submission RPCs, never award rewards, and do not write learner preview completions. Snapshots contain curriculum, not private reflections. Routes remain admin-gated.

Reflections remain owner-only in the backend. Account export/deletion coverage and privacy copy are cross-product follow-ups.

## Learning Studio

`/admin/learning` can add the personal course to its current unsaved draft without replacing other paths. Save and Publish are explicit actions. Existing import/copy and version pinning remain. Preview shows the edited draft rather than the published lesson.

`LearningConceptDialog` edits visual blocks and both case explanations in a separate dialog. Apply validates; Cancel preserves the original. Reflections have a practice-duration field. Cover uploads, generated courses, tutor, spaced repetition and adaptive recommendations are not implemented here.

## Database migration and roles

The existing schema/behavior comes from `20260726180730_interactive_learning_paths_backend.sql`, its covering-index migration and `20260805184127_add_tool_exercise_type.sql`.

`20261029191235_learning_academy.sql` extends the newest catalog-replacement function to accept the original three paths plus the optional personal path. Unknown/duplicate paths and lessons without graded exercises are rejected. Content JSON fields remain intact. The migration does not seed or publish curriculum.

The existing learner implementations move behind checked wrappers with unchanged external signatures:

- `get_published_learning_catalog()`
- `get_learning_progress()`
- `submit_learning_exercise(p_lesson_slug, p_exercise_slug, p_response)`

Wrappers require a signed-in user with trusted `app_metadata.role = 'admin'`. Internal renamed implementations are revoked from PUBLIC, anon and authenticated, as is the existing catalog-building helper. User-editable `user_metadata` and route/email allowlisting do not grant access. The user-preview cookie changes presentation, not account privileges.

Published versions remain immutable and enrollment-pinned. Learner RPC output omits answer keys. Existing scoring, sequencing, response persistence and transactional/idempotent rewards remain. Progress tables retain owner-only RLS and RPC-only writes. Legacy article rewards and shared Toolbox operations are unchanged.

Apply the migration to the intended environment before saving four paths or relying on the new database role boundary. Until then the personal course works as a labelled local preview, and saving four paths fails the old constraint. Publication remains a separate Studio action.

## Verification

- `personal-learning.test.ts`: curriculum, version preservation, optional content validation and account-scoped previews.
- `InteractiveLessonPlayer.test.tsx`: both cases, wrong/correct answers, preview privacy, trailing-concept server completion, actual rewards, duplicate submissions, failed-save retry and draft isolation.
- `LearningPathLibrary.test.tsx`: default course, expansion, existing paths and preview continuation.
- `learning-access.test.tsx`: unchanged public Library branch and direct course/draft lesson rejection before catalog loading.
- Existing article/Academy and backend tests remain applicable.

`scripts/verify-learning-academy.mjs` executes actual SQL in an isolated PGlite PostgreSQL instance. It uses minimal fixture tables, never `.env` or a Supabase connection. It checks role rejection (including user-metadata spoofing), internal helper denial, drafts/publication, JSON round trips, grading, sequencing, once-only rewards, owner RLS and pinned versions. Invocation is in `docs/operations/testing.md`.

Live authenticated browser and deployed-database verification must be reported separately from component/isolated tests. Local preview is not evidence of migration deployment.

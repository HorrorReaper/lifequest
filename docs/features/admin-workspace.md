# Admin workspace

## Purpose

LifeQuest Labs under `/admin` is Patrick's private feature laboratory. It allows deeper experiments without making them part of the journaling MVP for normal users.

The admin workspace:

- Uses a separate responsive shell.
- Does not show the standard bottom navigation.
- Does not award XP or coins for admin-only work.
- Keeps workouts and nutrition private.
- Hosts the knowledge and project experiments.

## Access model

The Next.js admin layout calls `isAdminUser`. It accepts either:

- A trusted Supabase Auth claim: `app_metadata.role = admin`.
- A server-only email or user-ID allowlist.

The database and nutrition APIs are intentionally stricter. Their RLS/RPC checks require the trusted app-metadata role. A route-allowlisted user may therefore enter the shell but still see permission errors for protected data.

The shell warns when the session lacks the trusted claim. See [Authentication and security](../backend/auth-security.md).

## Navigation

The admin shell groups work into:

| Section | Route | Purpose |
| --- | --- | --- |
| Productivity | `/admin/productivity` | Tasks, priorities, focus, habits, goals, routines, plan |
| Training | `/admin/workouts` | Exercise, routine, workout, history, analytics |
| Nutrition | `/admin/nutrition` | Food diary and food system |
| Challenges | `/admin/challenges` | Challenge authoring |
| Knowledge | `/admin/notes` | Markdown notes and linked knowledge |
| Projects | `/admin/projects` | Outcomes, project tasks, milestones |
| Tools | `/admin/tools` | Development/test controls |

On desktop this is a sidebar. On mobile it becomes a compact horizontal navigation pattern.

## Productivity Hub

`ProductivityHub` combines admin-oriented operations:

- Task management.
- Up to three daily priorities.
- Focus sessions/timer.
- Habits and routines.
- Goals and AI-assisted quest suggestions.
- Day-plan summary.
- Weekly focus statistics.

The public `/tasks`, `/habits`, and `/plan` pages remain the user-facing focused managers.

## Challenge Lab

`ChallengeLab` lets an admin:

- Create or edit challenge templates.
- Define ordered challenge days.
- Publish or unpublish programs.
- Delete challenge definitions.

Saving challenge definitions uses an admin RPC. User execution occurs on `/quests`.

## Contextual AI assistant

The chatbot is visible only to admins on non-immersive authenticated pages. It requires:

- `OPENROUTER_API_KEY`.
- Admin route authorization.
- `ai_assistant_enabled=true`.
- A non-null `ai_consent_at` on the user's profile.

It can answer using task, habit, and journal context and can request supported actions such as creating/completing a task or habit. The server validates and executes recognized actions; model output is never granted direct database access.

## Registered-user count

`AdminShell` can display application statistics returned by `admin_app_stats`. The function requires the trusted admin claim; allowlisting a route alone is insufficient.

## Feature isolation rules

When extending the admin workspace:

- Keep private routes under `/admin`.
- Add server-side route guards and database policies.
- Use the publishable browser client; never send a service-role key to the browser.
- Do not reuse an admin-only component in the public app unless its query and mutation paths are also safe for a normal user.
- Treat XP/coins as out of scope unless the feature is explicitly promoted to the user application.
- Preserve the LifeQuest visual system even when using another product as a UX reference.


# Routes and navigation

## Access legend

- **Public** — no session required.
- **User** — authenticated user with completed onboarding.
- **Admin route** — `isAdminUser` must pass.
- **Trusted admin** — JWT must also contain `app_metadata.role = admin` for protected data/RPC operations.

## Public pages

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Primary marketing page; MVP or waitlist calls to action |
| `/landing2` | Public | Alternate landing page experiment |
| `/login` | Public | Email/password login, sign-up, Google OAuth, and password reset request |
| `/auth/callback` | Public callback | Exchanges Supabase auth code, creates profile, redirects to onboarding/dashboard/reset-password |
| `/reset-password` | Public callback target | Reached only via a valid Supabase recovery session forwarded by `/auth/callback`; sets a new password. No session redirects to `/login?error=reset_link_invalid` |
| `/terms` | Public | Terms of Service |
| `/privacy` | Public | Privacy Policy |

## Core authenticated pages

| Route | Purpose |
| --- | --- |
| `/onboarding` | Four-step first-run experience: welcome, profile name and timezone, the app's core loop, and an initial template |
| `/dashboard` | Main LifeQuest briefing, XP/streak/city progress, quick actions, quests, and admin-only widgets |
| `/dashboard2` | Alternate dashboard implementation retained for experimentation |
| `/plan` | Five-step Today Plan ritual |
| `/tasks` | Full task manager |
| `/habits` | Today/history/archived habit manager |
| `/habits/[habitId]` | Habit detail and analytics |
| `/quests` | Default quests, custom quests, daily challenges, and challenge programs |
| `/learn` | Lesson library |
| `/learn/[lessonId]` | Lesson reader and completion quiz |
| `/learn/tools` | Toolbox: library of self-improvement tools |
| `/learn/tools/[toolId]` | A single tool, resolved from `TOOL_REGISTRY` |
| `/city` | Virtual city view/build mode |
| `/settings` | Appearance, profile, timezone, AI consent, sign-out, account deletion |
| `/analytics` | Currently redirects to `/dashboard` |
| `/learnings` | Redirects to `/journal/insights` |

## Journal pages

| Route | Purpose |
| --- | --- |
| `/journal` | Template recommendation, template picker, and five recent entries |
| `/journal/new/[templateId]` | Create a journal entry; mobile wizard below 768px |
| `/journal/[entryId]` | View/edit an existing entry |
| `/journal/entries` | Complete journal archive |
| `/journal/insights` | Marked insights and durable learning library |
| `/journal/templates` | System and custom template list |
| `/journal/templates/new` | Create a custom template |
| `/journal/templates/[id]/edit` | Edit an owned template; system templates remain protected |
| `/journal/metrics` | Charts for `number` fields flagged `track_as_metric` in their template config |

## Routine pages

| Route | Access | Purpose |
| --- | --- | --- |
| `/routines/[routineId]/run` | Admin route | Focused execution of the habits in a routine |

Routine management appears in Settings/dashboard components but current RLS migrations restrict routines to trusted admins.

## Admin pages

All admin pages live under the immersive `AdminShell`.

| Route | Purpose |
| --- | --- |
| `/admin` | Redirects to `/admin/productivity` |
| `/admin/productivity` | Tasks, top-three priorities, focus timer, habits, goals, routines, and plan summary |
| `/admin/workouts` | Exercise library, routines, active workout, history, statistics |
| `/admin/nutrition` | Diary, foods, portions, saved meals, recipes, targets |
| `/admin/challenges` | Challenge template authoring and publishing |
| `/admin/notes` | Markdown knowledge base |
| `/admin/projects` | Project outcomes, task board/list, milestones |
| `/admin/tools` | Private test and development controls |

## HTTP endpoints

| Method and route | Access | Purpose |
| --- | --- | --- |
| `POST /api/waitlist` | Public | Validates a waitlist signup and currently logs it server-side |
| `DELETE /api/account` | User | Permanently deletes the authenticated account after email confirmation |
| `POST /api/chat` | Admin + consent | Contextual AI assistant and supported app actions |
| `POST /api/goals/[goalId]/quest-suggestions` | Admin | Generates three structured quest suggestions |
| `GET /api/admin/nutrition/foods/search?q=` | Trusted admin | Parallel USDA/Open Food Facts search |
| `GET /api/admin/nutrition/foods/barcode/[code]` | Trusted admin | Barcode lookup with provider fallback |
| `POST /api/admin/nutrition/foods/import` | Trusted admin | Refetches and caches an external food locally |

Detailed contracts are in [HTTP API and external providers](./backend/api.md).

## Navigation behavior

The standard bottom navigation contains:

- Home → `/dashboard`
- Journal → `/journal`
- Center quick action button
- City → `/city`
- Settings → `/settings`

The quick action opens direct paths into tasks, habits, journaling, Today Plan, and admin-only tools. Trusted/route-allowlisted admins additionally see a "LifeQuest Labs" entry in the quick action sheet linking to `/admin`, since the standard bottom navigation has no persistent admin entry point. Bottom navigation and the admin chatbot are hidden on immersive routes.


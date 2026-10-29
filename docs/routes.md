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
| `/challenge/[slug]` | Public | Landing page of a published challenge that has a slug (title, copy, cover and day images, day titles, rewards; the cover is the Open Graph image); data via `get_public_challenge` |
| `/challenge/[slug]/join` | Public route handler | "Start" button: signed out → remembers the challenge in a cookie and opens sign-up; not onboarded → onboarding first; otherwise starts the challenge and opens it. The middleware sends a user carrying the cookie from `/dashboard` back here |

## Core authenticated pages

| Route | Purpose |
| --- | --- |
| `/onboarding` | Three-step activation: focus (name and timezone carried over), a first task, and a time block for it today |
| `/dashboard` | Main LifeQuest briefing, in this order: greeting and date, Next up, today's plan, habits, tasks, then the journal nudge, challenges, goals, scorecard, the daily reflection prompt, quests, admin-only widgets and a "Send feedback" link (XP, coins and streak are in the top bar). Ritual prompts open as dialogs. `?goal=new#goals` opens the goal form and scrolls to it; `?welcome=1` shows the first-run card |
| `/dashboard2` | Alternate dashboard implementation retained for experimentation |
| `/plan` | Plan editor (timeline with Save plan) when today has blocks, otherwise the six-step daily ritual. `?step=ritual` forces the ritual; `?step=timeline` opens the editor |
| `/tasks` | Full task manager. `?new=1` opens the create dialog |
| `/habits` | Today/history/archived habit manager. `?new=1` opens the create dialog |
| `/habits/[habitId]` | Habit detail and analytics |
| `/quests` | Achievements and custom one-time quests; links to `/challenges` |
| `/challenges` | Every published challenge plus the user's personal ones, running first. The form to create a personal "X days of Y" challenge is currently hidden (commented out in `src/app/(app)/challenges/page.tsx`) |
| `/challenges/[id]` | One challenge: today's step (manual or auto-detected), deep link, all days |
| `/learn` | Normal users and user-preview retain the existing Library, Toolbox and journal-insight rails. Admins get the redesigned course overview, initially showing the personal Business, Tech & AI path; other courses and articles remain available |

| `/learn/[lessonId]` | Article reader and completion quiz, or — for admins — the course lesson player |
| `/learn/courses/[pathId]` | Admin-only course overview with units, progress and next lesson; direct normal-user links redirect to `/learn` |
| `/learn/tools` | Toolbox: library of self-improvement tools |
| `/learn/tools/[toolId]` | A single tool, resolved from `TOOL_REGISTRY` |
| `/city` | Virtual city view/build mode |
| `/settings` | Appearance, profile, timezone, AI consent, sign-out, account deletion |
| `/analytics` | Journal stats, mood/activity charts, and a Skills tab with per-category XP levels |
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
| `/admin/rituals` | Global settings for the four dashboard ritual prompts: enabled, window, target template, copy (saving needs the trusted admin role) |
| `/admin/workouts` | Exercise library, routines, active workout, history, statistics |
| `/admin/nutrition` | Diary, foods, portions, saved meals, recipes, targets |
| `/admin/challenges` | Challenge Lab: authoring, completion rules per day, public link, publishing to all users |
| `/admin/notes` | Markdown knowledge base |
| `/admin/projects` | Project outcomes, task board/list, milestones |
| `/admin/tools` | Signup analytics (`?range=30\|90\|365`) and private test and development controls |

## HTTP endpoints

| Method and route | Access | Purpose |
| --- | --- | --- |
| `POST /api/waitlist` | Public | Validates a waitlist signup and currently logs it server-side |
| `DELETE /api/account` | User | Permanently deletes the authenticated account after email confirmation |
| `POST /api/chat` | Admin + consent | Contextual AI assistant and supported app actions |
| `POST /api/goals/[goalId]/quest-suggestions` | Admin | Generates three structured quest suggestions (goals themselves are open to all users; only this AI step is admin-only) |
| `GET /api/admin/nutrition/foods/search?q=` | Trusted admin | Parallel USDA/Open Food Facts search |
| `GET /api/admin/nutrition/foods/barcode/[code]` | Trusted admin | Barcode lookup with provider fallback |
| `POST /api/admin/nutrition/foods/import` | Trusted admin | Refetches and caches an external food locally |

Detailed contracts are in [HTTP API and external providers](./backend/api.md).

## Navigation behavior

Every page with the standard shell also shows a sticky top bar with level, XP progress, coins and streak (`src/components/layout/app-top-bar.tsx`). It is hidden on the same immersive routes as the bottom navigation.

The standard bottom navigation contains:

- Home → `/dashboard`
- Journal → `/journal`
- Center quick action button
- Library → `/learn` (also reachable as "Learn" from the quick action sheet; stays highlighted on `/learn/tools` and its sub-pages)
- Avatar → `/profile` (icon is the player's own head with the equipped hat)

Settings (`/settings`) has no tab of its own; it opens from the Settings button on `/profile`, and the Avatar tab stays highlighted there (`src/components/layout/bottom-nav.tsx`).

The quick action opens direct paths into tasks, habits, journaling, Today Plan, and admin-only tools. Trusted/route-allowlisted admins additionally see a "LifeQuest Labs" entry in the quick action sheet linking to `/admin`, since the standard bottom navigation has no persistent admin entry point. Bottom navigation and the admin chatbot are hidden on immersive routes.


## Projects detail navigation

| Route | Access | Purpose |
| --- | --- | --- |
| `/admin/work/projects` | Trusted admin data | Personal project cards/list, areas, search, archive |
| `/admin/work/projects/[projectId]` | Trusted admin data | Owned project; `tab=overview/tasks/notes/links`, `view=board/list` |
| `/admin/projects` | Admin route | Redirect to the canonical Work project overview |

Invalid, unavailable and foreign project IDs produce 404; database read errors go to the existing Work error boundary. The server resolves asynchronous route params before querying. `/admin/notes` accepts `note` plus a validated local project `returnTo` path, allowing a save-and-return flow.

Contacts adds /admin/contacts (view/search/group/sort/favorites/page) and /admin/contacts/[contactId] (tab). Admin Calendar preserves a sources query parameter and includes contact occasions. Knowledge accepts a validated local contact detail returnTo alongside project return paths.

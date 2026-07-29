# Repository map

## Top level

```text
lifequest/
├── docs/                    Product and engineering documentation
├── public/                  Static images, logo, and web manifest
├── src/
│   ├── app/                 Next.js routes, layouts, and route handlers
│   ├── components/          Feature and shared React components
│   ├── lib/                 Domain logic, data helpers, Supabase clients/types
│   └── proxy.ts             Session/onboarding middleware entry
├── supabase/
│   └── migrations/          Additive Postgres/RLS/RPC migrations
├── eslint.config.mjs        ESLint configuration
├── next.config.ts           Next.js configuration
├── package.json             Runtime/dev dependencies and scripts
├── tsconfig.json            Strict TypeScript configuration
└── vitest.config.ts         Unit/component test configuration
```

## `src/app`

```text
src/app/
├── (app)/                   Authenticated user and admin routes
│   ├── admin/               Private Labs routes and admin layout
│   ├── dashboard/           Canonical dashboard
│   ├── dashboard2/          Alternate dashboard experiment
│   ├── plan/                Today Plan
│   ├── tasks/               Full task manager
│   ├── habits/              Habit manager and analytics
│   ├── journal/             Journal, archive, insights, templates
│   ├── quests/              Quests and challenge programs
│   ├── learn/               Lessons
│   ├── city/                City builder
│   ├── settings/            Profile, theme, consent, account
│   └── routines/            Routine runner
├── api/                     HTTP route handlers
├── auth/callback/           Supabase auth callback
├── login/                   Authentication UI
├── onboarding/              First-run flow
├── landing2/                Alternate landing
├── terms/                   Terms
├── privacy/                 Privacy
├── page.tsx                 Main landing page
├── layout.tsx               Root HTML/providers/metadata
└── globals.css              Theme tokens and global styles
```

## `src/components`

| Directory | Responsibility |
| --- | --- |
| `admin/` | Admin shells/hubs, challenges, workouts, nutrition, notes, projects |
| `ai/` | Contextual admin chatbot |
| `analytics/` | Retained general analytics visualizations |
| `auth/` | Login/sign-up form |
| `city/` | Grid, building picker/sprites, rewards, level progress |
| `dashboard/` | Daily briefing and dashboard cards |
| `dev/` | Private testing/development controls |
| `habits/` | Habit manager, editor, analytics |
| `journal/` | Field rendering, entry form, mobile wizard, archive, insights |
| `layout/` | Standard app shell, navigation, quick actions |
| `learn/` | Lesson list/cards/reader |
| `learnings/` | User learning library |
| `marketing/` | Marketing sections |
| `onboarding/` | Onboarding flow |
| `planning/` | Today Plan |
| `providers/` | Theme provider |
| `quests/` | Quest and challenge-program UI |
| `routines/` | Focused routine runner |
| `settings/` | Settings and routine management |
| `tasks/` | Task manager, list, editor, delete dialog |
| `template-builder/` | Journal template builder |
| `ui/` | Reusable LifeQuest controls |
| `waitlist/` | Waitlist modal/form |

## `src/lib`

| Path | Responsibility |
| --- | --- |
| `supabase/` | Browser/server/middleware clients and database types |
| `nutrition/` | Provider normalization, search, calculations, types |
| `workouts/` | Workout dataset checks and shared logic |
| `knowledge/` | Wiki-link parsing and knowledge helpers |
| `projects/` | Project metrics |
| `city/` and `city.ts` | City catalog/unlock logic |
| `stores/` | Zustand presentation state |
| `today-plan.ts` | Today Plan schema/calculations |
| `day-plans.ts` | Day-plan storage helpers |
| `task-manager.ts`, `tasks.ts` | Task grouping/mutations/helpers |
| `habit-manager.ts`, `habits.ts` | Habit manager/mutations/helpers |
| `habit-analytics.ts` | Streak and analytics calculations |
| `routines.ts` | Routine queries/mutations |
| `gamification.ts` | XP/level helpers |
| `quests.ts` | Quest data helpers |
| `lessons.ts` | Static lesson catalog |
| `field-registry.ts` | Supported journal field types |
| `insights.ts`, `learnings.ts` | Journal insight/learning data |
| `admin.ts` | Server-only admin authorization |
| `types.ts` | Shared application types |

## Naming and placement guidance

- Route-specific loading/error/not-found components live beside the route.
- Reusable business calculations belong in `src/lib`, not inside a visual component.
- Feature components belong in their feature directory; only broadly reusable controls go in `components/ui`.
- Tests are colocated with the code they exercise.
- Database changes require timestamped additive files under `supabase/migrations`.
- Secrets and privileged clients belong only in server-only modules or route handlers.

## Where to start for common changes

| Change | Start here |
| --- | --- |
| Dashboard integration | `src/app/(app)/dashboard/page.tsx`, `components/dashboard/` |
| Mobile journal UX | `components/journal/mobile-journal-*`, `entry-form.tsx` |
| New journal field | `lib/field-registry.ts`, field renderer, template builder |
| Tasks/habits | `components/tasks/`, `components/habits/`, corresponding `lib` modules |
| Today Plan | `components/planning/TodayPlanner.tsx`, `lib/today-plan.ts` |
| Workout | `components/admin/workouts/`, `WorkoutHub.tsx` |
| Nutrition | `components/admin/nutrition/`, `lib/nutrition/`, food API routes |
| Knowledge/projects | admin hubs plus `lib/knowledge`/`lib/projects` |
| Auth/session | `lib/supabase/`, `proxy.ts`, authenticated layouts |
| RLS/schema | `supabase/migrations/`, then database types |


# LifeQuest documentation

This folder is the canonical guide to the current LifeQuest application. It describes the product as it exists in the repository, including public pages, the authenticated journaling MVP, the private admin workspace, Supabase data flows, APIs, security boundaries, tests, and deployment.

Last verified: 2026-07-26 against application commit `edb6610`.

## Start here

- [Product overview](./product-overview.md) — what LifeQuest is, who each surface is for, and the product loop.
- [Getting started](./getting-started.md) — local setup, environment variables, Supabase, and development commands.
- [Architecture](./architecture.md) — application layers, rendering model, state, and important data flows.
- [Routes and navigation](./routes.md) — every page and endpoint, including access requirements.

## Feature documentation

- [Core app and dashboard](./features/core-app.md)
- [Journal and insights](./features/journal.md)
- [Today planning, tasks, habits, and routines](./features/planning-tasks-habits.md)
- [Gamification, quests, learning, and city](./features/gamification.md)
- [Self-improvement tools](./features/tools.md)
- [Admin workspace](./features/admin-workspace.md)
- [Workout tracker](./features/workouts.md)
- [Nutrition tracker](./features/nutrition.md)
- [Knowledge system and projects](./features/knowledge-projects.md)

## Backend and security

- [Data model](./backend/data-model.md)
- [HTTP API and external providers](./backend/api.md)
- [Authentication, authorization, and privacy](./backend/auth-security.md)

## Operations and reference

- [Testing and quality checks](./operations/testing.md)
- [Deployment and production](./operations/deployment.md)
- [Production readiness and UX plan](./operations/production-readiness-plan-2026-07-26.md) — evidence-backed audit, priorities, milestones, and release gates.
- [Repository map](./reference/repository-map.md)
- [Known constraints and technical debt](./reference/known-limitations.md)
- [Documentation maintenance](./reference/maintenance.md)

## Product boundaries

LifeQuest currently contains two intentionally different surfaces:

1. The user-facing journaling MVP: dashboard, daily plan, journal, tasks, habits, quests, learning, settings, and the city.
2. The private LifeQuest Labs admin workspace: product experiments, workouts, nutrition, challenges, Obsidian-like knowledge management, and projects.

Workout and nutrition remain admin-only. Admin route access and trusted Supabase authorization are deliberately separate; see [Authentication and security](./backend/auth-security.md).

## Documentation conventions

- Paths such as `/journal` are browser routes.
- Paths such as `src/lib/tasks.ts` are repository-relative source files.
- “Server” means a Next.js Server Component or route handler.
- “Browser” means a client component using the publishable Supabase client.
- “Trusted admin” means the signed-in user has `app_metadata.role = admin` in the Supabase-issued JWT.
- Dates stored as `YYYY-MM-DD` are date-only values and must not be parsed as UTC midnight.

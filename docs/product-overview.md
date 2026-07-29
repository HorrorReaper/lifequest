# Product overview

## What LifeQuest is

LifeQuest is a mobile-first personal operating system built around a journaling habit. It combines reflection, daily planning, tasks, habits, learning, quests, and a virtual city so that useful daily actions produce visible progress.

The core loop is:

1. **Plan** — choose today’s intention, three outcomes, anchors, and time blocks.
2. **Act** — complete tasks, habits, routines, journal prompts, quests, and lessons.
3. **Reflect** — save a structured journal entry and mark durable insights.
4. **Grow** — earn XP and coins, maintain a streak, unlock buildings, and expand the city.
5. **Review** — use journal insights, habit analytics, project status, and tracker history to improve the next plan.

## Product surfaces

### Public surface

The public surface contains:

- The primary marketing landing page at `/`.
- An alternate landing experiment at `/landing2`.
- Login and registration at `/login`.
- Supabase OAuth/email confirmation callback handling.
- Terms and privacy pages.
- A public waitlist form.

`NEXT_PUBLIC_IS_MVP=true` changes the main landing page calls to action from waitlist mode to direct login/get-started mode.

### Authenticated user application

The user application contains:

- Onboarding and timezone setup.
- A dashboard with daily briefing, level, streak, rewards, and quests.
- A five-step “Today’s Plan” ritual.
- Structured and custom journaling templates.
- A one-prompt-per-screen mobile journal experience.
- Journal archive, insights, and learning capture.
- A full task manager.
- A full daily binary habit tracker with history and analytics.
- Habit routines.
- Quests and challenge programs.
- A lesson library.
- A virtual city builder.
- Appearance, profile, timezone, AI consent, sign-out, and account deletion settings.

### Private LifeQuest Labs workspace

The admin workspace is a private feature laboratory, not a normal-user surface. It contains:

- Productivity experiments and focus sessions.
- A Hevy-inspired workout tracker without social features.
- A MyFitnessPal-inspired food diary without ads or community features.
- Challenge authoring.
- An Obsidian-inspired Markdown knowledge system.
- Project management linked to tasks and notes.
- Development/testing tools.

Admin pages do not award XP or coins.

## User roles

| Role | Access |
| --- | --- |
| Visitor | Marketing, login, terms, privacy, waitlist |
| Authenticated user | Core LifeQuest application after onboarding |
| Route-allowlisted admin | Can enter `/admin`, but database writes that require a trusted claim may still be blocked |
| Trusted admin | Has `app_metadata.role = admin`; receives the full admin data permissions defined by RLS and RPC checks |

## Design principles

- Mobile-first layouts with large touch targets and safe-area handling.
- LifeQuest visual identity across all surfaces.
- Focused, step-based workflows for cognitively heavy actions.
- Optimistic UI where rollback and retry are practical.
- Date handling based on the user’s profile timezone where implemented.
- Server-only secrets and provider calls.
- Progressive enhancement: local foods, browser drafts, and existing data remain useful when external services fail.

## Explicit product boundaries

The current release does not include:

- Workout social feeds, profiles, followers, or leaderboards.
- MyFitnessPal ads, Premium concepts, community, water tracking, or meal planning.
- Rich non-daily habit schedules; habits are daily and binary.
- Cross-device journal or Today Plan draft sync.
- Health-platform integrations.
- Licensed exercise images or videos from the imported dataset.
- A general-audience rollout of admin trackers.


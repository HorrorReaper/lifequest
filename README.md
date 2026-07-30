# LifeQuest

LifeQuest is a mobile-first personal operating system built around journaling, daily planning, tasks, habits, learning, quests, and a virtual city. The repository also contains a private LifeQuest Labs workspace for workout, nutrition, knowledge, project, challenge, and productivity experiments.

## Documentation

The canonical product and engineering guide starts at [docs/README.md](docs/README.md).

It covers:

- Product scope and every browser/API route.
- Local setup and environment variables.
- Architecture, state, date handling, and transactions.
- Every user and admin feature.
- Supabase data model, RLS, RPCs, and privacy.
- Testing, deployment, repository ownership, and known constraints.

## Local development

Requirements:

- Node.js 20.9 or newer.
- npm.
- A configured Supabase project.

```bash
npm install
npm run dev
```

The default URL is [http://localhost:3000](http://localhost:3000).

Required local environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

See [Getting started](docs/getting-started.md) for admin claims, optional AI/nutrition providers, account deletion, and migration requirements.

## Quality checks

```bash
npm run test
npx tsc --noEmit
npm run lint
git diff --check
npm run build
```

See [Testing and quality checks](docs/operations/testing.md) for targeted tests and authenticated QA.

## Important boundary

Workout, nutrition, knowledge, projects, and other LifeQuest Labs tools remain private admin experiments. Opening the admin route through a server allowlist does not replace the trusted Supabase `app_metadata.role = admin` claim required by protected RLS and RPCs.

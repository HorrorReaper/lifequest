# Getting started

## Prerequisites

- Node.js `>=20.9.0`, required by the installed Next.js version.
- npm and the checked-in `package-lock.json`.
- A Supabase project with the application schema and migrations applied.
- Optional provider credentials for AI, USDA search, and account deletion.

## Install and run

```bash
npm install
npm run dev
```

The default development URL is `http://localhost:3000`. If that port is occupied, Next.js chooses another available port.

Production-mode local verification:

```bash
npm run build
npm run start
```

## Required environment variables

Create `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

These are intentionally public browser configuration values. Supabase Row Level Security remains the authorization boundary.

## Optional application configuration

```bash
# Landing page mode
NEXT_PUBLIC_IS_MVP=true

# Canonical public app URL
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

When `NEXT_PUBLIC_IS_MVP` is `true`, the landing page directs visitors to authentication. Otherwise it presents the waitlist flow.

## Admin access

Route-level fallback allowlists are server-only:

```bash
ADMIN_EMAILS=patrick@example.com
ADMIN_USER_IDS=00000000-0000-0000-0000-000000000000
```

Values are comma-separated. Never prefix them with `NEXT_PUBLIC_`.

The trusted database role must be stored in Supabase Auth app metadata:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admin"}'::jsonb
where email = 'patrick@example.com';
```

Sign out and sign in again so the JWT contains the new claim. Do not use `raw_user_meta_data` for authorization.

## Optional AI configuration

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_SITE_URL=http://localhost:3000
```

`OPENROUTER_MODEL` defaults to `openai/gpt-4o-mini`. The contextual assistant is admin-only and also requires explicit per-user consent in Settings. Goal-to-quest suggestions are admin-only but use their own route.

## Optional nutrition providers

```bash
USDA_FDC_API_KEY=...
OPEN_FOOD_FACTS_USER_AGENT="LifeQuest/0.1 (contact@example.com)"
```

- USDA is disabled cleanly when its key is absent.
- Open Food Facts remains available without a secret.
- Provider requests run on the server with a seven-second timeout.
- Local, recent, favorite, and saved foods remain available when providers fail.

## Account deletion

Permanent account deletion uses the server-only Supabase Admin API:

```bash
SUPABASE_SECRET_KEY=sb_secret_...
# Legacy fallback:
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Never expose either key to browser code. Without one of these keys, the endpoint returns `503` and no account is deleted.

## Supabase migrations

Migration files live in `supabase/migrations/`. Apply them in timestamp order using your normal Supabase workflow.

Important:

- The checked-in migrations are additive for the features developed in this repository.
- Several foundational tables, including `tasks` and `day_plans`, are referenced by the application but their original creation migrations are not present in the current repository history. A new Supabase project therefore needs the original base schema in addition to the visible migrations.
- TypeScript table and RPC contracts live in `src/lib/supabase/database.types.ts`. Some newer tables use handwritten `MutableTable` mappings rather than fully generated relationship metadata.

## Common commands

```bash
npm run dev
npm run test
npm run lint
npx tsc --noEmit
npm run build
```

See [Testing and quality checks](./operations/testing.md) for targeted commands and the expected verification sequence.


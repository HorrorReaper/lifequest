# Deployment and production

## Current model

LifeQuest is deployed to Vercel through the GitHub repository's external Vercel integration. The production branch is `master`.

There is no checked-in `vercel.json`, deployment workflow, or infrastructure-as-code file. Vercel project settings, domains, environment variables, and Git integration therefore live outside this repository.

## Pre-deployment checklist

From a clean `master` worktree:

```bash
git pull --ff-only origin master
npm ci
npm run test
npx tsc --noEmit
npm run lint
git diff --check
npm run build
```

Also verify:

- New migrations have been reviewed and applied to the correct Supabase project.
- Required production environment variables exist in Vercel.
- Admin app metadata is correct in production Auth.
- No service/API key appears in a `NEXT_PUBLIC_` variable.
- Provider terms/attribution still match the implementation.
- Production smoke tests use a test account where destructive actions are involved.

## Environment variables

### Required

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

### Product configuration

```text
NEXT_PUBLIC_IS_MVP
NEXT_PUBLIC_APP_URL
ADMIN_EMAILS
ADMIN_USER_IDS
```

### Optional AI

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENROUTER_SITE_URL
```

### Optional nutrition providers

```text
USDA_FDC_API_KEY
OPEN_FOOD_FACTS_USER_AGENT
```

### Account deletion

```text
SUPABASE_SECRET_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` remains a legacy fallback.

Configure variables separately for Preview and Production as appropriate. A Vercel environment-variable change requires a new deployment to affect the built application.

## Database release order

For a release containing an additive migration:

1. Back up or confirm recovery options.
2. Test the migration against a representative non-production database.
3. Apply the additive/backward-compatible migration.
4. Deploy application code.
5. Run authenticated smoke tests.
6. Review Supabase logs and advisors.

Avoid deploying browser code that requires a column/function before the database has it. For destructive or incompatible changes, use expand-and-contract across multiple releases.

## Production smoke test

After Vercel reports Ready:

1. Open the production URL in a private window.
2. Verify landing, login, callback, and onboarding routing.
3. Sign in as a normal user and test dashboard, Today Plan, task, habit, and journal reads.
4. Verify a journal submission and refresh.
5. Verify Settings and timezone.
6. Sign in as the trusted admin and open each admin section.
7. Run one reversible workout/nutrition operation.
8. Check browser console, Vercel function logs, and Supabase logs.

Do not use account deletion, destructive project deletion, or large provider imports as routine production smoke tests.

## Rollback

Application rollback:

- Redeploy the last known-good Vercel deployment, or revert the faulty commit on `master`.

Database rollback:

- Prefer a forward-fix migration.
- Do not blindly reverse a migration after production writes may depend on it.
- Restore from backup only for severe integrity incidents and after assessing data loss.

If application and database versions become incompatible, first restore service by deploying a code version compatible with the current schema.

## Monitoring

At minimum, review:

- Vercel build and function errors.
- Supabase Auth/Postgres/API logs.
- External provider failures and timeouts.
- RLS denials from trusted admin flows.
- Duplicate XP/coin events.
- Failed multi-table browser workflows listed in known constraints.

The repository does not currently include a dedicated error-monitoring or analytics service.

## PWA note

`public/manifest.json` provides standalone metadata. The referenced PNG icons under `public/icons/` are currently missing, and there is no service worker/offline application shell. Treat LifeQuest as an installable web manifest, not a complete offline PWA.


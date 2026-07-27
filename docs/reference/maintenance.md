# Documentation maintenance

## Canonical location

`docs/` is the canonical application documentation. The root `README.md` is a short repository entry point and should link here rather than duplicate the full guide.

## Definition of done

A product or engineering change is not complete until the relevant documentation is updated when it affects:

- User-visible behavior.
- Routes or navigation.
- Environment variables.
- Database tables, RLS, grants, or RPCs.
- HTTP API contracts.
- Admin/user access boundaries.
- Date/time behavior.
- Test or deployment procedures.
- Known limitations.

## Which document to update

| Change | Documentation |
| --- | --- |
| Product scope or audience | `product-overview.md` |
| Setup/dependency/environment | `getting-started.md` |
| Rendering/state/data flow | `architecture.md` |
| Page or API route | `routes.md` |
| Feature behavior | Matching file under `features/` |
| Schema/RPC | `backend/data-model.md` |
| Route request/response/provider | `backend/api.md` |
| Auth/RLS/privacy | `backend/auth-security.md` |
| Tests/QA | `operations/testing.md` |
| Release/env/rollback | `operations/deployment.md` |
| Folder ownership | `reference/repository-map.md` |
| Unresolved compromise | `reference/known-limitations.md` |

## Style

- Document behavior that exists in code; label proposals clearly.
- Use repository-relative paths for source files.
- Use browser paths beginning with `/` for routes.
- Include units, date formats, ownership, and failure behavior.
- Explain why a security boundary exists, not only where the check is.
- Avoid copying large code blocks that will drift.
- Keep external provider details at the normalization/contract boundary.
- Add a known limitation when the implementation deliberately accepts a risk.

## Verification procedure

After editing documentation:

1. Confirm every file linked by `docs/README.md` exists.
2. Check relative Markdown links.
3. Compare the route list with `src/app/**/page.tsx` and `route.ts`.
4. Compare environment variables with `process.env` usage.
5. Compare table/RPC names with `database.types.ts` and migrations.
6. Run:

```bash
git diff --check
```

For code changes, also run the quality sequence in [Testing and quality checks](../operations/testing.md).

## Review cadence

Review the full set:

- Before a major release.
- After a migration series.
- After changing authentication/admin rules.
- When promoting an admin experiment into the user-facing MVP.

Update the “Last verified” date and commit in `docs/README.md` only after a full cross-check, not for a small typo fix.

## Adding a new feature document

1. Create a focused file under `docs/features/`.
2. Explain scope, user flow, data, security, failure states, and source locations.
3. Link it from `docs/README.md`.
4. Update routes, data model, API, and repository map when applicable.
5. Add test and deployment implications.

## Documentation ownership principle

The person or agent changing behavior should update the documentation in the same branch. This keeps the explanation reviewable beside the implementation and prevents a later documentation pass from reconstructing intent from code alone.


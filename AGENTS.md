<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions

## Reusable components first

- Before writing UI, look for something that already does the job: `src/components/ui/` for primitives (dialog, button, input, select, tabs, ...), then the feature folders under `src/components/`.
- Extend an existing component (a prop or a variant) rather than copying it into a near-duplicate.
- UI that could plausibly be used a second time gets its own component file instead of living inline in a page. Pages compose components; they do not hold large blocks of markup and state themselves.
- Generic building blocks go in `src/components/ui/`; anything specific to one feature goes in that feature's folder.

## Document every change in `docs/`

- Every change is noted in `docs/` in the same change, not in a later pass. This applies to small changes too, not only to the cases listed under "Definition of done" in `docs/reference/maintenance.md`.
- `docs/reference/maintenance.md` has the table of which document covers what (routes, feature behaviour, data model, API, auth, tests, deployment, ...). Follow it. If nothing fits, note it in the closest `docs/features/` file.
- Describe behaviour that exists in the code, with repository-relative paths, and follow the style rules in `maintenance.md`.
- Leave the "Last verified" line in `docs/README.md` alone; it is only updated after a full cross-check.

## UI: new dialogs over crowded pages

- Do not put many things on one page. Creating or editing something opens in its own dialog (`src/components/ui/dialog.tsx`), not as a form that expands inline.
- Example: creating a goal happens in a dialog opened by a button on the dashboard, not in a form revealed on the page itself. The page keeps showing the overview.
- `src/components/habits/HabitEditorDialog.tsx` and `src/components/tasks/TaskEditorDialog.tsx` are the models to follow for a create/edit flow.
- A new flow that is too big for a dialog gets its own route rather than being added to an existing page.

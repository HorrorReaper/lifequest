# Admin Academy implementation

The approved learning-path mockup is implemented in the existing course branch. The normal user Library, article reader, Toolbox and journal-insight rails remain intact. The personal course is a separate path with eight modules, 32 lessons, both practical perspectives and eight longer assignments.

Completed work:

- Course overview, scoped light/dark styles, expandable units, continuation and course routes.
- Four-step personal lessons, visual sequences/comparisons/callouts, practice duration and all legacy exercise types.
- Account-scoped unpublished preview progress with no rewards; draft inspection isolated from learner progress.
- Studio action to add the authored personal course, visual/case editing and actual unsaved-draft preview.
- Migration for the optional fourth path and trusted-admin course RPC wrappers; no automatic seeding/publication.
- Component, access, catalog and isolated PostgreSQL regression checks.
- Local browser checks of the actual components on 320/390px and desktop, light/dark themes, wrong/correct answer, reflection, completion and continuation. A temporary harness was removed before integration.

The migration and publication are separate deployment steps. No production schema, role or curriculum was modified during implementation. Hosted authenticated Auth/session behavior was not tested by the isolated harness.

The standalone PostgreSQL check uses minimal fixture tables, not the entire production schema. The normal full suite and production build are documented in the delivery verification summary.

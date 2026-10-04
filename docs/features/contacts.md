# Personal contacts

## Scope and navigation

`/admin/contacts` manages owned people independently of Auth accounts, with 50-row cards/list, name/organization/group search, multiple groups, favorite/group filters, name/last-contact/next-event sorting, Upcoming and Archive. `/admin/contacts/[contactId]?tab=overview|relationships|history|dates` opens a directly linked profile. No invitations/messages are sent and no Contacts actions award XP.

`src/components/contacts/` and `src/lib/contacts/` own the feature. Pages use existing admin context and compose reusable components. The generic save/retry/dirty-close dialog now lives in `src/components/ui/workspace-form-dialog.tsx`; the Projects import remains a re-export. Optional people, group and checkbox fields extend that dialog. The shared Task editor accepts optional creation defaults/contact fields; ordinary Task flows retain their behavior.

## Profiles, groups and relationships

Only display name is required. Profiles support names/nickname, organization/role, city, meeting context, interests, memo, preferred channel, optional contact interval in days, favorite and archive status. Labelled emails, phones and HTTP/HTTPS links are separate channels. Name/email duplicates produce a non-blocking hint and are never merged automatically. Groups allow multiple memberships and seed Privat/Beruflich only when no groups exist. Removing a group preserves its contacts.

Relationships connect existing owned contacts. Presets cover family, partnership, friendship, colleagues, parent/child, manager/employee, customer/contact and introduced-by. Directed types have forward/inverse labels. Symmetric pairs are canonicalized on write, rejecting reversed duplicates; self-links and foreign-owner IDs are rejected. Start/end dates and memos retain history. An in-use type cannot change direction or be deleted.

## Shared dates and calendar

Events support multiple people, title/kind, day/month, optional origin year, annual/once recurrence, leap-day policy, memo, calendar visibility and up to ten reminder offsets from 0–30 days. Unknown years never imply a guessed age. One-off dates require a year; impossible dates and occurrences before a known origin year are excluded/rejected. February 29 offers March 1 (default), February 28 or leap-years-only.

Occurrences are derived by the database for a bounded date window, including calendar padding days. One shared event appears once in the calendar and on each participating profile, without yearly row copies or artificial tasks/day-plan blocks. Archived participants are excluded from active occurrences; shared occasions survive for remaining active people. Archived profiles retain their history.

`/admin/work/calendar` uses its existing month/week grid plus Plans/Tasks/Contacts filters. The `sources` URL parameter survives navigation. Contact occasions show a count in each day and kind/title, optional age/anniversary number and profile links in selected-day details. The reusable calendar still accepts no contact source.

## Reminders and interactions

Upcoming shows due occasion reminders, overdue contact-linked tasks, optional contact-interval suggestions and 7/30-day previews. Offsets are calculated on page load, with no background email/push delivery. Acknowledge/reopen/snooze applies to the event ID plus concrete occurrence date; it does not remove the calendar entry or affect next year's occurrence. Snooze permits a future date through 30 days after the occasion. Unacknowledged occurrences remain available for 30 days afterward. Title edits preserve occurrence state; changed dates produce a different key.

Profile timezone determines today and the creation date used by first-contact interval suggestions. All annual dates remain date-only. Interactions store date/channel/summary and multiple participants; latest non-future interaction determines last contact. Corrections/deletions recompute that value. History and task sections display 50 rows per page from complete owner-scoped snapshots.

## Existing Tasks and Knowledge

Tasks may have multiple contact assignments while keeping their original ID, project and Planner references. The existing Task editor edits the same task; completion follows existing status synchronization, adds no admin XP and does not imply a real interaction. Unlinking preserves the task. Creating a preparation task from an event is atomic/idempotent per occurrence, including retries. No tasks appear without an explicit action.

Contact notes use existing Knowledge. Creation/assignment is atomic; existing Notes can be searched, shared among contacts/projects and independently unlinked. `/admin/notes?note=<id>&returnTo=<local contact path>` opens the existing editor, whose return button saves dirty content before returning to History. Only validated local contact/project detail return paths are allowed. Contact attributes are not copied into task descriptions or AI context; consciously entered Task titles remain visible in ordinary Tasks/Planner views.

## Persistence, deletion and access

The additive `contacts_management` migration provides contacts/channels, groups/members, relationship types/pairs, events/members, occurrence states, interactions/members and links to existing Tasks/Notes. Every new table has owner plus trusted `app_metadata.role=admin` RLS, authenticated grants, composite owner FKs and FK indexes. Route allowlisting alone does not grant data access. Other admins cannot access another owner's contacts; contacts are separate from Auth accounts/user statistics.

Invoker RPCs whitelist entities/fields, use row locks and require expected timestamps on existing edits/deletes. JSON cannot set IDs, owners or timestamps. Membership updates are transactional; foreign links roll back the whole mutation. Stale saves fail without discarding drafts. Errors are displayed separately from empty data.

Archive/restore is reversible. Permanent profile deletion confirms channel/relationship/participant impact, preserves Notes/Tasks, retains shared events/interactions for remaining participants and removes orphaned events/interactions. Deleting a shared event/interaction directly affects all its participants and is explicitly confirmed.

## Verification and deferred features

`scripts/test-contacts-database.cjs` applies legacy Knowledge/Projects plus this migration in disposable PGlite Postgres. It tests roles, FK ownership, symmetry/self-link rejection, dates/leap policies, archives, per-occurrence state/task idempotence, resources, stale saves and >1000-contact pagination. Component/unit tests cover failed Task draft retry, identity/assignment preservation, inverse labels, timezone propagation, Knowledge return and Calendar filter navigation. Full suite/type/build checks complement those tests; authenticated browser/device acceptance is tracked separately.

Deferred: network graphs, avatar uploads, import/export, automatic merges, timed contact events, external calendar sync and background notifications.

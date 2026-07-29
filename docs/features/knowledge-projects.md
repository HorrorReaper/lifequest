# Knowledge system and projects

## Scope

The admin knowledge and project surfaces are an Obsidian-inspired personal operating workspace. They are private experiments under:

- `/admin/notes`
- `/admin/projects`

They share links with tasks but remain isolated from normal-user navigation.

## Knowledge notes

`AdminNotesHub` provides Markdown notes with edit, preview, and split layouts.

### Organization

Notes support:

- Folders.
- Note types: note, experiment, meeting, reference, and project.
- Tags and aliases.
- Structured properties.
- Pinning.
- Archiving.
- Search and filters.

The hub currently loads a bounded collection of notes for browser-side exploration. The interface should eventually move large result sets to server-side pagination/search.

### Wiki links

The parser recognizes:

```text
[[Note]]
[[Note#Heading]]
[[Note|Visible label]]
```

It ignores apparent links inside fenced and inline code. Resolution can use note titles or aliases.

The UI exposes:

- Outgoing links.
- Backlinks.
- Unresolved links.
- A create-note action for an unresolved target.

### Editing and conflict protection

Knowledge saving uses `save_knowledge_note`, which receives the expected note version. The database function updates content, extracts/stores links, and records versions while rejecting stale updates.

The UI displays explicit save state and can surface a version conflict rather than silently overwriting newer content.

Browser drafts use `localStorage`, scoped to the note ID or a new-note key, so unsaved text can survive a refresh. This is different from the tab-session-only journal and Today Plan drafts.

### Version history

Note versions provide checkpoints that can be inspected and restored. A restored version becomes a new current version; history should remain append-only.

### Markdown export

Notes can be exported as Markdown. Exported files contain user-authored content and should be treated as private data.

### Cross-feature links

Notes can be linked to:

- Projects.
- Tasks.

The editor can create a task from selected text and can complete linked tasks. These operations still obey the normal task ownership policies.

## Projects

`ProjectsHub` organizes outcomes and their related work.

### Project fields

A project can include:

- Name and outcome.
- Description.
- Status: idea, planned, active, paused, completed, or archived.
- Priority: low, medium, high, or urgent.
- Health: unset, on track, at risk, or off track.
- Start and target dates.
- Color and icon.
- A home knowledge note.

Creating a project uses `create_project_with_home_note`, which atomically creates both the project and its initial linked note.

### Project tasks

Project tasks reuse the shared `tasks` table and add admin project metadata. They can be displayed as a board or a list.

Board workflow includes:

- Backlog.
- To do.
- In progress.
- Blocked.
- Done.

Cancelled tasks may exist in stored data but are excluded from active progress.

The public `/tasks` manager deliberately ignores project workflow fields.

### Milestones and progress

Projects support milestones with target dates and completion state.

Shared project metrics calculate:

- Total active tasks.
- Completed tasks.
- Progress percentage.
- Status and health summaries.

Cancelled tasks do not count in the progress denominator.

## Boundaries and extension guidance

- Knowledge/projects are trusted-admin data under current RLS.
- Do not expose note search or project metadata through the public task UI accidentally.
- Keep optimistic version checks when adding autosave or collaborative behavior.
- Prefer RPCs for writes that must keep multiple linked tables consistent.
- Avoid importing Obsidian-specific proprietary assets or branding; the reference is interaction and linking behavior only.

## Important implementation files

- `src/components/admin/AdminNotesHub.tsx`
- `src/components/admin/knowledge/`
- `src/components/admin/ProjectsHub.tsx`
- `src/lib/knowledge/`
- `src/lib/projects/`
- Knowledge/project migrations and type mappings


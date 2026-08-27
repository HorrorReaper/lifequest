# Self-improvement tools

## Purpose

A "tool" is a self-contained self-improvement framework — defining a vision, a cookie jar of wins, a wheel of life, a time audit. Unlike habits or journal templates, tools are not for daily use: they are picked up when needed, produce something durable, and are revisited later.

Tools live in the Toolbox at `/learn/tools`, reachable from `/learn`.

Primary implementation areas:

- `src/lib/tools/registry.ts` — the list of available tools
- `src/lib/tools/storage.ts` — generic persistence for every tool
- `src/components/tools/<tool>/` — one directory per tool
- `src/app/(app)/learn/tools/` — library and per-tool routes

## Adding a tool

Two things, and nothing else:

1. A component in `src/components/tools/<tool>/`, accepting `ToolProps`.
2. An entry in `TOOL_REGISTRY`.

No migration, no SQL, no changes to the learning-path catalog.

## Why a registry rather than a declarative catalog

Learning paths take the opposite approach: exercises are described as JSON and rendered by a generic engine. That design has not delivered low marginal cost — adding one exercise type there means editing eight places, three of them in SQL (the `exercise_type` CHECK constraint, the catalog validation function, and the submission scoring), plus a closed allowlist of path IDs in both TypeScript and SQL.

Tools are also far more varied than quiz exercises. A weekly 15-minute grid, a curated list, a radar chart and a single revisable statement share almost no interaction shape, so one declarative renderer covering all of them would grow into a small programming language. Tools are therefore code, and the registry is the only shared surface.

## Storage

All tools share `public.tool_entries`:

| Column | Purpose |
| --- | --- |
| `tool_id` | Which tool the row belongs to; matches `ToolManifest.id` |
| `run_id` | Optional grouping for bounded runs; null for open-ended collections |
| `payload` | Tool-specific JSONB |

That covers every shape encountered so far:

| Shape | Example | Mapping |
| --- | --- | --- |
| Singleton with history | Vision | One row per revision, newest is current |
| Collection | Cookie jar, affirmations | Many rows, `run_id` null |
| Repeated snapshot | Wheel of life, time audit | One row per measurement or per calendar day |
| Bounded run | None yet | Many rows sharing a `run_id` |

`payload` is intentionally unvalidated in SQL. Encoding per-tool shapes as CHECK constraints would reintroduce exactly the per-tool migration cost the table exists to avoid, so **each tool validates its own payload in TypeScript** — see `isVisionPayload`/`toVisionRevisions`. Because the table is shared, a tool must assume it can read rows written by a different tool and filter them out rather than trusting the shape.

## Data loading

The tool route (`/learn/tools/[toolId]`) fetches the tool's entries server-side through the generic storage layer and passes them in as `initialEntries`. Tools therefore need no on-mount fetch effect — which also keeps them clear of the `react-hooks/set-state-in-effect` rule — and render without a loading flash. Writes happen client-side from event handlers, which then refetch.

## Tools inside lessons

A lesson can embed a tool as an exercise:

```ts
{ id: 'define-your-vision', type: 'tool', toolId: 'vision',
  prompt: 'Write your first version now.' }
```

This is **one** exercise type for all tools, not one per tool. Adding an exercise type to the learning-path system is expensive — the `exercise_type` CHECK constraint, the catalog validation function, the submission scoring, the TypeScript union, catalog validation, and the player. Paying that once and resolving `toolId` against `TOOL_REGISTRY` at render time keeps every future tool at one component plus one registry entry.

The lesson step is only complete once the learner has actually used the tool. The client gates the Continue button on the tool reporting a save through `ToolProps.onUsed`, and `submit_learning_exercise` independently confirms a `tool_entries` row exists for that `tool_id`. Unlike the reflection branch, this cannot be satisfied by submitting arbitrary text.

Authoring happens in the Learning Studio (`/admin`), which offers registered tools as a dropdown rather than free text, because the database validates the shape of a tool exercise but knows nothing about the registry. A lesson referencing a tool that no longer exists renders a visible warning instead of failing silently.

`LessonToolExercise` loads the tool's entries with React's `use()` rather than a fetch effect: the lesson page is a client component, so entries cannot be passed down from the server the way the standalone tool route does it.

## Unlocking

`ToolManifest.introducedBy` optionally names a lesson that introduces the tool. It is deliberately optional and non-blocking: a tool whose lesson has not been written yet must still be usable, so lessons introduce tools rather than gate them.

## Overlap with existing features

Before adding a tool, check whether the app already records the same thing. A cookie jar, for instance, overlaps with the `win` insight type (see [Journal and insights](./journal.md)) — it should be built as a view over marked wins rather than a second, competing place to record them. This codebase has repeatedly grown duplicate surfaces (`/dashboard` and `/dashboard2`, the removed `src/lib/city.ts`, two parallel lesson systems), so the check is worth making each time.

## Available tools

| Tool | Shape | Notes |
| --- | --- | --- |
| Vision (`vision`) | Singleton with history | Each save inserts a new revision instead of updating, so earlier versions stay readable |
| Limiting beliefs (`limiting-beliefs`) | Collection | One row per belief, `run_id` null |
| Time audit (`time-audit`) | Repeated snapshot | One row per calendar day, keyed by `payload.date`. Since `tool_entries` has no unique constraint on that date, re-logging a day resolves to an update in the client rather than a second row. Each day snapshots the category palette it was painted with, so a day stays truthful after the palette is edited; the summary merges days by category `id` and displays the newest label, which lets a rename reach the summary without splitting its history |
| Goal breakdown (`goal-breakdown`) | Collection | One row per life goal, `run_id` null. Three fixed levels — goal, sub-goal, action — held in a single payload so a save is atomic and one goal can never clobber another. Completion lives only here: leaf actions carry a `done` flag and progress rolls up, deliberately without touching `tasks`. Ticking an action writes the whole working copy, pending text edits included, so the stored row cannot disagree with what is on screen |

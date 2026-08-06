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
| Repeated snapshot | Wheel of life | One row per measurement |
| Bounded run | Time audit | Many rows sharing a `run_id` |

`payload` is intentionally unvalidated in SQL. Encoding per-tool shapes as CHECK constraints would reintroduce exactly the per-tool migration cost the table exists to avoid, so **each tool validates its own payload in TypeScript** — see `isVisionPayload`/`toVisionRevisions`. Because the table is shared, a tool must assume it can read rows written by a different tool and filter them out rather than trusting the shape.

## Data loading

The tool route (`/learn/tools/[toolId]`) fetches the tool's entries server-side through the generic storage layer and passes them in as `initialEntries`. Tools therefore need no on-mount fetch effect — which also keeps them clear of the `react-hooks/set-state-in-effect` rule — and render without a loading flash. Writes happen client-side from event handlers, which then refetch.

## Unlocking

`ToolManifest.introducedBy` optionally names a lesson that introduces the tool. It is deliberately optional and non-blocking: a tool whose lesson has not been written yet must still be usable, so lessons introduce tools rather than gate them.

## Overlap with existing features

Before adding a tool, check whether the app already records the same thing. A cookie jar, for instance, overlaps with the `win` insight type (see [Journal and insights](./journal.md)) — it should be built as a view over marked wins rather than a second, competing place to record them. This codebase has repeatedly grown duplicate surfaces (`/dashboard` and `/dashboard2`, the removed `src/lib/city.ts`, two parallel lesson systems), so the check is worth making each time.

## Available tools

| Tool | Shape | Notes |
| --- | --- | --- |
| Vision (`vision`) | Singleton with history | Each save inserts a new revision instead of updating, so earlier versions stay readable |

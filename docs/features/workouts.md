# Workout tracker

## Scope and access

The workout tracker is a Hevy-inspired, non-social strength and activity tracker at `/admin/workouts`.

It is admin-only and intentionally excludes:

- Social feeds and profiles.
- Followers and leaderboards.
- Routine exploration/community.
- Hevy branding.
- Licensed third-party exercise images or animations.

## Main views

`WorkoutHub` organizes the feature into:

- Overview/action-first home.
- Routines.
- Exercise library.
- History and statistics.
- A full active-workout overlay when a session is in progress.

An active session is automatically loaded so the user can resume or discard it.

## Exercise catalog

The application contains 1,324 exercise metadata records imported from `hasaneyldrm/exercises-dataset` at the pinned source commit documented in `THIRD_PARTY_NOTICES.md`.

Only metadata is included. Media assets were deliberately excluded.

The library can search:

- Name.
- Target and secondary muscles.
- Equipment.
- Aliases.

Filters include muscle, equipment, tracking type, favorites, and recent use. Results are paginated for practical browser rendering.

### Custom and system exercises

- System exercises are global catalog rows that trusted admins can read and that the client cannot modify.
- Admins can create, edit, favorite, and archive their own custom exercises.
- Archived custom exercises remain available to history but are removed from normal selection.

## Tracking modes

The tracker supports six modes:

| Type | Inputs and primary metrics |
| --- | --- |
| `weight_reps` | Weight, repetitions; volume and estimated 1RM |
| `bodyweight_reps` | Bodyweight/additional weight, repetitions |
| `assisted_reps` | Assistance weight, repetitions; lower assistance can be progress |
| `duration` | Duration |
| `distance_duration` | Distance and duration; pace |
| `weight_duration` | Weight and duration |

Metric storage is kilograms, kilometers, and seconds. Display calculations should use the shared workout helpers.

## Routines

The routine builder supports:

- Exercise search and insertion.
- Drag-and-drop exercise ordering.
- Exercise notes.
- Warm-up, working, drop, and failure set types.
- Target repetitions, weight, assistance, duration, distance, and RIR.
- Per-exercise rest times.
- Superset grouping.
- Routine duplication and deletion.

Template saving and cloning use database RPCs so the parent routine and its exercises/sets remain consistent.

## Starting and resuming

The `start_workout` function starts a blank or routine-based workout and prevents multiple active sessions for the same user.

Starting from a routine copies the planned exercise and set structure into the session. The browser recovers the active session after refresh.

## Active workout

The active table shows:

- Set number and type.
- Set-aligned previous performance.
- Tracking-specific inputs.
- RIR.
- Completion state.
- Error/retry state.

Users can:

- Add, remove, and reorder exercises.
- Add, duplicate, and delete sets.
- Add exercise and session notes.
- Create/clear superset groups.
- Complete or reopen a set.

### Local edits and save safety

Set input values remain in local React state while typing. They are persisted on blur or set completion. Dirty set IDs are tracked.

Before Finish:

1. Every dirty set is flushed.
2. The finish action waits for those saves.
3. A failed save keeps the typed values in memory.
4. The workout remains open and exposes Retry.
5. The finish RPC runs only after the flush succeeds.

This prevents a fast Finish action from discarding the latest input.

## Rest timer

Completing a set can start the configured rest timer.

The timer stores a deadline and derives remaining time from `Date.now()` instead of decrementing a counter. It therefore catches up after browser background throttling. When open in a capable browser it can:

- Play a sound.
- Vibrate the device.
- Be skipped.

Browser sound/vibration permissions and platform support still apply.

## Previous performance

The user preference controls whether “previous” comes from:

- The same routine/template.
- The most recent workout containing that exercise.

Values are aligned by set position when possible.

## History and editing

History provides completed session summaries and full workout details. A completed workout can be reopened for detail edits or deleted as permitted by the UI and RLS.

## Analytics and personal records

Tracking-specific calculations include:

- Volume: `weight × repetitions`.
- Estimated 1RM: `weight × (1 + min(repetitions, 30) / 30)`.
- Repetition best.
- Heaviest weight.
- Lowest assistance.
- Duration.
- Distance.
- Pace in seconds per kilometer.

Exercise detail includes instructions, recent history, personal records, and Recharts trends appropriate to the tracking type.

## Plate calculator

The metric plate calculator is entirely local. It accepts:

- Target total weight.
- Bar weight.
- Available plates: 25, 20, 15, 10, 5, 2.5, 1.25, and 0.5 kg.

It reports plates per side, loadable total, and any remainder. It never changes workout data by itself.

## Important implementation files

- `src/components/admin/WorkoutHub.tsx`
- `src/components/admin/workouts/`
- `src/lib/workouts/`
- Workout tables and RPC types in `src/lib/supabase/database.types.ts`
- Workout migrations in `supabase/migrations/`

# Gamification, quests, learning, and city

## Progression model

LifeQuest turns meaningful actions into visible progression through:

- XP and levels.
- Current and best streaks.
- Coins.
- Quests and challenge programs.
- Lessons.
- A buildable virtual city.

Progression is a feedback layer over useful behavior, not a replacement for the underlying journal, task, habit, or plan data.

## Levels

The cumulative XP threshold for a level is:

```text
round(25 × level² + 25 × level)
```

`src/lib/gamification.ts` contains the level helpers. UI code should use the shared helpers rather than reimplementing thresholds.

City tiers are:

| Level | Tier |
| --- | --- |
| 1–5 | Village |
| 6–10 | Town |
| 11–20 | City |
| 21–35 | Metropolis |
| 36+ | Capital |

## Streaks

Journal completion is the primary streak driver. The profile stores current and best streak values, while `streak_history` supports historical display.

The journal pipeline handles:

- Same-day completion without incrementing twice.
- Consecutive-day increment.
- Streak reset or freeze behavior after a missed day.
- Configured milestone rewards.

Because the journal side effects are sequential, streak and XP changes should be tested together whenever the submission pipeline changes.

## Quests

`/quests` combines several quest types:

### Default system quests

Nine built-in quest definitions derive completion from existing application data such as:

- Journal entries.
- Streak.
- Level.
- Buildings.

### Custom quests

Users can work with single-completion or daily challenge quests. Reward completion is routed through database functions designed to prevent repeated claims.

### Challenge programs

Published challenge programs contain ordered challenge days. Programs can enforce sequential or strict completion rules. Users can start or restart a program, check in each day, and complete the overall program.

Both challenge surfaces derive their day from the profile timezone, resolved once on the server in `src/app/(app)/quests/page.tsx` and passed down as a date key. This has to match what `check_in_daily_challenge_quest` and `complete_challenge_program_day` compute, because those RPCs enforce the challenge window and the strict-schedule rule server-side. `getChallengeProgress` and `getProgramDayState` in `src/lib/challenges.ts` take the day as an argument for exactly this reason — never read it from the browser.

The admin Challenge Lab is the authoring surface for templates and days.

## Reward integrity

Reward claims use Supabase RPCs where double claiming would be costly:

- System quest reward claim.
- Custom quest completion.
- Daily challenge check-in.
- Challenge program day and program completion.
- Lesson completion.

The RPC should remain the final authority even when the client disables a button after the first click.

## Learning library

`/learn` is a static lesson catalog backed by `src/lib/lessons.ts`. Each lesson has content and completion criteria. `/learn/[lessonId]` presents the reader and quiz.

Successful completion calls an atomic reward RPC that records the completion and awards XP/coins once.

Journal-derived learnings are a separate concept. They live in journal insights/the learning library and represent the user's own knowledge rather than authored lessons.

## City

`/city` renders a 10×10 grid where the user places unlocked buildings.

### Building catalog

Buildings are organized into:

- Residential.
- Commercial.
- Nature.
- Civic.
- Landmark.

Each building has unlock requirements and a coin cost. Building unlocks are based on XP thresholds. The profile's total XP is the progression source; `city_states` stores city-specific state such as coins and claimed journal-entry reward IDs.

### Journal rewards

Eligible unclaimed journal entries can yield city rewards. A base reward is multiplied by the active streak, capped at a 2.5× multiplier for a 30-day streak.

The reward claimer prevents the same entry from being claimed again by storing claimed entry IDs.

### Placement

The building picker shows unlocked and affordable options. The grid stores user placements. Building placement and the related coin deduction are currently separate browser writes, so a future hardening pass should move them into one database function.

## Analytics

The previous `/analytics` route currently redirects to `/dashboard`. Analytics components still exist in `src/components/analytics/`, but there is no active general analytics page.

## Implementation locations

- `src/lib/gamification.ts`
- `src/lib/quests.ts`
- `src/lib/lessons.ts`
- `src/lib/city.ts`
- `src/lib/city/`
- `src/components/quests/`
- `src/components/learn/`
- `src/components/city/`

There are currently two city helper locations (`src/lib/city.ts` and `src/lib/city/city.ts`). Confirm which import a screen uses before changing catalog or tier behavior.


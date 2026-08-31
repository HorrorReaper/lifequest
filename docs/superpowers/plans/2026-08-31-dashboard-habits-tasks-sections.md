# Dashboard Habits/Tasks Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `DailyBriefingWidget` with three purpose-built dashboard sections — Today's plan, Habits, Tasks — and collapse the three divergent habit-check-in code paths into one that always pays the correct XP.

**Architecture:** All three sections are fed by props from the existing server component `src/app/(app)/dashboard/page.tsx`; none of them fetch on mount. Two pure library modules (`dashboard-habits.ts`, `dashboard-tasks.ts`) do the server-side shaping and carry the plan's real logic, so they are unit-testable without React or Supabase. A third library (`habit-check-in.ts`) becomes the single write path for checking a habit, shared with `/habits`.

**Tech Stack:** Next.js 16.2.4 (App Router, React 19.2.4), TypeScript, Supabase JS v2, Tailwind v4, shadcn-style primitives in `src/components/ui/`, Zustand (`useUserStore`), Vitest 4 + jsdom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-30-dashboard-habits-tasks-sections-design.md`

## Global Constraints

- **Verification commands:** `npm test` (Vitest), `npm run lint` (ESLint), `npx tsc --noEmit`. Baseline at the start of this plan is green: 73 test files, 508 tests, zero type errors. Any task that reduces those counts or adds an error has regressed something.
- **No literal colours.** Sections use semantic Tailwind tokens (`bg-background`, `border`, `text-muted-foreground`, `text-primary`, `bg-primary/5`, `text-destructive`). `THEMES` in `src/components/providers/theme-provider.tsx` is `['light','dark','system','white','trail']`; hardcoded hex breaks four of them. `src/components/dashboard/JournalNudge.tsx` is the reference for section chrome.
- **Section chrome:** each section is a `<section className="... rounded-2xl border ...">` with an `<h2>`, matching `JournalNudge`. Not a `<Card>`.
- **Tap targets:** interactive rows are `min-h-12`; buttons that are the primary action of a row are `size-10` or larger. This codebase is mobile-first.
- **Streak window:** `HABIT_STREAK_WINDOW_DAYS = 400`.
- **Task limits:** `DASHBOARD_TASK_FETCH_LIMIT = 16`, `DASHBOARD_TASK_DISPLAY_LIMIT = 8`.
- **XP amounts:** habits `calculateHabitCheckInXp(streak)` (10–20 XP, 3 coins); tasks a flat 5 via `awardTaskCompletionXp`'s default.
- **After every write**, a client component must call `window.dispatchEvent(new CustomEvent('lifequest-data-updated'))` and `router.refresh()`. `TaskManager` listens for that event and other surfaces depend on it.
- **Do not modify** `src/components/tasks/TaskManager.tsx`, `src/components/tasks/TaskList.tsx`, or `src/components/dashboard/TodayPlanWidget.tsx`. All three are live on `/dashboard2` and the first two are covered by `TaskList.test.tsx`.
- **Test style:** mock modules with `vi.hoisted` + `vi.mock`, `afterEach(cleanup)`, query by accessible role/name. Copy the shape of `src/components/tasks/TaskList.test.tsx`.

---

## File Structure

**Create**

| File | Responsibility |
| --- | --- |
| `src/lib/dashboard-habits.ts` | Pure. Turns habit rows + a window of completed logs into `DashboardHabit[]` carrying `completed` and `streakThroughYesterday`. Owns the streak window constant. |
| `src/lib/dashboard-habits.test.ts` | Unit tests for the above. |
| `src/lib/habit-check-in.ts` | The single habit check/uncheck write path: log write plus `check_in_habit_reward` / `undo_habit_check_in_reward`, with reward failures swallowed so the log write stands. |
| `src/lib/habit-check-in.test.ts` | Unit tests for the above, against a stub Supabase client. |
| `src/lib/dashboard-tasks.ts` | Pure. Partitions fetched task rows into the today-and-overdue set or the undated fallback, and counts them. |
| `src/lib/dashboard-tasks.test.ts` | Unit tests for the above. |
| `src/components/dashboard/TodayPlanSection.tsx` | Server component. Main Quest, Now/Next, remaining blocks, CTA to `/plan`. |
| `src/components/dashboard/TodayPlanSection.test.tsx` | Render tests. |
| `src/components/dashboard/HabitsSection.tsx` | Client component. Dot chain, one row per habit with streak and checkbox, add-habit dialog, inline retry. |
| `src/components/dashboard/HabitsSection.test.tsx` | Render + interaction tests. |
| `src/components/dashboard/TasksSection.tsx` | Client component. Priority stripe rows with due chips, completing checkbox, add-task dialog, footer count. |
| `src/components/dashboard/TasksSection.test.tsx` | Render + interaction tests. |

**Modify**

| File | Change |
| --- | --- |
| `src/components/habits/HabitManager.tsx:219-254` | Replace the inline reward block with a call to `applyHabitCheckIn`. No behaviour change. |
| `src/app/(app)/dashboard/page.tsx` | Widen the habit-log query, raise the task limit, add an open-task count, build the two shaped sets, render the three new sections plus `GoalsDashboardWidget`, rewire `?quick=`. |

**Delete**

- `src/components/dashboard/DailyBriefingWidget.tsx`
- `src/components/dashboard/HabitDashboardWidget.tsx`

---

### Task 1: Server-side habit shaping (`dashboard-habits.ts`)

Pure module, no React and no Supabase. It exists so the Habits section can render streaks and award correct XP with **zero client-side log history**.

**Files:**
- Create: `src/lib/dashboard-habits.ts`
- Test: `src/lib/dashboard-habits.test.ts`

**Interfaces:**
- Consumes: `addDays` from `src/lib/dates.ts`, `SkillCategory` from `src/lib/skill-categories.ts`.
- Produces:
  - `HABIT_STREAK_WINDOW_DAYS: 400`
  - `habitStreakWindowStart(today: string): string`
  - `interface DashboardHabitRow { id: string; name: string; emoji: string | null; color: string; skill_category: SkillCategory | null }`
  - `interface DashboardHabitLogRow { habit_id: string; log_date: string }`
  - `interface DashboardHabit { id: string; name: string; emoji: string; color: string; skillCategory: SkillCategory | null; completed: boolean; streakThroughYesterday: number }`
  - `buildDashboardHabits(input: { habits: DashboardHabitRow[]; completedLogs: DashboardHabitLogRow[]; today: string }): DashboardHabit[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dashboard-habits.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import {
  buildDashboardHabits,
  habitStreakWindowStart,
  HABIT_STREAK_WINDOW_DAYS,
  type DashboardHabitLogRow,
  type DashboardHabitRow,
} from './dashboard-habits'

const TODAY = '2026-08-31'

const habit: DashboardHabitRow = {
  id: 'habit-1',
  name: 'Meditate',
  emoji: '🧘',
  color: 'sky',
  skill_category: null,
}

function logs(...dates: string[]): DashboardHabitLogRow[] {
  return dates.map((log_date) => ({ habit_id: 'habit-1', log_date }))
}

function build(completedLogs: DashboardHabitLogRow[], habits = [habit]) {
  return buildDashboardHabits({ habits, completedLogs, today: TODAY })
}

describe('habitStreakWindowStart', () => {
  it('spans exactly HABIT_STREAK_WINDOW_DAYS days inclusive of today', () => {
    expect(HABIT_STREAK_WINDOW_DAYS).toBe(400)
    expect(habitStreakWindowStart('2026-08-31')).toBe('2025-07-28')
  })
})

describe('buildDashboardHabits', () => {
  it('marks a habit completed when today has a log', () => {
    expect(build(logs(TODAY))[0].completed).toBe(true)
  })

  it('marks a habit incomplete when today has no log', () => {
    expect(build(logs('2026-08-30'))[0].completed).toBe(false)
  })

  it('counts the consecutive run that ends yesterday', () => {
    const result = build(logs('2026-08-28', '2026-08-29', '2026-08-30'))
    expect(result[0].streakThroughYesterday).toBe(3)
  })

  // The streak is an input to calculateHabitCheckInXp, so an unchecked today
  // must not zero it out -- otherwise checking a habit on day 4 of a run pays
  // as if it were day 1.
  it('is unaffected by whether today itself is checked', () => {
    const withoutToday = build(logs('2026-08-29', '2026-08-30'))
    const withToday = build(logs('2026-08-29', '2026-08-30', TODAY))
    expect(withoutToday[0].streakThroughYesterday).toBe(2)
    expect(withToday[0].streakThroughYesterday).toBe(2)
  })

  it('returns 0 when yesterday was missed, even if earlier days are logged', () => {
    const result = build(logs('2026-08-27', '2026-08-28'))
    expect(result[0].streakThroughYesterday).toBe(0)
  })

  it('ignores logs dated after today', () => {
    const result = build(logs('2026-08-30', '2026-09-01'))
    expect(result[0].streakThroughYesterday).toBe(1)
    expect(result[0].completed).toBe(false)
  })

  it('stops counting at the window start rather than walking forever', () => {
    // Every day from the window start through today, inclusive.
    const every: string[] = []
    for (let offset = 0; offset < HABIT_STREAK_WINDOW_DAYS; offset += 1) {
      every.push(addDays(TODAY, -offset))
    }
    expect(every.at(-1)).toBe(habitStreakWindowStart(TODAY))

    const result = build(logs(...every))
    // Yesterday back to the window start: the window's length, less today.
    expect(result[0].streakThroughYesterday).toBe(HABIT_STREAK_WINDOW_DAYS - 1)
  })

  it('keeps one streak per habit and does not bleed logs across them', () => {
    const second: DashboardHabitRow = { ...habit, id: 'habit-2', name: 'Read' }
    const result = buildDashboardHabits({
      habits: [habit, second],
      completedLogs: [
        { habit_id: 'habit-1', log_date: '2026-08-30' },
        { habit_id: 'habit-1', log_date: '2026-08-29' },
        { habit_id: 'habit-2', log_date: '2026-08-30' },
      ],
      today: TODAY,
    })
    expect(result[0].streakThroughYesterday).toBe(2)
    expect(result[1].streakThroughYesterday).toBe(1)
  })

  it('preserves habit order and defaults a missing emoji', () => {
    const result = build(logs(), [{ ...habit, emoji: null }])
    expect(result[0].emoji).toBe('✅')
    expect(result[0].name).toBe('Meditate')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboard-habits.test.ts`
Expected: FAIL — `Failed to resolve import "./dashboard-habits"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/dashboard-habits.ts`:

```ts
import { addDays } from './dates'
import type { SkillCategory } from './skill-categories'

/**
 * How far back the dashboard reads habit_logs to compute streaks.
 *
 * A streak longer than this is under-reported. That is a deliberate ceiling:
 * bounding the query matters more than being right about a 400-day run, and
 * /habits (which reads the full history) will still show the true number.
 */
export const HABIT_STREAK_WINDOW_DAYS = 400

export function habitStreakWindowStart(today: string): string {
  return addDays(today, -(HABIT_STREAK_WINDOW_DAYS - 1))
}

export interface DashboardHabitRow {
  id: string
  name: string
  emoji: string | null
  color: string
  skill_category: SkillCategory | null
}

export interface DashboardHabitLogRow {
  habit_id: string
  log_date: string
}

export interface DashboardHabit {
  id: string
  name: string
  emoji: string
  color: string
  skillCategory: SkillCategory | null
  completed: boolean
  /**
   * Consecutive completed days ending exactly yesterday, 0 if yesterday was
   * missed. Deliberately excludes today so it stays stable as the user checks
   * boxes: the section derives the displayed streak as
   * `completed ? streakThroughYesterday + 1 : streakThroughYesterday`, and the
   * XP award as `calculateHabitCheckInXp(streakThroughYesterday + 1)` -- which
   * is exactly what /habits computes from full history.
   */
  streakThroughYesterday: number
}

function streakEndingYesterday(
  completions: Set<string>,
  today: string,
  windowStart: string
): number {
  let cursor = addDays(today, -1)
  let streak = 0
  while (cursor >= windowStart && completions.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function buildDashboardHabits({
  habits,
  completedLogs,
  today,
}: {
  habits: DashboardHabitRow[]
  completedLogs: DashboardHabitLogRow[]
  today: string
}): DashboardHabit[] {
  const windowStart = habitStreakWindowStart(today)
  const byHabit = new Map<string, Set<string>>()
  for (const log of completedLogs) {
    // A log dated in the future would otherwise inflate the streak the moment
    // the clock rolled over. Timezone skew makes that reachable.
    if (log.log_date > today) continue
    const dates = byHabit.get(log.habit_id) ?? new Set<string>()
    dates.add(log.log_date)
    byHabit.set(log.habit_id, dates)
  }

  return habits.map((habit) => {
    const completions = byHabit.get(habit.id) ?? new Set<string>()
    return {
      id: habit.id,
      name: habit.name,
      emoji: habit.emoji ?? '✅',
      color: habit.color,
      skillCategory: habit.skill_category,
      completed: completions.has(today),
      streakThroughYesterday: streakEndingYesterday(completions, today, windowStart),
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboard-habits.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/dashboard-habits.ts src/lib/dashboard-habits.test.ts
git commit -m "feat(dashboard): shape habits with a per-habit streak server-side

The Habits section needs a streak per habit, and the streak is an input to
calculateHabitCheckInXp rather than decoration. Deriving it on the server and
passing streakThroughYesterday means the client needs no log history at all:
the displayed streak and the XP award both fall out of that one number."
```

---

### Task 2: One habit check-in path (`habit-check-in.ts`)

Extract the check/uncheck-plus-reward sequence out of `HabitManager` so the new section cannot diverge from `/habits`. This task changes no behaviour — it is a pure refactor plus tests — and is independently shippable.

**Files:**
- Create: `src/lib/habit-check-in.ts`
- Test: `src/lib/habit-check-in.test.ts`
- Modify: `src/components/habits/HabitManager.tsx:219-254`

**Interfaces:**
- Consumes: `setHabitLogCompletion` from `src/lib/habits.ts`; `calculateHabitCheckInXp`, `checkInHabitReward`, `undoHabitCheckInReward` from `src/lib/habit-xp.ts`; `HabitLog` from `src/lib/types.ts`; `SkillCategory` from `src/lib/skill-categories.ts`.
- Produces:
  - `interface HabitCheckInReward { xp: number; coins: number; totalXpBefore: number }`
  - `interface HabitCheckInResult { log: HabitLog; reward: HabitCheckInReward | null }`
  - `applyHabitCheckIn(supabase: SupabaseClient, input: HabitCheckInInput): Promise<HabitCheckInResult>` where
    `interface HabitCheckInInput { userId: string; habitId: string; skillCategory: SkillCategory | null; date: string; completed: boolean; wasCompleted: boolean; streakAfterCheckIn: number; existingLog?: HabitLog }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/habit-check-in.test.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { applyHabitCheckIn } from './habit-check-in'
import type { HabitLog } from './types'

const savedLog: HabitLog = {
  id: 'log-1',
  user_id: 'user-1',
  habit_id: 'habit-1',
  entry_id: null,
  log_date: '2026-08-31',
  completed: true,
  created_at: '2026-08-31T08:00:00Z',
}

const mocks = vi.hoisted(() => ({
  setHabitLogCompletion: vi.fn(),
  checkInHabitReward: vi.fn(),
  undoHabitCheckInReward: vi.fn(),
}))

vi.mock('./habits', async (importOriginal) => {
  const original = await importOriginal<typeof import('./habits')>()
  return { ...original, setHabitLogCompletion: mocks.setHabitLogCompletion }
})

vi.mock('./habit-xp', async (importOriginal) => {
  const original = await importOriginal<typeof import('./habit-xp')>()
  return {
    ...original,
    checkInHabitReward: mocks.checkInHabitReward,
    undoHabitCheckInReward: mocks.undoHabitCheckInReward,
  }
})

const client = {} as SupabaseClient

function input(overrides: Partial<Parameters<typeof applyHabitCheckIn>[1]> = {}) {
  return {
    userId: 'user-1',
    habitId: 'habit-1',
    skillCategory: null,
    date: '2026-08-31',
    completed: true,
    wasCompleted: false,
    streakAfterCheckIn: 3,
    ...overrides,
  }
}

describe('applyHabitCheckIn', () => {
  it('writes the log and awards streak-scaled XP on a fresh check', async () => {
    mocks.setHabitLogCompletion.mockResolvedValue(savedLog)
    // streak 3 -> multiplier 1.06 -> 10.6 -> 11 XP
    mocks.checkInHabitReward.mockResolvedValue({ totalXp: 111, coins: 9, awarded: true })

    const result = await applyHabitCheckIn(client, input())

    expect(result.log).toBe(savedLog)
    expect(mocks.checkInHabitReward).toHaveBeenCalledWith(client, {
      habitId: 'habit-1',
      date: '2026-08-31',
      xp: 11,
      skillCategory: null,
    })
    expect(result.reward).toEqual({ xp: 11, coins: 9, totalXpBefore: 100 })
  })

  it('reports no reward when the RPC says it was already awarded', async () => {
    mocks.setHabitLogCompletion.mockResolvedValue(savedLog)
    mocks.checkInHabitReward.mockResolvedValue({ totalXp: 111, coins: 9, awarded: false })

    const result = await applyHabitCheckIn(client, input())

    expect(result.reward).toBeNull()
  })

  it('reverses the reward on an uncheck', async () => {
    mocks.setHabitLogCompletion.mockResolvedValue({ ...savedLog, completed: false })
    mocks.undoHabitCheckInReward.mockResolvedValue({ totalXp: 100, coins: 6, reversed: true })

    const result = await applyHabitCheckIn(
      client,
      input({ completed: false, wasCompleted: true })
    )

    expect(mocks.undoHabitCheckInReward).toHaveBeenCalledWith(client, {
      habitId: 'habit-1',
      date: '2026-08-31',
    })
    expect(result.reward).toEqual({ xp: 0, coins: 6, totalXpBefore: 100 })
    expect(mocks.checkInHabitReward).not.toHaveBeenCalled()
  })

  it('touches no reward RPC when completion did not actually change', async () => {
    mocks.setHabitLogCompletion.mockResolvedValue(savedLog)

    const result = await applyHabitCheckIn(client, input({ wasCompleted: true }))

    expect(mocks.checkInHabitReward).not.toHaveBeenCalled()
    expect(mocks.undoHabitCheckInReward).not.toHaveBeenCalled()
    expect(result.reward).toBeNull()
  })

  // The log write is the user's actual intent; a broken reward RPC must not
  // roll it back or surface an error that makes the tick look like it failed.
  it('keeps the log when the reward RPC throws', async () => {
    mocks.setHabitLogCompletion.mockResolvedValue(savedLog)
    mocks.checkInHabitReward.mockRejectedValue(new Error('rpc down'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await applyHabitCheckIn(client, input())

    expect(result.log).toBe(savedLog)
    expect(result.reward).toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })

  it('propagates a failed log write so the caller can roll back', async () => {
    mocks.setHabitLogCompletion.mockRejectedValue(new Error('offline'))

    await expect(applyHabitCheckIn(client, input())).rejects.toThrow('offline')
    expect(mocks.checkInHabitReward).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/habit-check-in.test.ts`
Expected: FAIL — `Failed to resolve import "./habit-check-in"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/habit-check-in.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { setHabitLogCompletion } from './habits'
import {
  calculateHabitCheckInXp,
  checkInHabitReward,
  undoHabitCheckInReward,
} from './habit-xp'
import type { SkillCategory } from './skill-categories'
import type { HabitLog } from './types'

export interface HabitCheckInReward {
  /** XP granted by this action; 0 on an uncheck. */
  xp: number
  coins: number
  /** The profile total *before* this action, which is what addXp expects. */
  totalXpBefore: number
}

export interface HabitCheckInResult {
  log: HabitLog
  /** Null when nothing was awarded or reversed -- including RPC failure. */
  reward: HabitCheckInReward | null
}

export interface HabitCheckInInput {
  userId: string
  habitId: string
  skillCategory: SkillCategory | null
  date: string
  completed: boolean
  /** Completion state before this action, so the reward is only paid on a change. */
  wasCompleted: boolean
  /**
   * The streak the habit has once this check-in is saved -- i.e. including
   * `date`. Passed in rather than derived because the two callers know it
   * differently: /habits has full log history, the dashboard has
   * streakThroughYesterday + 1. Ignored on an uncheck.
   */
  streakAfterCheckIn: number
  existingLog?: HabitLog
}

/**
 * The single path for checking or unchecking a habit.
 *
 * Before this existed there were three: /habits paid streak-scaled XP and
 * coins, while HabitDashboardWidget and the Today Focus card silently paid
 * nothing. Any new surface must call this rather than writing habit_logs
 * directly.
 */
export async function applyHabitCheckIn(
  supabase: SupabaseClient,
  input: HabitCheckInInput
): Promise<HabitCheckInResult> {
  const log = await setHabitLogCompletion(supabase, {
    existingLog: input.existingLog,
    userId: input.userId,
    habitId: input.habitId,
    date: input.date,
    completed: input.completed,
  })

  // Deliberately swallowed: the log write above is the user's intent and has
  // already succeeded. A reward outage should cost XP, not the tick.
  try {
    if (input.completed && !input.wasCompleted) {
      const { xp } = calculateHabitCheckInXp(input.streakAfterCheckIn)
      const result = await checkInHabitReward(supabase, {
        habitId: input.habitId,
        date: input.date,
        xp,
        skillCategory: input.skillCategory,
      })
      if (result.awarded) {
        return { log, reward: { xp, coins: result.coins, totalXpBefore: result.totalXp - xp } }
      }
    } else if (!input.completed && input.wasCompleted) {
      const result = await undoHabitCheckInReward(supabase, {
        habitId: input.habitId,
        date: input.date,
      })
      if (result.reversed) {
        return { log, reward: { xp: 0, coins: result.coins, totalXpBefore: result.totalXp } }
      }
    }
  } catch (rewardError) {
    console.error('Failed to apply habit check-in reward', rewardError)
  }

  return { log, reward: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/habit-check-in.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Refactor `HabitManager` onto it**

In `src/components/habits/HabitManager.tsx`, replace the whole body of the outer `try` in `saveCompletion` (currently lines 205-255, from `const savedLog = await setHabitLogCompletion(supabase, {` through `notifyUpdated();`) with:

```tsx
      const summary = buildHabitSummary({ habit, logs, today, timezone });
      const { log: savedLog, reward } = await applyHabitCheckIn(supabase, {
        userId,
        habitId: habit.id,
        skillCategory: habit.skill_category ?? null,
        date,
        completed,
        wasCompleted: previousLog?.completed ?? false,
        // buildHabitSummary above runs over history that does not yet include
        // this check-in, so the post-save streak is one more than it reports.
        streakAfterCheckIn: summary.currentStreak + 1,
        existingLog: previousLog,
      });
      setLogs((current) => [
        ...current.filter(
          (log) => !(log.habit_id === habit.id && log.log_date === date)
        ),
        savedLog,
      ]);
      if (reward) {
        addXp(reward.xp, reward.totalXpBefore);
        setCoins(reward.coins);
      }
      notifyUpdated();
```

Add the import:

```tsx
import { applyHabitCheckIn } from "@/lib/habit-check-in";
```

Then remove the now-unused imports from that file: `setHabitLogCompletion` (from `@/lib/habits`), and `calculateHabitCheckInXp`, `checkInHabitReward`, `undoHabitCheckInReward` (from `@/lib/habit-xp`). Leave every other import alone — `buildHabitSummary` is still used here and at line 803.

> **Why `summary.currentStreak + 1` is the same number as before.** The old code called `buildHabitSummary` with `logs` *plus* `savedLog`, so its `currentStreak` already counted the day being checked. The new call omits `savedLog` because it runs before the write, so it counts one fewer. `calculateCurrentStreak` walks back from `today` while each day is present, so adding the checked day adds exactly 1.
>
> Note this preserves an existing quirk: `buildHabitSummary` is passed `today`, not `date`, so back-filling an older day is priced off the current streak. That is pre-existing behaviour and out of scope.

- [ ] **Step 6: Verify the refactor changed nothing**

Run: `npx vitest run src/components/habits/HabitManager.test.tsx src/lib/habit-check-in.test.ts`
Expected: PASS. `HabitManager.test.tsx` must pass **unmodified** — if it needs edits, the refactor changed behaviour and is wrong.

Run: `npm run lint && npx tsc --noEmit`
Expected: clean. A "declared but never read" error means a stale import survived Step 5.

- [ ] **Step 7: Commit**

```bash
git add src/lib/habit-check-in.ts src/lib/habit-check-in.test.ts src/components/habits/HabitManager.tsx
git commit -m "refactor(habits): extract one check-in-with-reward path

The same user action had three implementations: /habits paid streak-scaled XP
and coins, while HabitDashboardWidget and the Today Focus card silently paid
nothing. Collapsing the sequence into applyHabitCheckIn gives the dashboard
section somewhere correct to call and makes a fourth divergence harder.

Pure refactor -- HabitManager.test.tsx passes unmodified."
```

---

### Task 3: `TodayPlanSection`

A server component. It replaces the Main Quest, Now/Next, and Upcoming Plan panels of the retired card, fed entirely by props the page already computes.

**Files:**
- Create: `src/components/dashboard/TodayPlanSection.tsx`
- Test: `src/components/dashboard/TodayPlanSection.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`, `cn` from `@/lib/utils`, `CalendarClock`/`Circle`/`Target` from `lucide-react`.
- Produces:
  - `interface TodayPlanBlock { id: string; startTime: string; endTime: string; title: string; category: string; isCurrent: boolean; isPast: boolean }`
  - `function TodayPlanSection(props: { todayLabel: string; mainQuestTitle: string | null; planCommitted: boolean; blocks: TodayPlanBlock[] }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/TodayPlanSection.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TodayPlanSection,
  type TodayPlanBlock,
} from '@/components/dashboard/TodayPlanSection'

afterEach(cleanup)

const past: TodayPlanBlock = {
  id: 'b1',
  startTime: '08:00',
  endTime: '09:00',
  title: 'Morning pages',
  category: 'personal',
  isCurrent: false,
  isPast: true,
}
const current: TodayPlanBlock = {
  id: 'b2',
  startTime: '09:00',
  endTime: '11:00',
  title: 'Deep work on the plan',
  category: 'deep_work',
  isCurrent: true,
  isPast: false,
}
const upcoming: TodayPlanBlock = {
  id: 'b3',
  startTime: '14:00',
  endTime: '15:00',
  title: 'Review inbox',
  category: 'other',
  isCurrent: false,
  isPast: false,
}

function renderSection(props: Partial<Parameters<typeof TodayPlanSection>[0]> = {}) {
  return render(
    <TodayPlanSection
      todayLabel="Monday, Aug 31"
      mainQuestTitle={null}
      planCommitted={false}
      blocks={[]}
      {...props}
    />
  )
}

describe('TodayPlanSection', () => {
  it('leads with the current block', () => {
    renderSection({ blocks: [past, current, upcoming] })
    expect(screen.getByText('Deep work on the plan')).toBeTruthy()
    expect(screen.getByText('Now')).toBeTruthy()
  })

  it('falls forward to the next block when nothing is current', () => {
    renderSection({ blocks: [past, upcoming] })
    expect(screen.getByText('Review inbox')).toBeTruthy()
    expect(screen.queryByText('Now')).toBeNull()
  })

  it('shows the Main Quest when the day has one', () => {
    renderSection({ mainQuestTitle: 'Ship the sections' })
    expect(screen.getByText('Main Quest')).toBeTruthy()
    expect(screen.getByText('Ship the sections')).toBeTruthy()
  })

  it('omits the Main Quest block entirely when there is none', () => {
    renderSection()
    expect(screen.queryByText('Main Quest')).toBeNull()
  })

  it('lists the blocks still ahead, excluding the one already featured', () => {
    renderSection({ blocks: [past, current, upcoming] })
    const later = screen.getByRole('list', { name: /later today/i })
    expect(later.textContent).toContain('Review inbox')
    expect(later.textContent).not.toContain('Morning pages')
  })

  it('hides the later list when the featured block is the only one left', () => {
    renderSection({ blocks: [past, current] })
    expect(screen.queryByRole('list', { name: /later today/i })).toBeNull()
  })

  it('invites planning when the day has no blocks at all', () => {
    renderSection()
    expect(screen.getByText(/no plan yet/i)).toBeTruthy()
    const cta = screen.getByRole('link', { name: /start planning ritual/i })
    expect(cta.getAttribute('href')).toBe('/plan')
  })

  it('offers a review instead once the plan is committed', () => {
    renderSection({ planCommitted: true, blocks: [current] })
    const cta = screen.getByRole('link', { name: /review today.s plan/i })
    expect(cta.getAttribute('href')).toBe('/plan')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/TodayPlanSection.test.tsx`
Expected: FAIL — cannot resolve `@/components/dashboard/TodayPlanSection`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/dashboard/TodayPlanSection.tsx`:

```tsx
import Link from 'next/link'
import { CalendarClock, Circle, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface TodayPlanBlock {
  id: string
  startTime: string
  endTime: string
  title: string
  category: string
  isCurrent: boolean
  isPast: boolean
}

interface TodayPlanSectionProps {
  todayLabel: string
  mainQuestTitle: string | null
  planCommitted: boolean
  blocks: TodayPlanBlock[]
}

const LATER_LIMIT = 3

/**
 * The three panels worth keeping from the retired Today Focus card: Main
 * Quest, Now/Next, and what is still ahead.
 *
 * A server component on purpose. `isCurrent` and `isPast` are resolved by the
 * page against the profile timezone, so there is nothing here to fetch and no
 * reason to ship JavaScript for it. TodayPlanWidget covers similar ground on
 * /dashboard2, but derives its date from the device clock and knows nothing
 * about Main Quest; it is left to die with that route rather than reused.
 */
export function TodayPlanSection({
  todayLabel,
  mainQuestTitle,
  planCommitted,
  blocks,
}: TodayPlanSectionProps) {
  const ahead = blocks.filter((block) => !block.isPast)
  const featured = ahead.find((block) => block.isCurrent) ?? ahead[0] ?? null
  const later = ahead.filter((block) => block.id !== featured?.id).slice(0, LATER_LIMIT)

  return (
    <section className="rounded-2xl border bg-background/60 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Today&apos;s plan</h2>
        <p className="text-xs text-muted-foreground">{todayLabel}</p>
      </div>

      {mainQuestTitle && (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Main Quest
            </p>
            <p className="mt-1 text-sm font-semibold">{mainQuestTitle}</p>
          </div>
        </div>
      )}

      {featured ? (
        <div className="mt-3 rounded-xl border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarClock className="size-3.5" />
              {featured.isCurrent ? 'Now' : 'Next'}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {featured.startTime}–{featured.endTime}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium">{featured.title}</p>
          <p className="mt-0.5 text-xs capitalize text-muted-foreground">
            {featured.category.replace('_', ' ')}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          No plan yet for today. Give the day a shape and the rest of this page
          follows it.
        </p>
      )}

      {later.length > 0 && (
        <ul aria-label="Later today" className="mt-3 space-y-1.5">
          {later.map((block) => (
            <li key={block.id} className="flex items-center gap-2 text-xs">
              <Circle className="size-3 shrink-0 text-muted-foreground" />
              <span className="w-24 shrink-0 font-mono text-muted-foreground">
                {block.startTime}–{block.endTime}
              </span>
              <span className="min-w-0 flex-1 truncate">{block.title}</span>
            </li>
          ))}
        </ul>
      )}

      <Button
        asChild
        variant={featured ? 'outline' : 'default'}
        className={cn('mt-4 w-full')}
      >
        <Link href="/plan">
          <CalendarClock className="mr-1.5 size-4" />
          {planCommitted ? 'Review Today’s Plan' : 'Start Planning Ritual'}
        </Link>
      </Button>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/TodayPlanSection.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/dashboard/TodayPlanSection.tsx src/components/dashboard/TodayPlanSection.test.tsx
git commit -m "feat(dashboard): add a Today's plan section

Carries Main Quest, Now/Next and what is still ahead out of the Today Focus
card. A server component fed from props the page already computes against the
profile timezone, so it ships no JavaScript."
```

---

### Task 4: `HabitsSection`

**Files:**
- Create: `src/components/dashboard/HabitsSection.tsx`
- Test: `src/components/dashboard/HabitsSection.test.tsx`

**Interfaces:**
- Consumes: `DashboardHabit` (Task 1); `applyHabitCheckIn` (Task 2); `createHabit` from `@/lib/habits`; `HabitEditorDialog`, `habitColorClass`, `HabitEditorValue` from `@/components/habits/HabitEditorDialog`; `Checkbox` from `@/components/ui/checkbox`; `useUserStore`.
- Produces: `function HabitsSection(props: { userId: string; today: string; habits: DashboardHabit[]; initiallyAddingHabit?: boolean }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/HabitsSection.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardHabit } from '@/lib/dashboard-habits'
import { HabitsSection } from '@/components/dashboard/HabitsSection'

const mocks = vi.hoisted(() => ({
  applyHabitCheckIn: vi.fn(),
  createHabit: vi.fn(),
  refresh: vi.fn(),
  addXp: vi.fn(),
  setCoins: vi.fn(),
}))

afterEach(cleanup)

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/lib/stores/user-store', () => ({
  useUserStore: (selector: (state: unknown) => unknown) =>
    selector({ addXp: mocks.addXp, setCoins: mocks.setCoins }),
}))
vi.mock('@/lib/habit-check-in', () => ({ applyHabitCheckIn: mocks.applyHabitCheckIn }))
vi.mock('@/lib/habits', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/habits')>()
  return { ...original, createHabit: mocks.createHabit }
})

const meditate: DashboardHabit = {
  id: 'habit-1',
  name: 'Meditate',
  emoji: '🧘',
  color: 'sky',
  skillCategory: null,
  completed: false,
  streakThroughYesterday: 4,
}
const read: DashboardHabit = {
  id: 'habit-2',
  name: 'Read',
  emoji: '📚',
  color: 'amber',
  skillCategory: null,
  completed: true,
  streakThroughYesterday: 0,
}

function renderSection(habits: DashboardHabit[]) {
  return render(<HabitsSection userId="user-1" today="2026-08-31" habits={habits} />)
}

describe('HabitsSection', () => {
  beforeEach(() => {
    mocks.applyHabitCheckIn.mockResolvedValue({ log: {}, reward: null })
  })

  it('counts what is done in the header', () => {
    renderSection([meditate, read])
    expect(screen.getByText('1 of 2 today')).toBeTruthy()
  })

  it('draws one chain dot per habit', () => {
    renderSection([meditate, read])
    expect(screen.getByLabelText('1 of 2 habits checked').children).toHaveLength(2)
  })

  it('shows every habit as its own row, not just the next one', () => {
    renderSection([meditate, read])
    expect(screen.getByRole('checkbox', { name: /mark meditate complete/i })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /mark read incomplete/i })).toBeTruthy()
  })

  it('shows the streak including today when the habit is already checked', () => {
    renderSection([{ ...meditate, completed: true, streakThroughYesterday: 4 }])
    expect(screen.getByText('5 day streak')).toBeTruthy()
  })

  it('shows the streak through yesterday when today is still open', () => {
    renderSection([meditate])
    expect(screen.getByText('4 day streak')).toBeTruthy()
  })

  it('says nothing about streaks at zero', () => {
    renderSection([{ ...meditate, streakThroughYesterday: 0 }])
    expect(screen.queryByText(/day streak/i)).toBeNull()
  })

  it('checks a habit through the shared path, priced one day past yesterday', async () => {
    renderSection([meditate])
    await userEvent.click(screen.getByRole('checkbox', { name: /mark meditate complete/i }))

    await waitFor(() => expect(mocks.applyHabitCheckIn).toHaveBeenCalled())
    expect(mocks.applyHabitCheckIn.mock.calls[0][1]).toMatchObject({
      userId: 'user-1',
      habitId: 'habit-1',
      date: '2026-08-31',
      completed: true,
      wasCompleted: false,
      streakAfterCheckIn: 5,
    })
  })

  it('pushes the reward into the user store', async () => {
    mocks.applyHabitCheckIn.mockResolvedValue({
      log: {},
      reward: { xp: 11, coins: 9, totalXpBefore: 100 },
    })
    renderSection([meditate])
    await userEvent.click(screen.getByRole('checkbox', { name: /mark meditate complete/i }))

    await waitFor(() => expect(mocks.addXp).toHaveBeenCalledWith(11, 100))
    expect(mocks.setCoins).toHaveBeenCalledWith(9)
  })

  it('ticks the box optimistically before the write resolves', async () => {
    let resolve: (value: unknown) => void = () => {}
    mocks.applyHabitCheckIn.mockReturnValue(new Promise((r) => { resolve = r }))
    renderSection([meditate])

    await userEvent.click(screen.getByRole('checkbox', { name: /mark meditate complete/i }))
    expect(screen.getByText('1 of 1 today')).toBeTruthy()
    resolve({ log: {}, reward: null })
  })

  it('reverts the row and offers a retry when the write fails', async () => {
    mocks.applyHabitCheckIn.mockRejectedValue(new Error('offline'))
    renderSection([meditate])

    await userEvent.click(screen.getByRole('checkbox', { name: /mark meditate complete/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('0 of 1 today')).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('retries the same habit when asked', async () => {
    mocks.applyHabitCheckIn.mockRejectedValueOnce(new Error('offline'))
    renderSection([meditate])

    await userEvent.click(screen.getByRole('checkbox', { name: /mark meditate complete/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() => expect(mocks.applyHabitCheckIn).toHaveBeenCalledTimes(2))
  })

  it('invites a first habit when there are none', () => {
    renderSection([])
    expect(screen.getByText(/no habits yet/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /manage habits/i })).toBeNull()
  })

  it('does not nag once everything is checked', () => {
    renderSection([{ ...meditate, completed: true }, read])
    expect(screen.getByText('2 of 2 today')).toBeTruthy()
  })

  it('links to the habit manager', () => {
    renderSection([meditate])
    expect(
      screen.getByRole('link', { name: /manage habits/i }).getAttribute('href')
    ).toBe('/habits')
  })

  it('opens the add-habit dialog on the quick-action deep link', () => {
    render(
      <HabitsSection userId="user-1" today="2026-08-31" habits={[meditate]} initiallyAddingHabit />
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/HabitsSection.test.tsx`
Expected: FAIL — cannot resolve `@/components/dashboard/HabitsSection`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/dashboard/HabitsSection.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronRight, Flame, Plus, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { applyHabitCheckIn } from '@/lib/habit-check-in'
import { createHabit } from '@/lib/habits'
import type { DashboardHabit } from '@/lib/dashboard-habits'
import { useUserStore } from '@/lib/stores/user-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  HabitEditorDialog,
  habitColorClass,
  type HabitEditorValue,
} from '@/components/habits/HabitEditorDialog'

interface HabitsSectionProps {
  userId: string
  /** The user's day, resolved from the profile timezone by the page. */
  today: string
  habits: DashboardHabit[]
  /** Set by the ?quick=habit deep link. */
  initiallyAddingHabit?: boolean
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Every habit as its own tickable row, replacing the Today Focus card's
 * percentage bar that named only the next unchecked one.
 *
 * Fed entirely by server props -- unlike the HabitDashboardWidget it replaces,
 * it does not fetch on mount, so the home screen never shows a spinner where
 * the habits should be. Writes go through applyHabitCheckIn so a tick here
 * pays the same XP and coins as one on /habits.
 */
export function HabitsSection({
  userId,
  today,
  habits,
  initiallyAddingHabit = false,
}: HabitsSectionProps) {
  const supabase = createClient()
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)
  const setCoins = useUserStore((state) => state.setCoins)
  const [local, setLocal] = useState(habits)
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set())
  const [editorOpen, setEditorOpen] = useState(initiallyAddingHabit)
  const [creating, setCreating] = useState(false)
  const [failure, setFailure] = useState<{
    message: string
    retry: () => void | Promise<void>
  } | null>(null)

  // The page re-renders on router.refresh(); adopt the server's truth so a
  // check made elsewhere (a routine run, /habits in another tab) shows up.
  useEffect(() => {
    setLocal(habits)
  }, [habits])

  const doneCount = local.filter((habit) => habit.completed).length

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
    router.refresh()
  }

  async function toggle(habit: DashboardHabit, completed: boolean) {
    if (busyIds.has(habit.id)) return
    setBusyIds((current) => new Set(current).add(habit.id))
    setFailure(null)
    setLocal((current) =>
      current.map((item) => (item.id === habit.id ? { ...item, completed } : item))
    )

    try {
      const { reward } = await applyHabitCheckIn(supabase, {
        userId,
        habitId: habit.id,
        skillCategory: habit.skillCategory,
        date: today,
        completed,
        wasCompleted: habit.completed,
        // streakThroughYesterday deliberately excludes today, so the streak
        // this check-in produces is always one more than it.
        streakAfterCheckIn: habit.streakThroughYesterday + 1,
      })
      if (reward) {
        addXp(reward.xp, reward.totalXpBefore)
        setCoins(reward.coins)
      }
      notifyUpdated()
    } catch (error) {
      setLocal((current) =>
        current.map((item) =>
          item.id === habit.id ? { ...item, completed: habit.completed } : item
        )
      )
      setFailure({
        message: errorMessage(error, `Could not update ${habit.name}.`),
        retry: () => toggle(habit, completed),
      })
    } finally {
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(habit.id)
        return next
      })
    }
  }

  async function handleCreate(value: HabitEditorValue) {
    if (creating) return
    setCreating(true)
    setFailure(null)
    try {
      await createHabit(supabase, userId, { ...value, sortOrder: local.length })
      setEditorOpen(false)
      notifyUpdated()
    } catch (error) {
      setFailure({
        message: errorMessage(error, 'Could not create this habit.'),
        retry: () => handleCreate(value),
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-background/60 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Habits</h2>
        {local.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {doneCount} of {local.length} today
          </p>
        )}
      </div>

      {/* One dot per habit rather than a percentage: it carries completion and
          also tells the user how many habits there are. */}
      {local.length > 0 && (
        <div
          aria-label={`${doneCount} of ${local.length} habits checked`}
          className="mt-3 flex items-center gap-1.5"
        >
          {local.map((habit) => (
            <span
              key={habit.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                habit.completed ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      )}

      {failure && (
        <div
          role="alert"
          className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <span className="flex gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {failure.message}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              const retry = failure.retry
              setFailure(null)
              void retry()
            }}
          >
            <RotateCcw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {local.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed p-4 text-center">
          <p className="text-sm font-medium">No habits yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add one daily behaviour to begin the chain.
          </p>
          <Button size="sm" className="mt-3" onClick={() => setEditorOpen(true)}>
            <Plus className="size-3.5" />
            Add habit
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {local.map((habit) => {
              const streak = habit.completed
                ? habit.streakThroughYesterday + 1
                : habit.streakThroughYesterday
              return (
                <li
                  key={habit.id}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2',
                    habit.completed && 'bg-muted/40'
                  )}
                >
                  <Checkbox
                    checked={habit.completed}
                    disabled={busyIds.has(habit.id)}
                    onCheckedChange={() => void toggle(habit, !habit.completed)}
                    aria-label={`Mark ${habit.name} ${habit.completed ? 'incomplete' : 'complete'}`}
                  />
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-lg text-sm text-white',
                      habitColorClass(habit.color)
                    )}
                  >
                    {habit.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm',
                        habit.completed && 'text-muted-foreground'
                      )}
                    >
                      {habit.name}
                    </p>
                    {streak > 0 && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Flame className="size-3 text-orange-500" />
                        {streak} day streak
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setEditorOpen(true)}
            >
              <Plus className="size-3.5" />
              Add habit
            </Button>
            <Button asChild variant="ghost" size="sm" className="flex-1">
              <Link href="/habits">
                Manage habits
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </>
      )}

      <HabitEditorDialog
        open={editorOpen}
        busy={creating}
        onOpenChange={setEditorOpen}
        onSubmit={handleCreate}
      />
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/HabitsSection.test.tsx`
Expected: PASS, 15 tests.

If `useUserStore` fails, check the mock: this component calls it with a selector (`useUserStore((state) => state.addXp)`), so the mock must apply the selector — unlike `TaskList.test.tsx`, whose component destructures the whole store.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/dashboard/HabitsSection.tsx src/components/dashboard/HabitsSection.test.tsx
git commit -m "feat(dashboard): add a Habits section with per-habit rows

Every habit gets its own row with a streak and a checkbox, so checking the
second one no longer costs a trip into a modal. Writes go through
applyHabitCheckIn, which means a tick here finally pays the same XP and coins
as one on /habits. Server props only -- no spinner on the home screen."
```

---

### Task 5: Server-side task shaping (`dashboard-tasks.ts`)

Pure module. It owns the today-versus-unscheduled decision so the section only renders.

**Files:**
- Create: `src/lib/dashboard-tasks.ts`
- Test: `src/lib/dashboard-tasks.test.ts`

**Interfaces:**
- Consumes: `TaskPriority` from `src/lib/tasks.ts`.
- Produces:
  - `DASHBOARD_TASK_FETCH_LIMIT: 16`, `DASHBOARD_TASK_DISPLAY_LIMIT: 8`
  - `interface DashboardTaskRow { id: string; title: string; due_date: string | null; priority: TaskPriority | null }`
  - `interface DashboardTask { id: string; title: string; dueDate: string | null; priority: TaskPriority; isOverdue: boolean }`
  - `interface DashboardTaskSet { tasks: DashboardTask[]; isUnscheduledFallback: boolean; overdueCount: number; dueTodayCount: number }`
  - `buildDashboardTaskSet(input: { rows: DashboardTaskRow[]; today: string }): DashboardTaskSet`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dashboard-tasks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildDashboardTaskSet,
  DASHBOARD_TASK_DISPLAY_LIMIT,
  DASHBOARD_TASK_FETCH_LIMIT,
  type DashboardTaskRow,
} from './dashboard-tasks'

const TODAY = '2026-08-31'

function row(overrides: Partial<DashboardTaskRow> & { id: string }): DashboardTaskRow {
  return { title: `Task ${overrides.id}`, due_date: TODAY, priority: 'medium', ...overrides }
}

function build(rows: DashboardTaskRow[]) {
  return buildDashboardTaskSet({ rows, today: TODAY })
}

describe('limits', () => {
  it('fetches more than it displays so the fallback has something to use', () => {
    expect(DASHBOARD_TASK_FETCH_LIMIT).toBe(16)
    expect(DASHBOARD_TASK_DISPLAY_LIMIT).toBe(8)
    expect(DASHBOARD_TASK_FETCH_LIMIT).toBeGreaterThan(DASHBOARD_TASK_DISPLAY_LIMIT)
  })
})

describe('buildDashboardTaskSet', () => {
  it('keeps tasks due today and marks them not overdue', () => {
    const set = build([row({ id: 'a' })])
    expect(set.tasks).toHaveLength(1)
    expect(set.tasks[0].isOverdue).toBe(false)
    expect(set.dueTodayCount).toBe(1)
    expect(set.overdueCount).toBe(0)
    expect(set.isUnscheduledFallback).toBe(false)
  })

  it('marks anything dated before today as overdue', () => {
    const set = build([row({ id: 'a', due_date: '2026-08-29' })])
    expect(set.tasks[0].isOverdue).toBe(true)
    expect(set.overdueCount).toBe(1)
    expect(set.dueTodayCount).toBe(0)
  })

  it('drops undated tasks while anything is actually due', () => {
    const set = build([row({ id: 'a' }), row({ id: 'b', due_date: null })])
    expect(set.tasks.map((task) => task.id)).toEqual(['a'])
  })

  // A user who never sets due dates would otherwise stare at an empty section
  // while holding twenty open tasks.
  it('falls back to undated tasks when nothing is due', () => {
    const set = build([
      row({ id: 'a', due_date: null }),
      row({ id: 'b', due_date: null }),
    ])
    expect(set.isUnscheduledFallback).toBe(true)
    expect(set.tasks.map((task) => task.id)).toEqual(['a', 'b'])
    expect(set.overdueCount).toBe(0)
    expect(set.dueTodayCount).toBe(0)
  })

  it('ignores tasks dated in the future, which are neither due nor unscheduled', () => {
    const set = build([row({ id: 'a', due_date: '2026-09-05' })])
    expect(set.tasks).toHaveLength(0)
    expect(set.isUnscheduledFallback).toBe(false)
  })

  it('is an empty non-fallback set when there is nothing open at all', () => {
    const set = build([])
    expect(set.tasks).toHaveLength(0)
    expect(set.isUnscheduledFallback).toBe(false)
  })

  it('sorts overdue first, then by due date, then by priority', () => {
    const set = build([
      row({ id: 'today-low', due_date: TODAY, priority: 'low' }),
      row({ id: 'today-high', due_date: TODAY, priority: 'high' }),
      row({ id: 'older', due_date: '2026-08-20' }),
      row({ id: 'newer-overdue', due_date: '2026-08-30' }),
    ])
    expect(set.tasks.map((task) => task.id)).toEqual([
      'older',
      'newer-overdue',
      'today-high',
      'today-low',
    ])
  })

  it('caps the rendered rows at the display limit but still counts them all', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row({ id: `t${index}`, due_date: TODAY })
    )
    const set = build(rows)
    expect(set.tasks).toHaveLength(DASHBOARD_TASK_DISPLAY_LIMIT)
    expect(set.dueTodayCount).toBe(12)
  })

  it('caps the undated fallback at the display limit too', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row({ id: `t${index}`, due_date: null })
    )
    expect(build(rows).tasks).toHaveLength(DASHBOARD_TASK_DISPLAY_LIMIT)
  })

  it('defaults a null priority to medium', () => {
    expect(build([row({ id: 'a', priority: null })]).tasks[0].priority).toBe('medium')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboard-tasks.test.ts`
Expected: FAIL — `Failed to resolve import "./dashboard-tasks"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/dashboard-tasks.ts`:

```ts
import type { TaskPriority } from './tasks'

/**
 * Fetched deliberately higher than the display limit: the same query supplies
 * both the today-and-overdue set and the undated fallback, so it needs enough
 * rows to fill either one.
 */
export const DASHBOARD_TASK_FETCH_LIMIT = 16
export const DASHBOARD_TASK_DISPLAY_LIMIT = 8

export interface DashboardTaskRow {
  id: string
  title: string
  due_date: string | null
  priority: TaskPriority | null
}

export interface DashboardTask {
  id: string
  title: string
  dueDate: string | null
  priority: TaskPriority
  isOverdue: boolean
}

export interface DashboardTaskSet {
  /** The rows to render, already sorted and capped. */
  tasks: DashboardTask[]
  /** True when `tasks` holds undated work because nothing was actually due. */
  isUnscheduledFallback: boolean
  overdueCount: number
  dueTodayCount: number
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

function toDashboardTask(row: DashboardTaskRow, today: string): DashboardTask {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    priority: row.priority ?? 'medium',
    isOverdue: row.due_date !== null && row.due_date < today,
  }
}

function byUrgency(a: DashboardTask, b: DashboardTask): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate < b.dueDate ? -1 : 1
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

/**
 * Splits the page's single task query into what the section should show.
 *
 * Scope is today-and-overdue, because a section headed "Tasks · 3 today" that
 * silently includes undated work is the imprecision this redesign exists to
 * fix. But when nothing at all is due, undated work is shown instead rather
 * than claiming the day is clear.
 */
export function buildDashboardTaskSet({
  rows,
  today,
}: {
  rows: DashboardTaskRow[]
  today: string
}): DashboardTaskSet {
  const all = rows.map((row) => toDashboardTask(row, today))
  const due = all.filter((task) => task.dueDate !== null && task.dueDate <= today)

  if (due.length > 0) {
    return {
      tasks: due.slice().sort(byUrgency).slice(0, DASHBOARD_TASK_DISPLAY_LIMIT),
      isUnscheduledFallback: false,
      overdueCount: due.filter((task) => task.isOverdue).length,
      dueTodayCount: due.filter((task) => !task.isOverdue).length,
    }
  }

  const undated = all.filter((task) => task.dueDate === null)
  return {
    tasks: undated.slice(0, DASHBOARD_TASK_DISPLAY_LIMIT),
    isUnscheduledFallback: undated.length > 0,
    overdueCount: 0,
    dueTodayCount: 0,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboard-tasks.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/dashboard-tasks.ts src/lib/dashboard-tasks.test.ts
git commit -m "feat(dashboard): shape today's tasks with an unscheduled fallback

Scope is today-and-overdue so the header's counts mean what they say. When
nothing is due, undated work is shown rather than an empty section -- a user
who never sets due dates would otherwise see a permanently clear day."
```

---

### Task 6: `TasksSection`

**Files:**
- Create: `src/components/dashboard/TasksSection.tsx`
- Test: `src/components/dashboard/TasksSection.test.tsx`

**Interfaces:**
- Consumes: `DashboardTaskSet`, `DashboardTask` (Task 5); `toggleTask`, `awardTaskCompletionXp`, `createTask` from `@/lib/tasks`; `TaskEditorDialog`, `TaskEditorDraft` from `@/components/tasks/TaskEditorDialog`; `Checkbox`; `useUserStore`.
- Produces: `function TasksSection(props: { userId: string; today: string; taskSet: DashboardTaskSet; totalOpenCount: number; initiallyAddingTask?: boolean }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `src/components/dashboard/TasksSection.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardTaskSet } from '@/lib/dashboard-tasks'
import { TasksSection } from '@/components/dashboard/TasksSection'

const mocks = vi.hoisted(() => ({
  toggleTask: vi.fn(),
  awardTaskCompletionXp: vi.fn(),
  createTask: vi.fn(),
  refresh: vi.fn(),
  addXp: vi.fn(),
}))

afterEach(cleanup)

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/lib/stores/user-store', () => ({
  useUserStore: (selector: (state: unknown) => unknown) => selector({ addXp: mocks.addXp }),
}))
vi.mock('@/lib/tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/tasks')>()
  return {
    ...original,
    toggleTask: mocks.toggleTask,
    awardTaskCompletionXp: mocks.awardTaskCompletionXp,
    createTask: mocks.createTask,
  }
})

const dueToday: DashboardTaskSet = {
  tasks: [
    { id: 'task-1', title: 'Review dashboard', dueDate: '2026-08-31', priority: 'high', isOverdue: false },
    { id: 'task-2', title: 'Water plants', dueDate: '2026-08-29', priority: 'low', isOverdue: true },
  ],
  isUnscheduledFallback: false,
  overdueCount: 1,
  dueTodayCount: 1,
}

function renderSection(
  taskSet: DashboardTaskSet = dueToday,
  props: { totalOpenCount?: number; initiallyAddingTask?: boolean } = {}
) {
  return render(
    <TasksSection
      userId="user-1"
      today="2026-08-31"
      taskSet={taskSet}
      totalOpenCount={props.totalOpenCount ?? 2}
      initiallyAddingTask={props.initiallyAddingTask}
    />
  )
}

describe('TasksSection', () => {
  beforeEach(() => {
    mocks.toggleTask.mockResolvedValue({ id: 'task-1', is_completed: true })
    mocks.awardTaskCompletionXp.mockResolvedValue({ awarded: true, previousTotal: 100, newTotal: 105 })
  })

  it('splits the header count into overdue and today', () => {
    renderSection()
    expect(screen.getByText('1 overdue · 1 today')).toBeTruthy()
  })

  it('shows every task, not just the top one', () => {
    renderSection()
    expect(screen.getByText('Review dashboard')).toBeTruthy()
    expect(screen.getByText('Water plants')).toBeTruthy()
  })

  it('keeps red for Overdue rather than spending it on priority', () => {
    renderSection()
    expect(screen.getByText('Overdue')).toBeTruthy()
    expect(screen.queryByText(/high priority/i)).toBeNull()
  })

  it('labels a task due today', () => {
    renderSection()
    expect(screen.getByText('Today')).toBeTruthy()
  })

  it('completes a task in place and awards 5 XP', async () => {
    renderSection()
    await userEvent.click(screen.getByRole('checkbox', { name: /complete review dashboard/i }))

    await waitFor(() =>
      expect(mocks.toggleTask).toHaveBeenCalledWith({ client: true }, 'task-1', true)
    )
    expect(mocks.awardTaskCompletionXp).toHaveBeenCalledWith(
      { client: true },
      'user-1',
      { id: 'task-1', title: 'Review dashboard' }
    )
    await waitFor(() => expect(mocks.addXp).toHaveBeenCalledWith(5, 100))
  })

  it('does not double-credit when the award was already banked', async () => {
    mocks.awardTaskCompletionXp.mockResolvedValue({ awarded: false, previousTotal: 0, newTotal: 0 })
    renderSection()
    await userEvent.click(screen.getByRole('checkbox', { name: /complete review dashboard/i }))

    await waitFor(() => expect(mocks.toggleTask).toHaveBeenCalled())
    expect(mocks.addXp).not.toHaveBeenCalled()
  })

  it('removes the row optimistically', async () => {
    let resolve: (value: unknown) => void = () => {}
    mocks.toggleTask.mockReturnValue(new Promise((r) => { resolve = r }))
    renderSection()

    await userEvent.click(screen.getByRole('checkbox', { name: /complete review dashboard/i }))
    expect(screen.queryByText('Review dashboard')).toBeNull()
    resolve({ id: 'task-1', is_completed: true })
  })

  it('puts the row back with a retry when the write fails', async () => {
    mocks.toggleTask.mockRejectedValue(new Error('offline'))
    renderSection()

    await userEvent.click(screen.getByRole('checkbox', { name: /complete review dashboard/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('Review dashboard')).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('reads as a finished day when nothing is open', () => {
    renderSection(
      { tasks: [], isUnscheduledFallback: false, overdueCount: 0, dueTodayCount: 0 },
      { totalOpenCount: 0 }
    )
    expect(screen.getByText('Nothing due today.')).toBeTruthy()
  })

  it('offers unscheduled work instead of claiming the day is clear', () => {
    renderSection(
      {
        tasks: [{ id: 'task-9', title: 'Someday thing', dueDate: null, priority: 'medium', isOverdue: false }],
        isUnscheduledFallback: true,
        overdueCount: 0,
        dueTodayCount: 0,
      },
      { totalOpenCount: 3 }
    )
    expect(screen.getByText('Nothing due today · 1 unscheduled')).toBeTruthy()
    expect(screen.getByText('Someday thing')).toBeTruthy()
  })

  it('names the full backlog in the footer link', () => {
    renderSection(dueToday, { totalOpenCount: 14 })
    const link = screen.getByRole('link', { name: /all tasks \(14\)/i })
    expect(link.getAttribute('href')).toBe('/tasks')
  })

  it('drops the count from the footer when the section already shows everything', () => {
    renderSection(dueToday, { totalOpenCount: 2 })
    expect(screen.getByRole('link', { name: /^all tasks$/i }).getAttribute('href')).toBe('/tasks')
  })

  it('opens the add-task dialog on the quick-action deep link', () => {
    renderSection(dueToday, { initiallyAddingTask: true })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/dashboard/TasksSection.test.tsx`
Expected: FAIL — cannot resolve `@/components/dashboard/TasksSection`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/dashboard/TasksSection.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronRight, Plus, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { awardTaskCompletionXp, createTask, toggleTask } from '@/lib/tasks'
import type { TaskPriority } from '@/lib/tasks'
import type { DashboardTask, DashboardTaskSet } from '@/lib/dashboard-tasks'
import { useUserStore } from '@/lib/stores/user-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  TaskEditorDialog,
  type TaskEditorDraft,
} from '@/components/tasks/TaskEditorDialog'

interface TasksSectionProps {
  userId: string
  /** The user's day, resolved from the profile timezone by the page. */
  today: string
  taskSet: DashboardTaskSet
  /** Every open task, including the ones this section does not show. */
  totalOpenCount: number
  /** Set by the ?quick=task deep link. */
  initiallyAddingTask?: boolean
}

/** A 3px stripe instead of the words "high priority", which freed the red. */
const PRIORITY_STRIPE: Record<TaskPriority, string> = {
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-sky-500',
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function dueLabel(task: DashboardTask, today: string): string | null {
  if (task.isOverdue) return 'Overdue'
  if (task.dueDate === today) return 'Today'
  return null
}

/**
 * Today's and overdue tasks as completable rows, replacing the Today Focus
 * card's single "Top Task" panel.
 *
 * Deliberately not a third mode of TaskManager: that component fetches its own
 * data, ignores the today scope, and is already two modes in 837 lines. What
 * matters is reused instead -- toggleTask, awardTaskCompletionXp and
 * TaskEditorDialog -- which is where drift would actually cost something.
 */
export function TasksSection({
  userId,
  today,
  taskSet,
  totalOpenCount,
  initiallyAddingTask = false,
}: TasksSectionProps) {
  const supabase = createClient()
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set())
  const [editorOpen, setEditorOpen] = useState(initiallyAddingTask)
  const [saving, setSaving] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [failure, setFailure] = useState<{
    message: string
    retry: () => void | Promise<void>
  } | null>(null)

  // The server set is the truth after router.refresh(); drop the optimistic
  // hides so a task completed elsewhere and re-added does not stay invisible.
  useEffect(() => {
    setCompletedIds(new Set())
  }, [taskSet])

  const visible = taskSet.tasks.filter((task) => !completedIds.has(task.id))
  const remaining = Math.max(totalOpenCount - completedIds.size, 0)

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
    router.refresh()
  }

  async function complete(task: DashboardTask) {
    if (completedIds.has(task.id)) return
    setFailure(null)
    setCompletedIds((current) => new Set(current).add(task.id))

    try {
      await toggleTask(supabase, task.id, true)
      // Idempotent: it checks xp_events for this task first, so a retry or a
      // second surface cannot pay twice.
      const award = await awardTaskCompletionXp(supabase, userId, {
        id: task.id,
        title: task.title,
      })
      if (award.awarded) addXp(5, award.previousTotal)
      notifyUpdated()
    } catch (error) {
      setCompletedIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
      setFailure({
        message: errorMessage(error, `Could not complete ${task.title}.`),
        retry: () => complete(task),
      })
    }
  }

  async function handleCreate(draft: TaskEditorDraft) {
    if (saving) return
    setSaving(true)
    setEditorError(null)
    try {
      await createTask(supabase, userId, draft)
      setEditorOpen(false)
      notifyUpdated()
    } catch (error) {
      setEditorError(errorMessage(error, 'Could not create this task.'))
    } finally {
      setSaving(false)
    }
  }

  const headline = taskSet.isUnscheduledFallback
    ? `Nothing due today · ${visible.length} unscheduled`
    : taskSet.overdueCount > 0 || taskSet.dueTodayCount > 0
      ? [
          taskSet.overdueCount > 0 ? `${taskSet.overdueCount} overdue` : null,
          taskSet.dueTodayCount > 0 ? `${taskSet.dueTodayCount} today` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null

  return (
    <section className="rounded-2xl border bg-background/60 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Tasks</h2>
        {headline && <p className="text-xs text-muted-foreground">{headline}</p>}
      </div>

      {failure && (
        <div
          role="alert"
          className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <span className="flex gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {failure.message}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              const retry = failure.retry
              setFailure(null)
              void retry()
            }}
          >
            <RotateCcw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing due today.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((task) => {
            const due = dueLabel(task, today)
            return (
              <li
                key={task.id}
                className="flex min-h-12 items-center gap-3 overflow-hidden rounded-xl border pr-3"
              >
                <span
                  aria-hidden="true"
                  className={cn('h-full w-[3px] self-stretch', PRIORITY_STRIPE[task.priority])}
                />
                <Checkbox
                  checked={false}
                  onCheckedChange={() => void complete(task)}
                  aria-label={`Complete ${task.title}`}
                />
                <p className="min-w-0 flex-1 truncate py-2 text-sm">{task.title}</p>
                {due && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs',
                      task.isOverdue
                        ? 'bg-destructive/10 font-medium text-destructive'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {due}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            setEditorError(null)
            setEditorOpen(true)
          }}
        >
          <Plus className="size-3.5" />
          Add task
        </Button>
        <Button asChild variant="ghost" size="sm" className="flex-1">
          <Link href="/tasks">
            {remaining > visible.length ? `All tasks (${remaining})` : 'All tasks'}
            <ChevronRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <TaskEditorDialog
        open={editorOpen}
        task={null}
        saving={saving}
        error={editorError}
        onOpenChange={setEditorOpen}
        onSubmit={handleCreate}
      />
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/dashboard/TasksSection.test.tsx`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/dashboard/TasksSection.tsx src/components/dashboard/TasksSection.test.tsx
git commit -m "feat(dashboard): add a Tasks section for today and overdue

Shows all of today's and overdue tasks with a completing checkbox, instead of
naming one of the eight the page had already fetched. Priority becomes a 3px
stripe so the only red left on the card is Overdue. Completion goes through
awardTaskCompletionXp, which -- unlike the card's hand-rolled xp_events insert
-- cannot pay twice."
```

---

### Task 7: Wire the dashboard and retire the card

The only task that changes what a user sees. It also deletes 977 lines.

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Delete: `src/components/dashboard/DailyBriefingWidget.tsx`, `src/components/dashboard/HabitDashboardWidget.tsx`

**Interfaces:**
- Consumes everything produced by Tasks 1, 3, 4, 5, 6.
- Produces: no new exports.

- [ ] **Step 1: Confirm nothing else imports the two doomed components**

Run:
```bash
grep -rn "DailyBriefingWidget\|HabitDashboardWidget" src/ --include='*.ts' --include='*.tsx'
```
Expected: only `src/app/(app)/dashboard/page.tsx` (lines 12 and 312), `DailyBriefingWidget.tsx` and `HabitDashboardWidget.tsx` themselves, plus a comment mentioning `DailyBriefingWidget` in `JournalNudge.tsx`. If anything else appears, stop and re-plan.

- [ ] **Step 2: Swap the imports**

In `src/app/(app)/dashboard/page.tsx`, remove:

```tsx
import { DailyBriefingWidget } from '@/components/dashboard/DailyBriefingWidget'
```

and add:

```tsx
import { TodayPlanSection } from '@/components/dashboard/TodayPlanSection'
import { HabitsSection } from '@/components/dashboard/HabitsSection'
import { TasksSection } from '@/components/dashboard/TasksSection'
import { GoalsDashboardWidget } from '@/components/dashboard/GoalsDashboardWidget'
import { buildDashboardHabits, habitStreakWindowStart } from '@/lib/dashboard-habits'
import {
  buildDashboardTaskSet,
  DASHBOARD_TASK_FETCH_LIMIT,
} from '@/lib/dashboard-tasks'
```

- [ ] **Step 3: Narrow the quick-action targets**

Replace the `QuickActionTarget` type and `parseQuickAction` (lines 27 and 36-42) with:

```tsx
type QuickActionTarget = 'task' | 'plan' | 'habit' | 'routine'
```

```tsx
function parseQuickAction(value: string | string[] | undefined): QuickActionTarget | null {
  const quick = Array.isArray(value) ? value[0] : value
  if (quick === 'task' || quick === 'plan' || quick === 'habit' || quick === 'routine') {
    return quick
  }
  return null
}
```

`goal` is dropped: it was never in `quick-action-button.tsx`, and with Goals now rendered inline there is nothing to deep-link to.

Then, immediately after `if (quickAction === 'plan') redirect('/plan')`, add:

```tsx
  // Routines used to open a tab in the retired "Manage your day" sheet.
  if (quickAction === 'routine') redirect('/routines')
```

- [ ] **Step 4: Widen the habit queries**

In the big `Promise.all`, change the habits select (line 128) to include the two columns the section and the reward need:

```tsx
    supabase
      .from('habits')
      .select('id, name, emoji, color, skill_category')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
```

and replace the today-only log query (lines 136-141) with the streak window:

```tsx
    // A window rather than just today: the streak per habit is an input to
    // calculateHabitCheckInXp, so the section cannot pay correctly without it.
    // Today's completions come out of these same rows.
    supabase
      .from('habit_logs')
      .select('habit_id, log_date')
      .eq('user_id', user.id)
      .eq('completed', true)
      .lte('log_date', today)
      .gte('log_date', habitStreakWindowStart(today)),
```

- [ ] **Step 5: Raise the task limit and count the backlog**

Change `.limit(8)` on the tasks query (line 151) to:

```tsx
      .limit(DASHBOARD_TASK_FETCH_LIMIT),
```

Then add a new entry at the end of the same `Promise.all` array, after the `tasksCompletedTodayRes` query, and add `openTaskCountRes` to the destructuring list on the left:

```tsx
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_completed', false),
```

- [ ] **Step 6: Build the shaped sets**

Replace the `completedHabitIds` / `briefingHabits` / `briefingTasks` block (lines 177-206) with:

```tsx
  const habitLogRows = (briefingHabitLogsRes.data ?? []) as {
    habit_id: string
    log_date: string
  }[]
  const completedHabitIds = new Set(
    habitLogRows.filter((log) => log.log_date === today).map((log) => log.habit_id)
  )
  const dashboardHabits = buildDashboardHabits({
    habits: (briefingHabitsRes.data ?? []) as {
      id: string
      name: string
      emoji: string | null
      color: string
      skill_category: SkillCategory | null
    }[],
    completedLogs: habitLogRows,
    today,
  })
  const taskSet = buildDashboardTaskSet({
    rows: (briefingTasksRes.data ?? []) as {
      id: string
      title: string
      due_date: string | null
      priority: 'low' | 'medium' | 'high' | null
    }[],
    today,
  })
  const openTaskCount = openTaskCountRes.count ?? 0
```

Add the `SkillCategory` import at the top:

```tsx
import type { SkillCategory } from '@/lib/skill-categories'
```

Then update the one other reader of the old array — `habitsCompletedToday` (line 234) and the `habitsTotal` prop — to use the new one:

```tsx
  const habitsCompletedToday = dashboardHabits.filter((habit) => habit.completed).length
```

and in `<EveningReviewPrompt>`, change `habitsTotal={briefingHabits.length}` to `habitsTotal={dashboardHabits.length}`.

`briefingJournals`, `completedTemplateIds`, `eveningReviewTemplate`, `planBlocks`, and `dashboardRoutines` are all still needed — leave them alone.

- [ ] **Step 7: Replace the card with the sections**

Delete the whole `<DailyBriefingWidget ... />` element (lines 312-338) and put in its place:

```tsx
        <TodayPlanSection
          todayLabel={dayLabel(profile.timezone ?? 'UTC')}
          mainQuestTitle={mainQuestTitle}
          planCommitted={planCommitted}
          blocks={planBlocks}
        />

        <HabitsSection
          key={`habits-${quickAction ?? 'default'}`}
          userId={user.id}
          today={today}
          habits={dashboardHabits}
          initiallyAddingHabit={quickAction === 'habit'}
        />

        <TasksSection
          key={`tasks-${quickAction ?? 'default'}`}
          userId={user.id}
          today={today}
          taskSet={taskSet}
          totalOpenCount={openTaskCount}
          initiallyAddingTask={quickAction === 'task'}
        />
```

The `key` follows the pattern the retired card used: it forces a remount when the user arrives on a `?quick=` link so the dialog opens even if they were already on the page.

Then, next to the existing routines section, add Goals:

```tsx
        {isAdmin && <RoutinesDashboardWidget routines={dashboardRoutines} />}

        {isAdmin && (
          <GoalsDashboardWidget userId={user.id} initialGoals={activeGoals} />
        )}
```

`planBlocks` currently carries a `missionType` field that `TodayPlanSection` does not accept. Drop `missionType: block.mission_type ?? null,` from the `planBlocks` map (line 254) — nothing else reads it.

- [ ] **Step 8: Delete the retired components**

```bash
git rm src/components/dashboard/DailyBriefingWidget.tsx src/components/dashboard/HabitDashboardWidget.tsx
```

- [ ] **Step 9: Verify the whole suite**

Run: `npx tsc --noEmit`
Expected: clean. A `RoutinesManager` or `TaskList` unused-import error means Step 8 removed the last consumer of something still imported elsewhere — check `dashboard2/page.tsx` is untouched.

Run: `npm run lint`
Expected: clean.

Run: `npm test`
Expected: PASS. Test files ≥ 78 (73 baseline + 5 new); tests ≥ 508 baseline plus the ~62 added here. No test file may have been *modified* to make this pass — if `HabitManager.test.tsx` or `TaskList.test.tsx` fails, the change reached further than intended.

- [ ] **Step 10: Check it in a browser**

Run: `npm run dev`, sign in, and confirm on `/dashboard`:
1. Today's plan, Habits, and Tasks render in that order below the journal nudge.
2. Ticking a habit shows an XP gain and a coin change, and the streak increments. Reloading keeps it ticked.
3. Un-ticking the same habit reverses the XP and coins.
4. Completing a task removes the row and awards 5 XP; reloading keeps it gone.
5. `/dashboard?quick=habit` opens the add-habit dialog; `?quick=task` opens the add-task dialog; `?quick=routine` lands on `/routines`.
6. Switch the theme to `trail`, `white`, and `dark` from settings — all three sections stay legible with no hardcoded colour showing through.
7. `/dashboard2` still loads and its task list and plan widget still work.

- [ ] **Step 11: Commit**

```bash
git add -A src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(dashboard): retire Today's Focus for purpose-built sections

The card summarised six things and let the user act on almost none of them
without opening a modal that had no visible trigger -- only a ?quick= deep
link could reach it. It is replaced by the three sections built in this
branch, plus GoalsDashboardWidget, which had no entry point at all.

Habit check-ins from the dashboard now pay the same streak-scaled XP and coins
as /habits, and task completion goes through the idempotent award helper
instead of the card's unguarded xp_events insert.

?quick=habit and ?quick=task open the sections' own add-forms; ?quick=routine
redirects to /routines as ?quick=plan already redirected to /plan; ?quick=goal
is dropped, having never been reachable from the UI."
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| Page order | 7 (Step 7) |
| Habits section: header count, dot chain, per-habit rows, streaks, footer | 4 |
| Habits states: empty / all-done / failed-write retry | 4 |
| Tasks section: header, priority stripe, checkbox, due chip, footer | 6 |
| Tasks states: unscheduled fallback / empty / overflow | 5 and 6 |
| Today's plan section: Main Quest, Now/Next, remaining blocks | 3 |
| Semantic tokens, no literal hex | Global Constraints; verified in 7 Step 10.6 |
| Decision 1: habit XP parity + one write path | 1, 2, 4 |
| Decision 1: task XP idempotence | 6 |
| Decision 2: new server section, `TodayPlanWidget` untouched | 3; Global Constraints |
| Decision 3: `GoalsDashboardWidget` gets an admin section | 7 (Step 7) |
| Decision 4: today+overdue with undated fallback, one query | 5, 7 (Steps 5-6) |
| Decision 5: `TasksSection` new, `TaskManager` untouched | 6; Global Constraints |
| `?quick=` rewiring including dropping `goal` | 7 (Steps 3, 7) |
| Delete `DailyBriefingWidget` and `HabitDashboardWidget` | 7 (Step 8) |
| 400-day streak window | 1 |

No gaps.

**Type consistency** — `DashboardHabit` (Task 1) is consumed unchanged by Task 4. `applyHabitCheckIn`'s `streakAfterCheckIn` is fed `summary.currentStreak + 1` by `HabitManager` (Task 2) and `habit.streakThroughYesterday + 1` by `HabitsSection` (Task 4); both are "the streak including the day being checked", which is what the name and the doc comment say. `DashboardTaskSet` (Task 5) is consumed unchanged by Task 6. `TodayPlanBlock` (Task 3) is a strict subset of the object `page.tsx` builds once `missionType` is dropped in Task 7 Step 7.

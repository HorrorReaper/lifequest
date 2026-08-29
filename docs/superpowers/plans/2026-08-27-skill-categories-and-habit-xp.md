# Skill Categories and Habit XP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users a per-category ("skill") view of their XP — Physical Health, Mental Health, Focus, Learning, Relationships, Career — fed by optionally-tagged habits and custom quests, and finally make habit check-ins award XP and coins (with a streak multiplier), which they don't today.

**Architecture:** Three additive, nullable schema columns (`habits.skill_category`, `quests.skill_category`, `xp_events.skill_category`) plus two new Postgres RPCs for habit check-in rewards, mirroring this codebase's existing `claim_system_quest_reward`/`complete_custom_quest_reward` pattern (atomic profile-XP + city-coins + xp_events-ledger updates in one transaction) rather than the older client-side task-XP pattern, since habit check-ins need to grant both XP and coins together. A new `src/lib/skill-categories.ts` module is the single source of truth for the taxonomy; a new `src/lib/habit-xp.ts` module holds the pure streak-multiplier formula and the RPC wrapper functions. Everything else is additive UI (an optional skill picker on habit/quest forms, a reactivated `/analytics` page with a new Skills tab).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres + RLS + RPCs via `security definer` functions), Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-skill-categories-and-habit-xp-design.md`

## Global Constraints

- Skill taxonomy is a fresh, purpose-built list — not a reuse of the existing `goals.category` enum: `physical_health | mental_health | focus | learning | relationships | career`.
- All three new schema columns (`habits.skill_category`, `quests.skill_category`, `xp_events.skill_category`) are nullable — no forced migration or default-category assignment for existing rows.
- Journal entries, tasks, system quests, and challenge programs are NOT tagged with a skill category in this iteration — only habits and custom quests get the picker.
- No backfill of historical `xp_events` rows — skill totals only reflect XP granted after this feature ships.
- Habit check-in XP: base 10 XP, streak multiplier `min(2.0, 1 + streakDays * 0.02)` rounded to the nearest integer, flat +3 coins (not streak-scaled). One grant per `(habit, date)` — unchecking claws back exactly what was granted.
- Do not touch `src/components/marketing/*`, `src/lib/nightfall-scene.ts`, or any other file from the unrelated Nightfall City landing page work.
- Do not consolidate the existing triplicated task-completion XP logic (`TaskManager.tsx`, `DailyBriefingWidget.tsx`, `api/chat/route.ts`) — that's a separate, out-of-scope technical debt item noted in the spec.

---

## Task 1: Skill taxonomy module and schema migration

**Files:**
- Create: `src/lib/skill-categories.ts`
- Test: `src/lib/skill-categories.test.ts`
- Create: `supabase/migrations/20260827120000_add_skill_categories.sql`

**Interfaces:**
- Produces: `SkillCategory` (TS union type), `SKILL_CATEGORIES: SkillCategoryDef[]` (each `{ id: SkillCategory; label: string; emoji: string }`), `SKILL_CATEGORY_LABELS: Record<SkillCategory, string>`. Every later task imports `SkillCategory` from this module.
- Produces (SQL): a Postgres enum type `public.skill_category` with the 6 values, plus nullable `skill_category` columns on `habits`, `quests`, and `xp_events`. Task 2's migration depends on this enum type already existing.

- [ ] **Step 1: Write the failing test**

Create `src/lib/skill-categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SKILL_CATEGORIES, SKILL_CATEGORY_LABELS, type SkillCategory } from "./skill-categories";

describe("skill categories", () => {
  it("has exactly 6 categories with unique ids", () => {
    expect(SKILL_CATEGORIES).toHaveLength(6);
    const ids = SKILL_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("has a label for every category, matching SKILL_CATEGORY_LABELS", () => {
    for (const category of SKILL_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
      expect(SKILL_CATEGORY_LABELS[category.id]).toBe(category.label);
    }
  });

  it("has a non-empty emoji for every category", () => {
    for (const category of SKILL_CATEGORIES) {
      expect(category.emoji.length).toBeGreaterThan(0);
    }
  });

  it("includes the six expected category ids", () => {
    const ids = SKILL_CATEGORIES.map((c) => c.id) as SkillCategory[];
    expect(ids).toEqual(
      expect.arrayContaining([
        "physical_health",
        "mental_health",
        "focus",
        "learning",
        "relationships",
        "career",
      ])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/skill-categories.test.ts`
Expected: FAIL — `Failed to resolve import "./skill-categories"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/skill-categories.ts`:

```ts
export type SkillCategory =
  | "physical_health"
  | "mental_health"
  | "focus"
  | "learning"
  | "relationships"
  | "career";

export interface SkillCategoryDef {
  id: SkillCategory;
  label: string;
  emoji: string;
}

export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  { id: "physical_health", label: "Physical Health", emoji: "💪" },
  { id: "mental_health", label: "Mental Health", emoji: "🧘" },
  { id: "focus", label: "Focus", emoji: "🎯" },
  { id: "learning", label: "Learning", emoji: "📚" },
  { id: "relationships", label: "Relationships", emoji: "🤝" },
  { id: "career", label: "Career", emoji: "💼" },
];

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> =
  Object.fromEntries(
    SKILL_CATEGORIES.map((category) => [category.id, category.label])
  ) as Record<SkillCategory, string>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/skill-categories.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the schema migration**

Create `supabase/migrations/20260827120000_add_skill_categories.sql`:

```sql
create type public.skill_category as enum (
  'physical_health',
  'mental_health',
  'focus',
  'learning',
  'relationships',
  'career'
);

alter table public.habits
  add column skill_category public.skill_category;

alter table public.quests
  add column skill_category public.skill_category;

alter table public.xp_events
  add column skill_category public.skill_category;
```

- [ ] **Step 6: Apply the migration and verify**

Run: `npx supabase db push` (or this repo's established migration-apply command — check `package.json` scripts for a `db:push`/`supabase:migrate` alias first and prefer that if one exists).
Expected: migration applies with no errors; confirm via `npx supabase db diff` (or equivalent) that no further schema drift is reported for these three columns.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/skill-categories.ts src/lib/skill-categories.test.ts`
Expected: no errors.

- [ ] **Step 8: Regenerate Supabase types**

Run this repo's existing type-generation command (check `package.json` for a `supabase:types`/`gen:types` script; if none exists, run `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`, matching whatever project ref/flags other entries in this repo's history used).
Expected: `src/lib/supabase/database.types.ts` now shows `skill_category` as a nullable column on `habits`, `quests`, and `xp_events`' `Row`/`Insert`/`Update` shapes.

- [ ] **Step 9: Commit**

```bash
git add src/lib/skill-categories.ts src/lib/skill-categories.test.ts supabase/migrations/20260827120000_add_skill_categories.sql src/lib/supabase/database.types.ts
git commit -m "feat(gamification): add skill category taxonomy and schema columns"
```

---

## Task 2: Habit check-in XP — RPCs, multiplier formula, and wrapper module

**Files:**
- Create: `supabase/migrations/20260827130000_habit_checkin_rewards.sql`
- Create: `src/lib/habit-xp.ts`
- Test: `src/lib/habit-xp.test.ts`

**Interfaces:**
- Consumes: the `public.skill_category` enum type from Task 1's migration.
- Produces: `calculateHabitCheckInXp(streakDays: number): { xp: number; coins: number }`; `checkInHabitReward(supabase: SupabaseClient, params: { habitId: string; date: string; xp: number; skillCategory: SkillCategory | null }): Promise<{ totalXp: number; coins: number; awarded: boolean }>`; `undoHabitCheckInReward(supabase: SupabaseClient, params: { habitId: string; date: string }): Promise<{ totalXp: number; coins: number; reversed: boolean }>`. Task 3 calls all three.

- [ ] **Step 1: Write the failing test for the multiplier formula**

Create `src/lib/habit-xp.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  calculateHabitCheckInXp,
  checkInHabitReward,
  undoHabitCheckInReward,
} from "./habit-xp";

describe("calculateHabitCheckInXp", () => {
  it("awards the base 10 XP and 3 coins at streak 0", () => {
    expect(calculateHabitCheckInXp(0)).toEqual({ xp: 10, coins: 3 });
  });

  it("scales XP with the streak below the cap", () => {
    // multiplier = 1 + 10*0.02 = 1.2 -> 10 * 1.2 = 12
    expect(calculateHabitCheckInXp(10)).toEqual({ xp: 12, coins: 3 });
    // multiplier = 1 + 25*0.02 = 1.5 -> 10 * 1.5 = 15
    expect(calculateHabitCheckInXp(25)).toEqual({ xp: 15, coins: 3 });
  });

  it("caps the multiplier at 2.0x", () => {
    // multiplier would be 1 + 50*0.02 = 2.0 exactly -> at the cap
    expect(calculateHabitCheckInXp(50)).toEqual({ xp: 20, coins: 3 });
    // multiplier would be 1 + 100*0.02 = 3.0, capped to 2.0 -> still 20
    expect(calculateHabitCheckInXp(100)).toEqual({ xp: 20, coins: 3 });
  });

  it("rounds to the nearest integer XP", () => {
    // multiplier = 1 + 15*0.02 = 1.3 -> 10 * 1.3 = 13 exactly, no rounding needed;
    // streak 7: multiplier = 1.14 -> 11.4 -> rounds to 11
    expect(calculateHabitCheckInXp(7).xp).toBe(11);
  });
});

function habitRpcClient(rpcName: string, response: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async (name: string) => {
    if (name !== rpcName) throw new Error(`unexpected rpc: ${name}`);
    return response;
  });
  return {
    client: { rpc } as unknown as SupabaseClient,
    rpc,
  };
}

describe("checkInHabitReward", () => {
  it("calls the check_in_habit_reward RPC with the expected params and returns the result", async () => {
    const { client, rpc } = habitRpcClient("check_in_habit_reward", {
      data: [{ total_xp: 120, coins: 43, awarded: true }],
      error: null,
    });

    const result = await checkInHabitReward(client, {
      habitId: "habit-1",
      date: "2026-08-27",
      xp: 12,
      skillCategory: "physical_health",
    });

    expect(rpc).toHaveBeenCalledWith("check_in_habit_reward", {
      p_habit_id: "habit-1",
      p_date: "2026-08-27",
      p_xp: 12,
      p_skill_category: "physical_health",
    });
    expect(result).toEqual({ totalXp: 120, coins: 43, awarded: true });
  });

  it("passes null skill_category through when the habit is untagged", async () => {
    const { client, rpc } = habitRpcClient("check_in_habit_reward", {
      data: [{ total_xp: 100, coins: 40, awarded: true }],
      error: null,
    });

    await checkInHabitReward(client, {
      habitId: "habit-1",
      date: "2026-08-27",
      xp: 10,
      skillCategory: null,
    });

    expect(rpc).toHaveBeenCalledWith("check_in_habit_reward", {
      p_habit_id: "habit-1",
      p_date: "2026-08-27",
      p_xp: 10,
      p_skill_category: null,
    });
  });

  it("throws when the RPC returns an error", async () => {
    const { client } = habitRpcClient("check_in_habit_reward", {
      data: null,
      error: new Error("boom"),
    });

    await expect(
      checkInHabitReward(client, {
        habitId: "habit-1",
        date: "2026-08-27",
        xp: 10,
        skillCategory: null,
      })
    ).rejects.toThrow("boom");
  });
});

describe("undoHabitCheckInReward", () => {
  it("calls the undo_habit_check_in_reward RPC and returns the result", async () => {
    const { client, rpc } = habitRpcClient("undo_habit_check_in_reward", {
      data: [{ total_xp: 108, coins: 40, reversed: true }],
      error: null,
    });

    const result = await undoHabitCheckInReward(client, {
      habitId: "habit-1",
      date: "2026-08-27",
    });

    expect(rpc).toHaveBeenCalledWith("undo_habit_check_in_reward", {
      p_habit_id: "habit-1",
      p_date: "2026-08-27",
    });
    expect(result).toEqual({ totalXp: 108, coins: 40, reversed: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/habit-xp.test.ts`
Expected: FAIL — `Failed to resolve import "./habit-xp"`.

- [ ] **Step 3: Write the schema migration for the two RPCs**

Create `supabase/migrations/20260827130000_habit_checkin_rewards.sql`:

```sql
create or replace function public.check_in_habit_reward(
  p_habit_id uuid,
  p_date date,
  p_xp integer,
  p_skill_category public.skill_category default null
)
returns table(total_xp integer, coins integer, awarded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_id text;
  v_existing uuid;
  v_current_total_xp integer;
  v_current_coins integer;
  v_reward_coins integer := 3;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_source_id := p_habit_id::text || ':' || p_date::text;

  select id into v_existing
  from public.xp_events
  where user_id = v_user_id
    and source_type = 'habit'
    and source_id = v_source_id
  limit 1;

  if v_existing is not null then
    select coalesce(p.total_xp, 0) into v_current_total_xp
    from public.profiles p where p.id = v_user_id;
    select coalesce(cs.coins, 0) into v_current_coins
    from public.city_states cs where cs.user_id = v_user_id;
    total_xp := coalesce(v_current_total_xp, 0);
    coins := coalesce(v_current_coins, 0);
    awarded := false;
    return next;
    return;
  end if;

  update public.profiles p
  set total_xp = coalesce(p.total_xp, 0) + p_xp,
      updated_at = now()
  where p.id = v_user_id
  returning p.total_xp into v_current_total_xp;

  insert into public.city_states (user_id, coins)
  values (v_user_id, v_reward_coins)
  on conflict (user_id) do update
  set coins = public.city_states.coins + excluded.coins,
      updated_at = now()
  returning public.city_states.coins into v_current_coins;

  insert into public.xp_events (user_id, source_type, source_id, xp_amount, description, skill_category)
  values (v_user_id, 'habit', v_source_id, p_xp, 'Habit check-in', p_skill_category);

  total_xp := v_current_total_xp;
  coins := v_current_coins;
  awarded := true;
  return next;
end;
$$;

create or replace function public.undo_habit_check_in_reward(
  p_habit_id uuid,
  p_date date
)
returns table(total_xp integer, coins integer, reversed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_id text;
  v_xp_amount integer;
  v_reward_coins integer := 3;
  v_current_total_xp integer;
  v_current_coins integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_source_id := p_habit_id::text || ':' || p_date::text;

  delete from public.xp_events
  where user_id = v_user_id
    and source_type = 'habit'
    and source_id = v_source_id
  returning xp_amount into v_xp_amount;

  if v_xp_amount is null then
    select coalesce(p.total_xp, 0) into v_current_total_xp
    from public.profiles p where p.id = v_user_id;
    select coalesce(cs.coins, 0) into v_current_coins
    from public.city_states cs where cs.user_id = v_user_id;
    total_xp := coalesce(v_current_total_xp, 0);
    coins := coalesce(v_current_coins, 0);
    reversed := false;
    return next;
    return;
  end if;

  update public.profiles p
  set total_xp = greatest(0, coalesce(p.total_xp, 0) - v_xp_amount),
      updated_at = now()
  where p.id = v_user_id
  returning p.total_xp into v_current_total_xp;

  update public.city_states cs
  set coins = greatest(0, coalesce(cs.coins, 0) - v_reward_coins),
      updated_at = now()
  where cs.user_id = v_user_id
  returning cs.coins into v_current_coins;

  total_xp := v_current_total_xp;
  coins := coalesce(v_current_coins, 0);
  reversed := true;
  return next;
end;
$$;

grant execute on function public.check_in_habit_reward(uuid, date, integer, public.skill_category) to authenticated;
grant execute on function public.undo_habit_check_in_reward(uuid, date) to authenticated;
```

Note: the coin amount clawed back is always the current flat constant (3), not necessarily what was originally granted — this is an accepted v1 simplification documented in the spec (the alternative would require a coin-amount column on `xp_events`, which is unnecessary complexity while the per-check-in coin amount is a fixed constant).

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db push` (or this repo's established migration-apply command).
Expected: both functions created with no errors.

- [ ] **Step 5: Write the implementation module**

Create `src/lib/habit-xp.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SkillCategory } from "./skill-categories";

const BASE_XP = 10;
const BASE_COINS = 3;
const MULTIPLIER_STEP = 0.02;
const MAX_MULTIPLIER = 2.0;

export function calculateHabitCheckInXp(streakDays: number): {
  xp: number;
  coins: number;
} {
  const multiplier = Math.min(MAX_MULTIPLIER, 1 + streakDays * MULTIPLIER_STEP);
  return {
    xp: Math.round(BASE_XP * multiplier),
    coins: BASE_COINS,
  };
}

export interface CheckInHabitRewardResult {
  totalXp: number;
  coins: number;
  awarded: boolean;
}

export async function checkInHabitReward(
  supabase: SupabaseClient,
  params: {
    habitId: string;
    date: string;
    xp: number;
    skillCategory: SkillCategory | null;
  }
): Promise<CheckInHabitRewardResult> {
  const { data, error } = await supabase.rpc("check_in_habit_reward", {
    p_habit_id: params.habitId,
    p_date: params.date,
    p_xp: params.xp,
    p_skill_category: params.skillCategory,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalXp: row.total_xp,
    coins: row.coins,
    awarded: row.awarded,
  };
}

export interface UndoHabitCheckInRewardResult {
  totalXp: number;
  coins: number;
  reversed: boolean;
}

export async function undoHabitCheckInReward(
  supabase: SupabaseClient,
  params: { habitId: string; date: string }
): Promise<UndoHabitCheckInRewardResult> {
  const { data, error } = await supabase.rpc("undo_habit_check_in_reward", {
    p_habit_id: params.habitId,
    p_date: params.date,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalXp: row.total_xp,
    coins: row.coins,
    reversed: row.reversed,
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/habit-xp.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/habit-xp.ts src/lib/habit-xp.test.ts`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260827130000_habit_checkin_rewards.sql src/lib/habit-xp.ts src/lib/habit-xp.test.ts
git commit -m "feat(gamification): add habit check-in reward RPCs and streak-multiplier formula"
```

---

## Task 3: Wire habit check-in XP into `HabitManager`

**Files:**
- Modify: `src/components/habits/HabitManager.tsx:170-228` (`saveCompletion`)

**Interfaces:**
- Consumes: `calculateHabitCheckInXp`, `checkInHabitReward`, `undoHabitCheckInReward` from `@/lib/habit-xp` (Task 2); `buildHabitSummary` from `@/lib/habit-manager` (already imported in this file); the Zustand `addXp`/`setCoins` actions from `@/lib/stores/user-store` (need to add this import — check the store's exact export name before writing the import, it's a hook like `useUserStore`).

This task has no new automated test of its own — the business logic it calls (`calculateHabitCheckInXp`, the RPC wrappers) is already fully unit-tested in Task 2. This task is integration wiring, verified by the manual browser check in Step 4.

- [ ] **Step 1: Read the current `useUserStore` import convention**

Before editing, check how another habit-adjacent component (or `HabitManager.tsx` itself) imports the user store, so the new import matches this codebase's exact convention (e.g. `import { useUserStore } from "@/lib/stores/user-store"`). Confirm the store's `addXp`/`setCoins` action signatures match `addXp(amount: number, previousTotalXp?: number)` / `setCoins(coins: number)` (both already used elsewhere in this codebase for other reward paths).

- [ ] **Step 2: Add the imports**

In `src/components/habits/HabitManager.tsx`, add to the existing import block:

```ts
import { calculateHabitCheckInXp, checkInHabitReward, undoHabitCheckInReward } from "@/lib/habit-xp";
import { useUserStore } from "@/lib/stores/user-store";
```

Inside the component function body (near other hook calls at the top of the component), add:

```ts
const addXp = useUserStore((state) => state.addXp);
const setCoins = useUserStore((state) => state.setCoins);
```

- [ ] **Step 3: Update `saveCompletion` to grant/claw back XP on the completion transition**

Replace the current `try` block inside `saveCompletion` (currently lines 199-213):

```ts
    try {
      const savedLog = await setHabitLogCompletion(supabase, {
        existingLog: previousLog,
        userId,
        habitId: habit.id,
        date,
        completed,
      });
      setLogs((current) => [
        ...current.filter(
          (log) => !(log.habit_id === habit.id && log.log_date === date)
        ),
        savedLog,
      ]);
      notifyUpdated();
    } catch (error) {
```

with:

```ts
    try {
      const savedLog = await setHabitLogCompletion(supabase, {
        existingLog: previousLog,
        userId,
        habitId: habit.id,
        date,
        completed,
      });
      setLogs((current) => [
        ...current.filter(
          (log) => !(log.habit_id === habit.id && log.log_date === date)
        ),
        savedLog,
      ]);

      const wasCompleted = previousLog?.completed ?? false;
      if (completed && !wasCompleted) {
        const summary = buildHabitSummary(habit, [
          ...logs.filter((log) => log.habit_id === habit.id),
          savedLog,
        ]);
        const { xp, coins } = calculateHabitCheckInXp(summary.currentStreak);
        const result = await checkInHabitReward(supabase, {
          habitId: habit.id,
          date,
          xp,
          skillCategory: habit.skill_category ?? null,
        });
        if (result.awarded) {
          addXp(xp, result.totalXp - xp);
          setCoins(result.coins);
        }
      } else if (!completed && wasCompleted) {
        const result = await undoHabitCheckInReward(supabase, {
          habitId: habit.id,
          date,
        });
        if (result.reversed) {
          setCoins(result.coins);
          addXp(0, result.totalXp);
        }
      }

      notifyUpdated();
    } catch (error) {
```

`addXp(0, result.totalXp)` on the clawback path sets the store's `totalXp` to the authoritative post-clawback value (an `addXp` of `0` on top of the explicit `previousTotalXp` override) without needing a separate "setXp" action — this matches how `addXp`'s existing `previousTotalXp?` parameter is designed to be used when the caller already knows the server's authoritative total (see its use elsewhere in this codebase for the same reason on other reward paths).

Note: `habit.skill_category` requires the `Habit` type to have this field (Task 4 adds it) — if Task 4 has not landed yet when this task runs, add `skill_category: null` as a temporary literal here and revisit in Task 4's own step; if Task 4 already landed first, use `habit.skill_category ?? null` directly as shown above. Confirm the actual task order at implementation time (Task 4 is listed after this task in this plan, so implement this step with the temporary `null` literal, then Task 4 must come back and change it to `habit.skill_category ?? null` as part of its own wiring step — Task 4 includes this exact follow-up edit explicitly, see Task 4 Step 5 below).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open `/habits`, and:
1. Check an untagged habit for today — confirm no console errors, and (via the Supabase dashboard or a quick `select * from xp_events order by created_at desc limit 5`) confirm one new `xp_events` row with `source_type = 'habit'`, `xp_amount = 10`, `skill_category = null`.
2. Uncheck it — confirm the `xp_events` row is gone and `profiles.total_xp` / `city_states.coins` dropped back by the same amounts.
3. Check it again — confirm exactly one new row is created (not a duplicate), and the dashboard's XP/level display updates.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/habits/HabitManager.tsx`
Expected: no errors (a `habit.skill_category` typecheck error is expected and correct at this point if Task 4 hasn't landed yet — resolve by using the temporary `null` literal from Step 3 until Task 4 lands).

- [ ] **Step 6: Commit**

```bash
git add src/components/habits/HabitManager.tsx
git commit -m "feat(habits): grant streak-scaled XP and coins on habit check-in"
```

---

## Task 4: Skill picker on the habit creation/edit form

**Files:**
- Modify: `src/lib/types.ts` (`Habit` interface)
- Modify: `src/lib/habits.ts` (`createHabit`, `updateHabit`)
- Modify: `src/components/habits/HabitEditorDialog.tsx`
- Modify: `src/components/habits/HabitManager.tsx` (`handleEditorSubmit`, and the Task 3 follow-up noted above)

**Interfaces:**
- Consumes: `SkillCategory`, `SKILL_CATEGORIES` from `@/lib/skill-categories` (Task 1).
- Produces: `Habit.skill_category: SkillCategory | null`; `HabitEditorValue.skillCategory: SkillCategory | null`. Task 3's temporary `null` literal (if still present) gets replaced here.

- [ ] **Step 1: Add `skill_category` to the `Habit` type**

In `src/lib/types.ts`, find the `Habit` interface (currently):

```ts
export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
}
```

Add one field:

```ts
export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  skill_category: SkillCategory | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
}
```

Add the import at the top of `src/lib/types.ts`: `import type { SkillCategory } from "./skill-categories";`

- [ ] **Step 2: Thread `skill_category` through `createHabit`/`updateHabit`**

In `src/lib/habits.ts`, update `createHabit`'s signature and insert call (currently lines 48-78):

```ts
export async function createHabit(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string;
    emoji?: string;
    color?: string;
    sortOrder?: number;
    skillCategory?: SkillCategory | null;
  }
): Promise<Habit> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const { data: existing, error: existingError } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .ilike("name", name)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) throw new DuplicateHabitError();

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name,
      emoji: input.emoji ?? "✅",
      color: input.color ?? "blue",
      sort_order: input.sortOrder,
      skill_category: input.skillCategory ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Habit;
}
```

Update `updateHabit`'s `patch` type (currently lines 80-89) to allow `skill_category`:

```ts
export async function updateHabit(
  supabase: SupabaseClient,
  habitId: string,
  patch: Partial<
    Pick<
      Habit,
      "name" | "emoji" | "color" | "skill_category" | "is_archived" | "sort_order"
    >
  >
) {
  const { error } = await supabase.from("habits").update(patch).eq("id", habitId);
  if (error) throw error;
}
```

Add `import type { SkillCategory } from "./skill-categories";` to `src/lib/habits.ts` if not already present transitively.

- [ ] **Step 3: Add the skill picker to `HabitEditorDialog`**

In `src/components/habits/HabitEditorDialog.tsx`, add the import: `import { SKILL_CATEGORIES } from "@/lib/skill-categories";` and `import type { SkillCategory } from "@/lib/skill-categories";`.

Update `HabitEditorValue` (currently lines 36-40):

```ts
export interface HabitEditorValue {
  name: string;
  emoji: string;
  color: string;
  skillCategory: SkillCategory | null;
}
```

In `HabitEditorForm`, add state (alongside the existing `name`/`emoji`/`color` state at lines 104-106):

```ts
  const [skillCategory, setSkillCategory] = useState<SkillCategory | null>(
    habit?.skill_category ?? null
  );
```

Update `handleSubmit` (currently lines 108-112) to include it:

```ts
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    void onSubmit({ name, emoji, color, skillCategory });
  }
```

Add a new fieldset directly after the existing color `fieldset` (currently ending at line 160), before the "Daily" info block:

```tsx
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-sm font-medium">Skill (optional)</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Habit skill category">
              {SKILL_CATEGORIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={skillCategory === option.id}
                  onClick={() =>
                    setSkillCategory(skillCategory === option.id ? null : option.id)
                  }
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    skillCategory === option.id
                      ? "border-foreground/30 bg-muted"
                      : "border-border/60 hover:bg-muted/50"
                  )}
                >
                  <span aria-hidden="true">{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
```

Tapping the already-selected chip clears the selection (toggles back to `null`) — this is the only way to remove a previously-set skill, since there's no separate "None" chip.

- [ ] **Step 4: Write a test for the skill picker's toggle behavior**

Create `src/components/habits/HabitEditorDialog.test.tsx` (no test file exists for this component today):

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HabitEditorDialog } from "./HabitEditorDialog";

afterEach(cleanup);

describe("HabitEditorDialog skill picker", () => {
  it("includes the chosen skill category in the submitted value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <HabitEditorDialog
        open
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText("Name"), "Morning run");
    await user.click(screen.getByRole("radio", { name: /physical health/i }));
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Morning run",
      emoji: "✅",
      color: "blue",
      skillCategory: "physical_health",
    });
  });

  it("defaults to no skill category when nothing is selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <HabitEditorDialog
        open
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText("Name"), "Read");
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ skillCategory: null })
    );
  });

  it("toggles a selected skill chip back off when tapped again", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <HabitEditorDialog
        open
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText("Name"), "Meditate");
    const focusChip = screen.getByRole("radio", { name: /focus/i });
    await user.click(focusChip);
    await user.click(focusChip);
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ skillCategory: null })
    );
  });
});
```

- [ ] **Step 5: Run test to verify it fails, then passes**

Run: `npx vitest run src/components/habits/HabitEditorDialog.test.tsx`
Expected first: FAIL (component doesn't yet submit `skillCategory`). After completing Step 3's edits: PASS (3 tests).

- [ ] **Step 6: Wire the picker's value through `HabitManager`'s `handleEditorSubmit`**

In `src/components/habits/HabitManager.tsx`, update `handleEditorSubmit` (currently lines 230-278):

```ts
      if (editingHabit) {
        const next = {
          ...editingHabit,
          name: value.name.trim().replace(/\s+/g, " "),
          emoji: value.emoji,
          color: value.color,
          skill_category: value.skillCategory,
        };
        const transaction = patchHabitOptimistically(habits, next.id, next);
        setHabits(transaction.next);
        try {
          await updateHabit(supabase, editingHabit.id, {
            name: next.name,
            emoji: next.emoji,
            color: next.color,
            skill_category: next.skill_category,
          });
        } catch (error) {
          setHabits(transaction.rollback);
          throw error;
        }
      } else {
        const created = await createHabit(supabase, userId, {
          ...value,
          skillCategory: value.skillCategory,
          sortOrder: activeHabits.length,
        });
        setHabits((current) => [...current, created]);
      }
```

Also apply Task 3's noted follow-up now: in `saveCompletion` (Task 3, Step 3), change the temporary `skillCategory: null` literal to `skillCategory: habit.skill_category ?? null`.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/types.ts src/lib/habits.ts src/components/habits/HabitEditorDialog.tsx src/components/habits/HabitEditorDialog.test.tsx src/components/habits/HabitManager.tsx`
Expected: no errors.

- [ ] **Step 8: Run the full habits test suite**

Run: `npx vitest run src/lib/habits.test.ts src/components/habits/HabitEditorDialog.test.tsx src/components/habits/HabitManager.test.tsx`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/habits.ts src/components/habits/HabitEditorDialog.tsx src/components/habits/HabitEditorDialog.test.tsx src/components/habits/HabitManager.tsx
git commit -m "feat(habits): add an optional skill-category picker to the habit editor"
```

---

## Task 5: Skill picker on the custom-quest creation form

**Files:**
- Modify: `src/lib/quests.ts` (`CustomQuest` interface, `createCustomQuest`)
- Modify: `src/components/quests/QuestPageClient.tsx`

**Interfaces:**
- Consumes: `SkillCategory`, `SKILL_CATEGORIES` from `@/lib/skill-categories` (Task 1).
- Produces: `CustomQuest.skill_category: SkillCategory | null`; `createCustomQuest`'s `data` param gains an optional `skill_category`.

- [ ] **Step 1: Add `skill_category` to `CustomQuest` and `createCustomQuest`**

In `src/lib/quests.ts`, update the `CustomQuest` interface (currently lines 88-104):

```ts
export interface CustomQuest {
  id: string
  user_id: string
  title: string
  description: string | null
  xp_reward: number
  coin_reward: number
  quest_type: 'single' | 'daily_challenge'
  challenge_days: number | null
  challenge_task: string | null
  challenge_start_date: string | null
  skill_category: SkillCategory | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
  daily_logs?: QuestDailyLog[]
}
```

Add `import type { SkillCategory } from './skill-categories'` near the top of `src/lib/quests.ts`.

Update `createCustomQuest`'s `data` parameter type (currently lines 402-415) to include `skill_category?: SkillCategory | null` alongside the existing fields — the insert body already spreads `...data`, so no further change is needed there:

```ts
export async function createCustomQuest(
  supabase: SupabaseClient,
  userId: string,
  data: {
    title: string
    description: string
    xp_reward: number
    coin_reward: number
    quest_type?: 'single' | 'daily_challenge'
    challenge_days?: number | null
    challenge_task?: string | null
    challenge_start_date?: string | null
    skill_category?: SkillCategory | null
  }
): Promise<CustomQuest> {
```

- [ ] **Step 2: Add form state and the skill picker to `QuestPageClient`**

In `src/components/quests/QuestPageClient.tsx`, add the import: `import { SKILL_CATEGORIES, type SkillCategory } from '@/lib/skill-categories'`.

Add state alongside the existing form state (currently lines 78-81):

```ts
  const [formSkillCategory, setFormSkillCategory] = useState<SkillCategory | null>(null)
```

Update `handleCreate` (currently lines 191-208) to pass it through and reset it:

```ts
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim()) return
    setCreating(true)
    try {
      const newQuest = await createCustomQuest(supabase, userId, {
        title: formTitle.trim(),
        description: formDesc.trim() || '',
        xp_reward: formXp,
        coin_reward: formCoins,
        skill_category: formSkillCategory,
      })
      setCustomQuests((prev) => [newQuest, ...prev])
      setFormTitle('')
      setFormDesc('')
      setFormXp(50)
      setFormCoins(20)
      setFormSkillCategory(null)
      setShowForm(false)
    } finally {
```

Add the picker to the form JSX, directly after the XP/Coin Reward `grid` block (currently ending at line 368, before the Cancel/Create buttons' `flex gap-2` div at line 369):

```tsx
              <div className="space-y-1.5">
                <Label>Skill (optional)</Label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quest skill category">
                  {SKILL_CATEGORIES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={formSkillCategory === option.id}
                      onClick={() =>
                        setFormSkillCategory(
                          formSkillCategory === option.id ? null : option.id
                        )
                      }
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-medium transition-colors ${
                        formSkillCategory === option.id
                          ? 'border-foreground/30 bg-muted'
                          : 'border-border/60 hover:bg-muted/50'
                      }`}
                    >
                      <span aria-hidden="true">{option.emoji}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open `/quests`, go to the My Quests tab, click "Create Quest", select a skill chip, and create the quest. Confirm (via the Supabase dashboard) the new `quests` row has the expected `skill_category` value.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/quests.ts src/components/quests/QuestPageClient.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/quests.ts src/components/quests/QuestPageClient.tsx
git commit -m "feat(quests): add an optional skill-category picker to custom quest creation"
```

---

## Task 6: Pre-tag the quest-idea picker with skill categories

**Files:**
- Modify: `src/lib/quest-ideas.ts`
- Modify: `src/components/quests/QuestPageClient.tsx` (`handleAddIdea`)

**Interfaces:**
- Consumes: `SkillCategory` from `@/lib/skill-categories` (Task 1); `createCustomQuest`'s new `skill_category` param (Task 5).
- Produces: `skillCategoryForQuestIdeaCategory(category: QuestIdeaCategory): SkillCategory`, a pure mapping function.

- [ ] **Step 1: Write the failing test for the mapping function**

Create `src/lib/quest-ideas.test.ts` additions — append to the existing test file (do not replace it; the existing tests for `QUEST_IDEAS`/`QUEST_IDEA_CATEGORIES` stay as they are):

```ts
import { skillCategoryForQuestIdeaCategory } from "./quest-ideas";

describe("skillCategoryForQuestIdeaCategory", () => {
  it("maps each quest-idea category to the expected skill category", () => {
    expect(skillCategoryForQuestIdeaCategory("Skills & Learning")).toBe("learning");
    expect(skillCategoryForQuestIdeaCategory("Creative & Technical")).toBe("focus");
    expect(skillCategoryForQuestIdeaCategory("Adventure & Travel")).toBe("mental_health");
    expect(skillCategoryForQuestIdeaCategory("Health & Fitness")).toBe("physical_health");
    expect(skillCategoryForQuestIdeaCategory("Money & Career")).toBe("career");
    expect(skillCategoryForQuestIdeaCategory("Relationships & Community")).toBe("relationships");
  });

  it("covers every category in QUEST_IDEA_CATEGORIES with no gaps", () => {
    for (const category of QUEST_IDEA_CATEGORIES) {
      expect(() => skillCategoryForQuestIdeaCategory(category)).not.toThrow();
    }
  });
});
```

(Add `QUEST_IDEA_CATEGORIES` to this test file's existing import from `./quest-ideas` if it isn't already imported there.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quest-ideas.test.ts`
Expected: FAIL — `skillCategoryForQuestIdeaCategory` is not exported.

- [ ] **Step 3: Add the mapping function**

In `src/lib/quest-ideas.ts`, add the import `import type { SkillCategory } from "./skill-categories";` and append (near the bottom of the file, after `QUEST_IDEAS`):

```ts
const QUEST_IDEA_CATEGORY_TO_SKILL: Record<QuestIdeaCategory, SkillCategory> = {
  "Skills & Learning": "learning",
  "Creative & Technical": "focus",
  "Adventure & Travel": "mental_health",
  "Health & Fitness": "physical_health",
  "Money & Career": "career",
  "Relationships & Community": "relationships",
};

export function skillCategoryForQuestIdeaCategory(
  category: QuestIdeaCategory
): SkillCategory {
  return QUEST_IDEA_CATEGORY_TO_SKILL[category];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/quest-ideas.test.ts`
Expected: PASS (all existing tests plus the 2 new ones)

- [ ] **Step 5: Wire it into `handleAddIdea`**

In `src/components/quests/QuestPageClient.tsx`, add the import `skillCategoryForQuestIdeaCategory` to the existing `@/lib/quest-ideas` import, and update `handleAddIdea` (currently lines 213-221):

```ts
  async function handleAddIdea(idea: QuestIdea) {
    const newQuest = await createCustomQuest(supabase, userId, {
      title: idea.title,
      description: idea.description,
      xp_reward: idea.xpReward,
      coin_reward: idea.coinReward,
      skill_category: skillCategoryForQuestIdeaCategory(idea.category),
    })
    setCustomQuests((prev) => [newQuest, ...prev])
  }
```

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `/quests`, click "Browse Ideas", add one idea from each of the 6 categories, and confirm (via the Supabase dashboard) each resulting quest row has the expected `skill_category`.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/quest-ideas.ts src/lib/quest-ideas.test.ts src/components/quests/QuestPageClient.tsx`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/quest-ideas.ts src/lib/quest-ideas.test.ts src/components/quests/QuestPageClient.tsx
git commit -m "feat(quests): pre-tag quest-idea picker entries with their skill category"
```

---

## Task 7: Reactivate `/analytics` with a Skills section

**Files:**
- Modify: `src/lib/skill-categories.ts` (add `fetchSkillXpTotals`)
- Test: `src/lib/skill-categories.test.ts` (append)
- Create: `src/components/analytics/SkillLevels.tsx`
- Test: `src/components/analytics/SkillLevels.test.tsx`
- Modify: `src/app/(app)/analytics/page.tsx`

**Interfaces:**
- Consumes: `SKILL_CATEGORIES`, `SkillCategory` (Task 1); `getLevel`, `getXpProgress` from `@/lib/gamification` (pre-existing).
- Produces: `fetchSkillXpTotals(supabase: SupabaseClient, userId: string): Promise<Record<SkillCategory, number>>`; `SkillLevels({ totals }: { totals: Record<SkillCategory, number> })` component.

- [ ] **Step 1: Write the failing test for `fetchSkillXpTotals`**

Append to `src/lib/skill-categories.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSkillXpTotals } from "./skill-categories";

describe("fetchSkillXpTotals", () => {
  it("sums xp_amount per skill_category and defaults untouched categories to 0", async () => {
    const rows = [
      { skill_category: "physical_health", xp_amount: 10 },
      { skill_category: "physical_health", xp_amount: 15 },
      { skill_category: "focus", xp_amount: 20 },
      { skill_category: null, xp_amount: 5 },
    ];
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: rows, error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const totals = await fetchSkillXpTotals(client, "user-1");

    expect(totals).toEqual({
      physical_health: 25,
      mental_health: 0,
      focus: 20,
      learning: 0,
      relationships: 0,
      career: 0,
    });
  });

  it("throws when the query errors", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: new Error("boom") }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(fetchSkillXpTotals(client, "user-1")).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/skill-categories.test.ts`
Expected: FAIL — `fetchSkillXpTotals` is not exported.

- [ ] **Step 3: Implement `fetchSkillXpTotals`**

Append to `src/lib/skill-categories.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchSkillXpTotals(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<SkillCategory, number>> {
  const totals = Object.fromEntries(
    SKILL_CATEGORIES.map((category) => [category.id, 0])
  ) as Record<SkillCategory, number>;

  const { data, error } = await supabase
    .from("xp_events")
    .select("skill_category, xp_amount")
    .eq("user_id", userId);
  if (error) throw error;

  for (const row of data ?? []) {
    const category = row.skill_category as SkillCategory | null;
    if (category && category in totals) {
      totals[category] += row.xp_amount as number;
    }
  }

  return totals;
}
```

(Move the `import type { SupabaseClient } from "@supabase/supabase-js";` to the top of the file alongside the other imports, rather than inline, if this codebase's convention keeps all imports at the top — check the file's current top section before placing it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/skill-categories.test.ts`
Expected: PASS (all tests, including the 6 from Task 1 and the 2 new ones)

- [ ] **Step 5: Write the failing test for `SkillLevels`**

Create `src/components/analytics/SkillLevels.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLevels } from "./SkillLevels";
import type { SkillCategory } from "@/lib/skill-categories";

afterEach(cleanup);

describe("SkillLevels", () => {
  it("renders all 6 categories, including ones with zero XP", () => {
    const totals: Record<SkillCategory, number> = {
      physical_health: 120,
      mental_health: 0,
      focus: 45,
      learning: 0,
      relationships: 0,
      career: 0,
    };
    render(<SkillLevels totals={totals} />);

    expect(screen.getByText("Physical Health")).toBeTruthy();
    expect(screen.getByText("Mental Health")).toBeTruthy();
    expect(screen.getByText("Focus")).toBeTruthy();
    expect(screen.getByText("Learning")).toBeTruthy();
    expect(screen.getByText("Relationships")).toBeTruthy();
    expect(screen.getByText("Career")).toBeTruthy();
  });

  it("shows level 1 for a category with zero XP", () => {
    const totals: Record<SkillCategory, number> = {
      physical_health: 0,
      mental_health: 0,
      focus: 0,
      learning: 0,
      relationships: 0,
      career: 0,
    };
    render(<SkillLevels totals={totals} />);
    const levelLabels = screen.getAllByText(/level 1/i);
    expect(levelLabels.length).toBe(6);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/analytics/SkillLevels.test.tsx`
Expected: FAIL — `Failed to resolve import "./SkillLevels"`.

- [ ] **Step 7: Implement `SkillLevels`**

Create `src/components/analytics/SkillLevels.tsx`:

```tsx
import { SKILL_CATEGORIES, type SkillCategory } from "@/lib/skill-categories";
import { getLevel, getXpProgress } from "@/lib/gamification";

export function SkillLevels({
  totals,
}: {
  totals: Record<SkillCategory, number>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SKILL_CATEGORIES.map((category) => {
        const xp = totals[category.id] ?? 0;
        const level = getLevel(xp);
        const progress = getXpProgress(xp);
        return (
          <div key={category.id} className="rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-lg">
                {category.emoji}
              </span>
              <span className="font-medium">{category.label}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Level {level}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/components/analytics/SkillLevels.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 9: Reactivate the analytics page and add the Skills tab**

In `src/app/(app)/analytics/page.tsx`:

1. Remove the `redirect('/dashboard')` line (currently line 23) and the now-dead comment above it.
2. Fix the pre-existing bad import: change `import { redirect } from "next/dist/client/components/navigation";` to `import { redirect } from "next/navigation";` — the only remaining use of `redirect` in this file is the legitimate `if (!user) redirect('/login')` guard inside the fetch effect, which should keep working (and now uses the correct public import path).
3. Add the new imports: `import { SkillLevels } from "@/components/analytics/SkillLevels";` and `import { fetchSkillXpTotals, type SkillCategory } from "@/lib/skill-categories";`.
4. Add state and a fetch effect for skill totals, following this file's existing pattern for `entries` (currently lines 25, 37-57):

```ts
  const [skillTotals, setSkillTotals] = useState<Record<SkillCategory, number> | null>(null);
```

```ts
  useEffect(() => {
    async function fetchSkillTotals() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const totals = await fetchSkillXpTotals(supabase, user.id);
        setSkillTotals(totals);
      } catch (error) {
        console.error("Failed to fetch skill XP totals", error);
      }
    }
    fetchSkillTotals();
  }, []);
```

5. Add a new tab. Update the `TabsList` (currently lines 82-86):

```tsx
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mood">Mood</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>
```

Add a new `TabsContent` after the existing `activity` one (currently ending at line 101, before the closing `</Tabs>`):

```tsx
        <TabsContent value="skills">
          {skillTotals ? (
            <SkillLevels totals={skillTotals} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading your skills…</p>
          )}
        </TabsContent>
```

- [ ] **Step 10: Manual verification**

Run `npm run dev`, open `/analytics` directly — confirm it no longer redirects to `/dashboard`, the existing Overview/Mood/Activity tabs still render as before, and the new Skills tab shows all 6 categories (with real levels/progress if you've checked in a tagged habit or added a tagged quest during earlier tasks' manual verification, otherwise all at level 1 / 0%).

- [ ] **Step 11: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/skill-categories.ts src/lib/skill-categories.test.ts src/components/analytics/SkillLevels.tsx src/components/analytics/SkillLevels.test.tsx "src/app/(app)/analytics/page.tsx"`
Expected: no errors.

- [ ] **Step 12: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including every new test file from Tasks 1-7.

- [ ] **Step 13: Commit**

```bash
git add src/lib/skill-categories.ts src/lib/skill-categories.test.ts src/components/analytics/SkillLevels.tsx src/components/analytics/SkillLevels.test.tsx "src/app/(app)/analytics/page.tsx"
git commit -m "feat(analytics): reactivate the analytics page with a per-skill Skills tab"
```

---

## Plan self-review notes

- **Spec coverage:** taxonomy (Task 1), the three nullable schema columns (Task 1), habit check-in XP with streak multiplier and clawback (Tasks 2-3), skill picker on habits and custom quests (Tasks 4-5), quest-idea picker pre-tagging (Task 6), and the Skills UI on `/analytics` (Task 7) are all covered. The spec's "explicitly out of scope" items (journal/task/system-quest tagging, historical backfill, task-XP consolidation) have no corresponding task, as intended.
- **Refinement over the spec's own wording:** the spec described habit-XP granting loosely as "call the existing addXp/setCoins store actions" and "insert one xp_events row," which reads as a plain client-side operation. Research during planning showed every other combined XP+coins reward path in this codebase (`claim_system_quest_reward`, `complete_custom_quest_reward`, `complete_lesson_reward`) is a `security definer` Postgres RPC, not a plain client insert — because coins live on a separate `city_states` table, and updating two tables plus the ledger atomically needs a transaction. Task 2 implements habit check-in rewards as two new RPCs (`check_in_habit_reward`, `undo_habit_check_in_reward`) to match this established, safer pattern instead.
- **Type consistency:** `SkillCategory` (Task 1) is threaded identically through `Habit.skill_category`, `CustomQuest.skill_category`, `xp_events.skill_category` (via the RPC params), `HabitEditorValue.skillCategory`, and `fetchSkillXpTotals`'s return type — same name, same nullability, everywhere. `calculateHabitCheckInXp`'s `{ xp, coins }` return shape matches exactly what `checkInHabitReward` expects as input in Task 3's wiring.
- **Placeholder scan:** no TBD/TODO; the one explicit exception ("if Task 4 has not landed yet... temporary `null` literal") names the exact literal and the exact follow-up step that resolves it, rather than leaving an open-ended gap.

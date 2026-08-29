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

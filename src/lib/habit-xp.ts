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

import { SupabaseClient } from "@supabase/supabase-js";
import type { Goal, GoalCategory, GoalStatus } from "./types";

export const GOAL_CATEGORIES: Record<GoalCategory, string> = {
  personal: "Personal",
  health: "Health",
  career: "Career",
  relationships: "Relationships",
  learning: "Learning",
  finance: "Finance",
  other: "Other",
};

export async function fetchGoals(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: GoalStatus; limit?: number }
): Promise<Goal[]> {
  let query = supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function createGoal(
  supabase: SupabaseClient,
  userId: string,
  input: {
    title: string;
    why?: string | null;
    category?: GoalCategory;
    target_date?: string | null;
  }
): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      why: input.why?.trim() || null,
      category: input.category ?? "personal",
      target_date: input.target_date || null,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Goal;
}

export async function updateGoalStatus(
  supabase: SupabaseClient,
  goalId: string,
  status: GoalStatus
): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goalId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Goal;
}

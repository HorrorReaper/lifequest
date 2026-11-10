import { SupabaseClient } from "@supabase/supabase-js";
import { DayPlan, DayPlanBlock } from "./types";
import { format, addDays } from "date-fns";

export function tomorrowDate(): string {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
}

export function todayDate(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export async function fetchDayPlan(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<DayPlan | null> {
  const { data, error } = await supabase
    .from("day_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_date", date)
    .maybeSingle();
  if (error) throw error;
  return data as DayPlan | null;
}

export async function upsertDayPlan(
  supabase: SupabaseClient,
  userId: string,
  input: {
    plan_date: string;
    blocks: DayPlanBlock[];
    notes?: string | null;
    entry_id?: string | null;
    field_id?: string | null;
  }
): Promise<DayPlan> {
  const row = {
    user_id: userId,
    plan_date: input.plan_date,
    blocks: input.blocks,
    updated_at: new Date().toISOString(),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.entry_id !== undefined ? { entry_id: input.entry_id } : {}),
    ...(input.field_id !== undefined ? { field_id: input.field_id } : {}),
  };

  const { data, error } = await supabase
    .from("day_plans")
    .upsert(
      row,
      { onConflict: "user_id,plan_date" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as DayPlan;
}

/**
 * The tasks a plan has a block for, in block order and without repeats.
 *
 * A block points at a task through `source_type: "task"` and `source_id`.
 * Read by the task list and the dashboard to show "In today's plan" next to
 * a task, and to tell a past block from a finished one.
 */
export function plannedTaskIds(blocks: readonly DayPlanBlock[] | null | undefined): string[] {
  const ids: string[] = [];
  for (const block of blocks ?? []) {
    if (block.source_type === "task" && block.source_id && !ids.includes(block.source_id)) {
      ids.push(block.source_id);
    }
  }
  return ids;
}

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
  const { data, error } = await supabase
    .from("day_plans")
    .upsert(
      {
        user_id: userId,
        plan_date: input.plan_date,
        blocks: input.blocks,
        notes: input.notes ?? null,
        entry_id: input.entry_id ?? null,
        field_id: input.field_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_date" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as DayPlan;
}

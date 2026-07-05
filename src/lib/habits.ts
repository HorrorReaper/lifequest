import { SupabaseClient } from "@supabase/supabase-js";
import { Habit } from "./types";

export async function fetchHabits(
  supabase: SupabaseClient,
  userId: string,
  includeArchived = false
): Promise<Habit[]> {
  let query = supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) query = query.eq("is_archived", false);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Habit[];
}

export async function createHabit(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; emoji?: string; color?: string }
): Promise<Habit> {
  const name = input.name.trim();
  const { data: existing, error: existingError } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .ilike("name", name)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as Habit;

  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name,
      emoji: input.emoji ?? "✅",
      color: input.color ?? "blue",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Habit;
}

export async function updateHabit(
  supabase: SupabaseClient,
  habitId: string,
  patch: Partial<Pick<Habit, "name" | "emoji" | "color" | "is_archived">>
) {
  const { error } = await supabase.from("habits").update(patch).eq("id", habitId);
  if (error) throw error;
}

export async function deleteHabit(supabase: SupabaseClient, habitId: string) {
  const { error } = await supabase.from("habits").delete().eq("id", habitId);
  if (error) throw error;
}

export async function logHabits(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
  date: string,
  completedHabitIds: string[]
) {
  if (completedHabitIds.length === 0) return;
  const rows = completedHabitIds.map((habit_id) => ({
    user_id: userId,
    habit_id,
    entry_id: entryId,
    log_date: date,
    completed: true,
  }));
  // Upsert so re-saving the same day doesn't fail
  const { error } = await supabase
    .from("habit_logs")
    .upsert(rows, { onConflict: "user_id,habit_id,log_date" });
  if (error) throw error;
}

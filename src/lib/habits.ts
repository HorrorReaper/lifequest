import { SupabaseClient } from "@supabase/supabase-js";
import { Habit, HabitLog } from "./types";
import type { SkillCategory } from "./skill-categories";

export class DuplicateHabitError extends Error {
  constructor() {
    super("An active habit with this name already exists.");
    this.name = "DuplicateHabitError";
  }
}

export function normalizeHabitName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function hasDuplicateHabitName(
  habits: Habit[],
  name: string,
  exceptHabitId?: string
) {
  const normalizedName = normalizeHabitName(name);
  return habits.some(
    (habit) =>
      !habit.is_archived &&
      habit.id !== exceptHabitId &&
      normalizeHabitName(habit.name) === normalizedName
  );
}

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
  const { data: linkedLogs, error: linkedLogsError } = await supabase
    .from("habit_logs")
    .select("habit_id")
    .eq("user_id", userId)
    .eq("entry_id", entryId)
    .eq("log_date", date);

  if (linkedLogsError) throw linkedLogsError;

  const completedSet = new Set(completedHabitIds);
  const noLongerCompleted = ((linkedLogs ?? []) as { habit_id: string }[])
    .map((log) => log.habit_id)
    .filter((habitId) => !completedSet.has(habitId));

  if (noLongerCompleted.length > 0) {
    const { error: updateError } = await supabase
      .from("habit_logs")
      .update({ completed: false })
      .eq("user_id", userId)
      .eq("entry_id", entryId)
      .eq("log_date", date)
      .in("habit_id", noLongerCompleted);

    if (updateError) throw updateError;
  }

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

export interface HabitCompletionMutation {
  kind: "update" | "upsert";
  id?: string;
  patch?: Pick<HabitLog, "completed">;
  row?: Omit<HabitLog, "id" | "created_at">;
}

export function planHabitCompletionMutation({
  existingLog,
  userId,
  habitId,
  date,
  completed,
}: {
  existingLog?: HabitLog;
  userId: string;
  habitId: string;
  date: string;
  completed: boolean;
}): HabitCompletionMutation {
  if (existingLog) {
    return {
      kind: "update",
      id: existingLog.id,
      patch: { completed },
    };
  }

  return {
    kind: "upsert",
    row: {
      user_id: userId,
      habit_id: habitId,
      entry_id: null,
      log_date: date,
      completed,
    },
  };
}

export async function setHabitLogCompletion(
  supabase: SupabaseClient,
  input: {
    existingLog?: HabitLog;
    userId: string;
    habitId: string;
    date: string;
    completed: boolean;
  }
): Promise<HabitLog> {
  const mutation = planHabitCompletionMutation(input);

  if (mutation.kind === "update") {
    const { data, error } = await supabase
      .from("habit_logs")
      .update(mutation.patch!)
      .eq("id", mutation.id!)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    if (error) throw error;
    return data as HabitLog;
  }

  const { data, error } = await supabase
    .from("habit_logs")
    .upsert(mutation.row!, { onConflict: "user_id,habit_id,log_date" })
    .select("*")
    .single();

  if (error) throw error;
  return data as HabitLog;
}

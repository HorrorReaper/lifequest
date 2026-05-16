import { SupabaseClient } from "@supabase/supabase-js";
import { Task } from "./types";

export async function fetchTasks(
  supabase: SupabaseClient,
  userId: string,
  options?: { onlyOpen?: boolean; limit?: number }
): Promise<Task[]> {
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("is_completed", { ascending: true })
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (options?.onlyOpen) query = query.eq("is_completed", false);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  input: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    priority?: "low" | "medium" | "high";
  }
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      due_date: input.due_date || null,
      priority: input.priority ?? "medium",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Task;
}

export async function toggleTask(
  supabase: SupabaseClient,
  taskId: string,
  isCompleted: boolean
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Task;
}

export async function deleteTask(supabase: SupabaseClient, taskId: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

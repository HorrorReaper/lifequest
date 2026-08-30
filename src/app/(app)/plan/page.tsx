import { redirect } from "next/navigation";
import { TodayPlanner } from "@/components/planning/TodayPlanner";
import { isAdminUser } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { dateInTimezone } from "@/lib/dates";
import type { DayPlanBlock } from "@/lib/types";

function dateLabel(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

const priorityRank = { high: 0, medium: 1, low: 2 };

export default async function TodayPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("timezone,onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as {
    timezone?: string | null;
    onboarding_complete?: boolean;
  } | null;
  if (!profile?.onboarding_complete) redirect("/onboarding");

  const timezone = profile.timezone ?? "UTC";
  const today = dateInTimezone(new Date(), timezone);

  const [
    tasksResult,
    habitsResult,
    habitLogsResult,
    templatesResult,
    entriesResult,
    planResult,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id,title,due_date,priority,estimate_minutes,created_at,is_completed"
      )
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("habits")
      .select("id,name,emoji")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("habit_logs")
      .select("habit_id")
      .eq("user_id", user.id)
      .eq("log_date", today)
      .eq("completed", true),
    supabase
      .from("journal_templates")
      .select("id,name,icon")
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .eq("is_active", true)
      .order("sort_order")
      .limit(12),
    supabase
      .from("journal_entries")
      .select("template_id")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .eq("is_complete", true),
    supabase
      .from("day_plans")
      .select("blocks,notes")
      .eq("user_id", user.id)
      .eq("plan_date", today)
      .maybeSingle(),
  ]);

  const completedHabitIds = new Set(
    ((habitLogsResult.data ?? []) as { habit_id: string }[]).map(
      (log) => log.habit_id
    )
  );
  const completedTemplateIds = new Set(
    ((entriesResult.data ?? []) as { template_id: string }[]).map(
      (entry) => entry.template_id
    )
  );
  const tasks = (
    (tasksResult.data ?? []) as Array<{
      id: string;
      title: string;
      due_date: string | null;
      priority: "low" | "medium" | "high" | null;
      estimate_minutes: number | null;
      created_at: string;
    }>
  )
    .map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.due_date,
      priority: task.priority ?? ("medium" as const),
      isOverdue: task.due_date !== null && task.due_date < today,
      estimateMinutes: task.estimate_minutes,
    }))
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return priorityRank[a.priority] - priorityRank[b.priority];
    });
  const habits = (
    (habitsResult.data ?? []) as Array<{
      id: string;
      name: string;
      emoji: string | null;
    }>
  ).map((habit) => ({
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji ?? "✅",
    completedToday: completedHabitIds.has(habit.id),
  }));
  const journals = (
    (templatesResult.data ?? []) as Array<{
      id: string;
      name: string;
      icon: string | null;
    }>
  ).map((template) => ({
    id: template.id,
    name: template.name,
    icon: template.icon ?? "📓",
    completedToday: completedTemplateIds.has(template.id),
  }));
  const plan = planResult.data as {
    blocks?: DayPlanBlock[];
    notes?: string | null;
  } | null;

  return (
    <TodayPlanner
      userId={user.id}
      date={today}
      dateLabel={dateLabel(timezone)}
      initialBlocks={Array.isArray(plan?.blocks) ? plan.blocks : []}
      initialNotes={plan?.notes ?? null}
      tasks={tasks}
      habits={habits}
      journals={journals}
      workoutsEnabled={isAdminUser(user)}
    />
  );
}


import type { Habit, HabitLog } from "@/lib/types";
import { buildHabitAnalytics } from "@/lib/habit-analytics";
import { addDays, dateInTimezone } from "@/lib/dates";

export function buildDateWindow(endDate: string, length: number) {
  return Array.from({ length }, (_, index) =>
    addDays(endDate, index - (length - 1))
  );
}

export function habitLogKey(habitId: string, date: string) {
  return `${habitId}:${date}`;
}

export function indexHabitLogs(logs: HabitLog[]) {
  return new Map(logs.map((log) => [habitLogKey(log.habit_id, log.log_date), log]));
}

export function completionDatesForHabit(
  logs: HabitLog[],
  habitId: string
) {
  return logs
    .filter((log) => log.habit_id === habitId && log.completed)
    .map((log) => log.log_date);
}

export function buildHabitSummary({
  habit,
  logs,
  today,
  timezone,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: string;
  timezone: string;
}) {
  const createdDate = dateInTimezone(new Date(habit.created_at), timezone);
  const completionDates = completionDatesForHabit(logs, habit.id);
  const analytics = buildHabitAnalytics({
    completionDates,
    createdDate: createdDate > today ? today : createdDate,
    today,
    period: 30,
  });

  return {
    currentStreak: analytics.currentStreak,
    longestStreak: analytics.longestStreak,
    completionRate: analytics.completionRate,
    completionDates: new Set(completionDates),
  };
}

export function moveHabit(
  habits: Habit[],
  activeHabitId: string,
  overHabitId: string
) {
  const oldIndex = habits.findIndex((habit) => habit.id === activeHabitId);
  const newIndex = habits.findIndex((habit) => habit.id === overHabitId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return habits;

  const next = habits.slice();
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);
  return next.map((habit, index) => ({ ...habit, sort_order: index }));
}

export function moveHabitByOffset(
  habits: Habit[],
  habitId: string,
  offset: -1 | 1
) {
  const index = habits.findIndex((habit) => habit.id === habitId);
  const targetIndex = index + offset;
  if (index < 0 || targetIndex < 0 || targetIndex >= habits.length) return habits;
  return moveHabit(habits, habitId, habits[targetIndex].id);
}

export function patchHabitOptimistically(
  habits: Habit[],
  habitId: string,
  patch: Partial<Habit>
) {
  return {
    next: habits.map((habit) =>
      habit.id === habitId ? { ...habit, ...patch } : habit
    ),
    rollback: habits,
  };
}

import type { Habit, HabitLog } from "@/lib/types";
import { buildHabitAnalytics } from "@/lib/habit-analytics";

const DAY_MS = 86_400_000;

function dayNumber(date: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function dateFromDayNumber(value: number) {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, amount: number) {
  return dateFromDayNumber(dayNumber(date) + amount);
}

export function dateInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDateOnly(
  date: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...options,
  });
}

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

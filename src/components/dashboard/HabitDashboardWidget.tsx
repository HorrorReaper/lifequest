"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronRight,
  Flame,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createHabit,
  fetchHabits,
  setHabitLogCompletion,
} from "@/lib/habits";
import { habitLogKey, indexHabitLogs } from "@/lib/habit-manager";
import type { Habit, HabitLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HabitEditorDialog,
  habitColorClass,
  type HabitEditorValue,
} from "@/components/habits/HabitEditorDialog";

interface HabitDashboardWidgetProps {
  userId: string;
  initiallyOpen?: boolean;
  todayDate?: string;
}

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function HabitDashboardWidget({
  userId,
  initiallyOpen = false,
  todayDate,
}: HabitDashboardWidgetProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const today = todayDate ?? localDate();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(initiallyOpen);
  const [creating, setCreating] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [failure, setFailure] = useState<{
    message: string;
    retry?: () => void | Promise<void>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const [habitRows, logResult] = await Promise.all([
        fetchHabits(supabase, userId),
        supabase
          .from("habit_logs")
          .select("*")
          .eq("user_id", userId)
          .eq("log_date", today),
      ]);
      if (logResult.error) throw logResult.error;
      setHabits(habitRows);
      setLogs((logResult.data ?? []) as HabitLog[]);
    } catch (error) {
      setFailure({
        message: errorMessage(error, "Could not load today's habits."),
        retry: load,
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, today, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const logIndex = useMemo(() => indexHabitLogs(logs), [logs]);
  const doneCount = habits.filter(
    (habit) => logIndex.get(habitLogKey(habit.id, today))?.completed
  ).length;

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent("lifequest-data-updated"));
    router.refresh();
  }

  async function saveCompletion(
    habit: Habit,
    completed: boolean,
    previousLog?: HabitLog
  ) {
    if (busyIds.has(habit.id)) return;
    const optimistic: HabitLog = previousLog
      ? { ...previousLog, completed }
      : {
          id: `optimistic-${habit.id}`,
          user_id: userId,
          habit_id: habit.id,
          entry_id: null,
          log_date: today,
          completed,
          created_at: new Date().toISOString(),
        };
    setBusyIds((current) => new Set(current).add(habit.id));
    setFailure(null);
    setLogs((current) => [
      ...current.filter((log) => log.habit_id !== habit.id),
      optimistic,
    ]);
    try {
      const saved = await setHabitLogCompletion(supabase, {
        existingLog: previousLog,
        userId,
        habitId: habit.id,
        date: today,
        completed,
      });
      setLogs((current) => [
        ...current.filter((log) => log.habit_id !== habit.id),
        saved,
      ]);
      notifyUpdated();
    } catch (error) {
      setLogs((current) => {
        const next = current.filter((log) => log.habit_id !== habit.id);
        return previousLog ? [...next, previousLog] : next;
      });
      setFailure({
        message: errorMessage(error, `Could not update ${habit.name}.`),
        retry: () => saveCompletion(habit, completed, previousLog),
      });
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(habit.id);
        return next;
      });
    }
  }

  async function handleCreate(value: HabitEditorValue) {
    if (creating) return;
    setCreating(true);
    setFailure(null);
    try {
      const habit = await createHabit(supabase, userId, {
        ...value,
        sortOrder: habits.length,
      });
      setHabits((current) => [...current, habit]);
      setEditorOpen(false);
      notifyUpdated();
    } catch (error) {
      setFailure({
        message: errorMessage(error, "Could not create this habit."),
        retry: () => handleCreate(value),
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-background/60 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-orange-500" />
            <h2 className="text-sm font-semibold">Today&apos;s habits</h2>
          </div>
          {!loading && habits.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {doneCount} of {habits.length} completed
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setEditorOpen(true)}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {failure && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <span className="flex gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {failure.message}
          </span>
          {failure.retry && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setFailure(null);
                void failure.retry?.();
              }}
            >
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading…
        </div>
      ) : habits.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-center">
          <p className="text-sm font-medium">No habits yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add one daily behavior to begin.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const existingLog = logIndex.get(habitLogKey(habit.id, today));
            const completed = existingLog?.completed ?? false;
            const busy = busyIds.has(habit.id);
            return (
              <li
                key={habit.id}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                  completed && "bg-muted/40"
                )}
              >
                <Checkbox
                  checked={completed}
                  disabled={busy}
                  onCheckedChange={() =>
                    void saveCompletion(habit, !completed, existingLog)
                  }
                  aria-label={`Mark ${habit.name} ${completed ? "incomplete" : "complete"}`}
                />
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg text-sm text-white",
                    habitColorClass(habit.color)
                  )}
                >
                  {habit.emoji}
                </span>
                <Link
                  href={`/habits/${habit.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn("truncate text-sm", completed && "text-muted-foreground")}>
                    {habit.name}
                  </span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link href="/habits">
          Open habit manager
          <ChevronRight className="size-3.5" />
        </Link>
      </Button>

      <HabitEditorDialog
        open={editorOpen}
        busy={creating}
        error={failure?.message}
        onOpenChange={setEditorOpen}
        onSubmit={handleCreate}
      />
    </section>
  );
}

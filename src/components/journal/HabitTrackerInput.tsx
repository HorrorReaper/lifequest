"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Habit } from "@/lib/types";
import { fetchHabits } from "@/lib/habits";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface HabitTrackerInputProps {
  value: string[]; // array of completed habit IDs
  onChange: (ids: string[]) => void;
  config?: {
    selectedHabitIds?: string[]; // chosen in template builder
    showAll?: boolean;
  };
}

export function HabitTrackerInput({ value, onChange, config }: HabitTrackerInputProps) {
  const supabase = useMemo(() => createClient(), []);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const completed = new Set(value ?? []);

  useEffect(() => {
    async function load() {
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        const all = await fetchHabits(supabase, user.id);
        const filtered = config?.showAll
          ? all
          : all.filter((h) => config?.selectedHabitIds?.includes(h.id));
        setHabits(filtered);
      } catch {
        setError("Habits could not be loaded. Your journal draft is unchanged.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [config?.selectedHabitIds, config?.showAll, supabase]);

  function toggle(id: string) {
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading habits...</p>;

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        No habits configured.{" "}
        <Link href="/habits" className="text-primary hover:underline">
          Open the habit manager →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {habits.map((h) => {
        const done = completed.has(h.id);
        return (
          <div
            key={h.id}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl border bg-background/70 p-3 text-left transition-colors",
              done ? "border-primary/35 bg-primary/10" : "border-border/60"
            )}
          >
            <Checkbox
              id={`journal-habit-${h.id}`}
              checked={done}
              onCheckedChange={() => toggle(h.id)}
              aria-label={`Mark ${h.name} ${done ? "incomplete" : "complete"}`}
            />
            <span className="text-xl">{h.emoji}</span>
            <Link
              href={`/habits/${h.id}`}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                done && "text-muted-foreground"
              )}
            >
              <span className="truncate">{h.name}</span>
              <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

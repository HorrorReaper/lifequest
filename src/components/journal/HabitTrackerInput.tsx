"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Habit } from "@/lib/types";
import { fetchHabits } from "@/lib/habits";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface HabitTrackerInputProps {
  value: string[]; // array of completed habit IDs
  onChange: (ids: string[]) => void;
  config?: {
    selectedHabitIds?: string[]; // chosen in template builder
    showAll?: boolean;
  };
}

export function HabitTrackerInput({ value, onChange, config }: HabitTrackerInputProps) {
  const supabase = createClient();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const completed = new Set(value ?? []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const all = await fetchHabits(supabase, user.id);
      const filtered = config?.showAll
        ? all
        : all.filter((h) => config?.selectedHabitIds?.includes(h.id));
      setHabits(filtered);
      setLoading(false);
    }
    load();
  }, []);

  function toggle(id: string) {
    const next = new Set(completed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading habits...</p>;

  if (habits.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
        No habits configured.{" "}
        <Link href="/settings" className="text-primary hover:underline">
          Add some in Settings →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {habits.map((h) => {
        const done = completed.has(h.id);
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => toggle(h.id)}
            className={cn(
              "w-full flex items-center gap-3 rounded-md border p-2.5 text-left transition-colors",
              done ? "bg-primary/10 border-primary/40" : "hover:bg-muted/50"
            )}
          >
            <Checkbox checked={done} onCheckedChange={() => toggle(h.id)} />
            <span className="text-xl">{h.emoji}</span>
            <span className={cn("flex-1 text-sm", done && "line-through text-muted-foreground")}>
              {h.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

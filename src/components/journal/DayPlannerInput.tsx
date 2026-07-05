"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DayPlanBlock } from "@/lib/types";
import { tomorrowDate } from "@/lib/day-plans";

interface DayPlannerValue {
  plan_date: string;
  blocks: DayPlanBlock[];
}

interface DayPlannerInputProps {
  value: DayPlannerValue | null;
  onChange: (value: DayPlannerValue) => void;
  config?: {
    defaultDate?: "tomorrow" | "today";
    startHour?: number;
  };
}

const CATEGORY_META: Record<DayPlanBlock["category"], { label: string; emoji: string; style: string }> = {
  deep_work: { label: "Deep Work", emoji: "🧠", style: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  meeting:   { label: "Meeting",   emoji: "👥", style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  break:     { label: "Break",     emoji: "☕", style: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  personal:  { label: "Personal",  emoji: "🏠", style: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  exercise:  { label: "Exercise",  emoji: "🏋️", style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  other:     { label: "Other",     emoji: "📌", style: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

export function DayPlannerInput({ value, onChange, config }: DayPlannerInputProps) {
  const initialDate = value?.plan_date ?? tomorrowDate();
  const startHour = config?.startHour ?? 9;
  const padHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

  const [planDate, setPlanDate] = useState(initialDate);
  const [start, setStart] = useState(padHour(startHour));
  const [end, setEnd] = useState(padHour(startHour + 1));
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DayPlanBlock["category"]>("deep_work");

  const blocks = value?.blocks ?? [];
  const sortedBlocks = [...blocks].sort((a, b) => a.start_time.localeCompare(b.start_time));

  function emit(nextBlocks: DayPlanBlock[], nextDate = planDate) {
    onChange({ plan_date: nextDate, blocks: nextBlocks });
  }

  function addBlock() {
    if (!title.trim() || start >= end) return;
    const next: DayPlanBlock = {
      id: crypto.randomUUID(),
      start_time: start,
      end_time: end,
      title: title.trim(),
      category,
    };
    emit([...blocks, next]);
    setTitle("");
    // auto-advance
    const [h] = end.split(":").map(Number);
    setStart(end);
    setEnd(padHour(Math.min(h + 1, 23)));
  }

  function removeBlock(id: string) {
    emit(blocks.filter((b) => b.id !== id));
  }

  function changeDate(date: string) {
    setPlanDate(date);
    emit(blocks, date);
  }

  return (
    <div className="space-y-3">
      {/* Date selector */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">Planning for:</label>
        <Input
          type="date"
          value={planDate}
          onChange={(e) => changeDate(e.target.value)}
          className="h-10 w-auto rounded-xl bg-background/80"
        />
      </div>

      {/* Add block form */}
      <div className="space-y-2 rounded-2xl border bg-background/70 p-3">
        <Input
          placeholder="What will you do?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addBlock();
            }
          }}
          className="h-11 rounded-xl bg-background/80"
        />
        <div className="grid gap-2 sm:grid-cols-[6.5rem_auto_6.5rem_1fr_auto]">
          <Input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-10 rounded-xl bg-background/80"
          />
          <span className="hidden self-center text-muted-foreground sm:block">→</span>
          <Input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="h-10 rounded-xl bg-background/80"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as DayPlanBlock["category"])}
            className="flex h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.emoji} {meta.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            onClick={addBlock}
            disabled={!title.trim() || start >= end}
            className="h-10"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Block list */}
      {sortedBlocks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No blocks yet. Add your first time block above.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {sortedBlocks.map((b) => {
            const meta = CATEGORY_META[b.category];
            return (
              <li
                key={b.id}
                className="group flex flex-col gap-2 rounded-xl border bg-background/70 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex w-full items-center gap-1 font-mono text-xs text-muted-foreground sm:w-28">
                  <Clock className="h-3 w-3" />
                  {b.start_time} – {b.end_time}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{b.title}</p>
                </div>
                <Badge variant="outline" className={cn("h-5 w-fit text-xs", meta.style)}>
                  {meta.emoji} {meta.label}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeBlock(b.id)}
                  className="h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Your plan for {planDate} will appear on your dashboard.
      </p>
    </div>
  );
}

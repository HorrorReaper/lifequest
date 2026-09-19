"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, ListTodo, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TodayPlannerTask } from "./TodayPlanner";

interface TaskComboboxProps {
  id?: string;
  ariaLabel: string;
  tasks: TodayPlannerTask[];
  /** The linked task, if the current value still matches one. Used only to
   *  show a checkmark next to the selected option. */
  linkedTaskId: string | null;
  value: string;
  onChangeText: (text: string) => void;
  onSelectTask: (task: TodayPlannerTask) => void;
  onCreateTask: (title: string) => void;
  creating?: boolean;
  placeholder?: string;
  className?: string;
}

const MAX_RESULTS = 6;

/**
 * A single input that both searches existing tasks and creates a new one.
 * Used by all three Today's Plan outcome roles (Must Win, Progress, Health).
 */
export function TaskCombobox({
  id,
  ariaLabel,
  tasks,
  linkedTaskId,
  value,
  onChangeText,
  onSelectTask,
  onCreateTask,
  creating = false,
  placeholder,
  className,
}: TaskComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = query
    ? tasks.filter((task) => task.title.toLowerCase().includes(query))
    : tasks;
  const results = filtered.slice(0, MAX_RESULTS);
  const exactMatch = query
    ? tasks.some((task) => task.title.trim().toLowerCase() === query)
    : true;
  const offerCreate = query.length > 0 && !exactMatch;
  // The create row, when present, is the last item in keyboard navigation.
  const optionCount = results.length + (offerCreate ? 1 : 0);

  // Reset the highlighted option whenever the query or open state changes,
  // via React's render-phase state-adjustment pattern rather than an effect
  // (see https://react.dev/learn/you-might-not-need-an-effect) — this runs
  // synchronously during render and does not cause an extra commit.
  const resetKey = `${value}:${open}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setHighlight(0);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function selectHighlighted() {
    if (highlight < results.length) {
      const task = results[highlight];
      if (task) {
        onSelectTask(task);
        setOpen(false);
      }
      return;
    }
    if (offerCreate) {
      onCreateTask(value.trim());
      setOpen(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, Math.max(optionCount - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (optionCount === 0) return;
      event.preventDefault();
      selectHighlighted();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <ListTodo className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChangeText(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          maxLength={160}
          placeholder={placeholder}
          className={cn("h-12 rounded-xl text-base", className)}
          // Input's own base classes set px-3/sm:px-2.5; overriding just the
          // left side via a pl-* class is not reliable here (tailwind-merge
          // does not consistently treat px-* and pl-* as the same conflict
          // group), so the icon and the "W" of the placeholder ended up
          // overlapping. An inline style always wins on CSS specificity
          // regardless of class merge order.
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>

      {open && optionCount > 0 && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {results.map((task, index) => (
            <button
              key={task.id}
              type="button"
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelectTask(task);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                index === highlight ? "bg-primary/10" : "hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  task.isOverdue
                    ? "bg-red-500"
                    : task.priority === "high"
                      ? "bg-amber-500"
                      : "bg-muted-foreground/50"
                )}
              />
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              {task.id === linkedTaskId && (
                <Check className="size-3.5 shrink-0 text-primary" />
              )}
            </button>
          ))}

          {offerCreate && (
            <button
              type="button"
              role="option"
              aria-selected={highlight === results.length}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreateTask(value.trim());
                setOpen(false);
              }}
              disabled={creating}
              onMouseEnter={() => setHighlight(results.length)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                highlight === results.length ? "bg-primary/10" : "hover:bg-muted",
                creating && "opacity-60"
              )}
            >
              {creating ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
              ) : (
                <Plus className="size-3.5 shrink-0 text-primary" />
              )}
              <span className="min-w-0 flex-1 truncate">
                Create &ldquo;{value.trim()}&rdquo;
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

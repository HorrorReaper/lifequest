"use client";

import { useEffect, useId, useRef, useState, type Ref } from "react";
import { Check, Loader2, ListTodo, PenLine, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { describeTaskDue, formatPlanMinutes } from "@/lib/today-plan";
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
  /**
   * Offers the typed text as it is, without creating a task. Without it the
   * only way to use a new title is to create a task from it.
   */
  onUseText?: (title: string) => void;
  creating?: boolean;
  placeholder?: string;
  className?: string;
  /**
   * Lists the results under the field at all times instead of in a popup,
   * with each task's due date and estimate on a second line. For a picker
   * that already sits in its own dialog, where a popup would be a layer
   * inside a layer.
   */
  inline?: boolean;
  /** The day due dates are described against ("Due today"); inline only. */
  today?: string;
  inputRef?: Ref<HTMLInputElement>;
}

const MAX_RESULTS = 6;

/**
 * A single input that both searches existing tasks and creates a new one.
 * Used by the Today's Plan priority picker, once per outcome role.
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
  onUseText,
  creating = false,
  placeholder,
  className,
  inline = false,
  today,
  inputRef,
}: TaskComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const listOpen = inline || open;

  const query = value.trim().toLowerCase();
  const filtered = query
    ? tasks.filter((task) => task.title.toLowerCase().includes(query))
    : tasks;
  // Inline the list scrolls inside the dialog, so it can show everything
  // the planner loaded rather than stopping at a popup's handful.
  const results = inline ? filtered : filtered.slice(0, MAX_RESULTS);
  const exactMatch = query
    ? tasks.some((task) => task.title.trim().toLowerCase() === query)
    : true;
  const offerCreate = query.length > 0 && !exactMatch;
  const offerText = offerCreate && Boolean(onUseText);
  // The create row, when present, follows the tasks in keyboard navigation,
  // and the plain-text row follows that.
  const createIndex = results.length;
  const textIndex = results.length + (offerCreate ? 1 : 0);
  const optionCount = textIndex + (offerText ? 1 : 0);

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
    if (!open || inline) return;
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [inline, open]);

  // Keeps the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!inline) return;
    document
      .getElementById(`${listId}-option-${highlight}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [highlight, inline, listId]);

  function selectHighlighted() {
    if (highlight < results.length) {
      const task = results[highlight];
      if (task) {
        onSelectTask(task);
        setOpen(false);
      }
      return;
    }
    if (offerCreate && highlight === createIndex) {
      onCreateTask(value.trim());
      setOpen(false);
      return;
    }
    if (offerText && highlight === textIndex) {
      onUseText?.(value.trim());
      setOpen(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!listOpen) {
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
    } else if (event.key === "Escape" && !inline) {
      // Inline, Escape belongs to the dialog around the list.
      setOpen(false);
    }
  }

  function optionClass(index: number) {
    return cn(
      "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left transition-colors",
      inline ? "min-h-12 gap-3 py-2.5 text-base" : "py-2 text-sm",
      index === highlight ? "bg-primary/10" : "hover:bg-muted"
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <ListTodo className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={listOpen && optionCount > 0}
          aria-controls={listOpen && optionCount > 0 ? listId : undefined}
          aria-activedescendant={
            listOpen && optionCount > 0
              ? `${listId}-option-${highlight}`
              : undefined
          }
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
          className={cn("h-12 rounded-xl text-base sm:h-12 md:text-base", className)}
          // Input's own base classes set px-3/sm:px-2.5; overriding just the
          // left side via a pl-* class is not reliable here (tailwind-merge
          // does not consistently treat px-* and pl-* as the same conflict
          // group), so the icon and the "W" of the placeholder ended up
          // overlapping. An inline style always wins on CSS specificity
          // regardless of class merge order.
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>

      {listOpen && optionCount > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "overflow-y-auto",
            inline
              ? "mt-2 max-h-[min(20rem,42svh)] space-y-0.5"
              : "absolute inset-x-0 top-full z-20 mt-1.5 max-h-64 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
          )}
        >
          {results.map((task, index) => {
            const due = inline && today ? describeTaskDue(task.dueDate, today) : null;
            const details = inline
              ? [
                  due,
                  task.estimateMinutes
                    ? formatPlanMinutes(task.estimateMinutes)
                    : null,
                  task.priority === "high" ? "High priority" : null,
                ].filter(Boolean)
              : [];
            return (
              <button
                key={task.id}
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === highlight}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelectTask(task);
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={optionClass(index)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    task.isOverdue
                      ? "bg-red-500"
                      : task.priority === "high"
                        ? "bg-amber-500"
                        : "bg-muted-foreground/50"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block",
                      inline ? "line-clamp-2 break-words leading-snug" : "truncate"
                    )}
                  >
                    {task.title}
                  </span>
                  {details.length > 0 && (
                    <span
                      className={cn(
                        "mt-0.5 block text-sm",
                        task.isOverdue
                          ? "text-red-700 dark:text-red-300"
                          : "text-muted-foreground"
                      )}
                    >
                      {details.join(" · ")}
                    </span>
                  )}
                </span>
                {task.id === linkedTaskId && (
                  <Check className="size-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}

          {offerCreate && (
            <button
              id={`${listId}-option-${createIndex}`}
              type="button"
              role="option"
              aria-selected={highlight === createIndex}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onCreateTask(value.trim());
                setOpen(false);
              }}
              disabled={creating}
              onMouseEnter={() => setHighlight(createIndex)}
              className={cn(optionClass(createIndex), creating && "opacity-60")}
            >
              {creating ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              ) : (
                <Plus className="size-4 shrink-0 text-primary" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {inline ? "Create task" : "Create"} &ldquo;{value.trim()}&rdquo;
              </span>
            </button>
          )}

          {offerText && (
            <button
              id={`${listId}-option-${textIndex}`}
              type="button"
              role="option"
              aria-selected={highlight === textIndex}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onUseText?.(value.trim());
                setOpen(false);
              }}
              disabled={creating}
              onMouseEnter={() => setHighlight(textIndex)}
              className={optionClass(textIndex)}
            >
              <PenLine className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  Plan &ldquo;{value.trim()}&rdquo; without a task
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Just for today, not added to your tasks
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DraftTask {
  // temporary id used only inside the form
  tempId: string;
  title: string;
  priority: "low" | "medium" | "high";
  due_date: string | null;
}

interface TasksInputProps {
  value: DraftTask[];
  onChange: (tasks: DraftTask[]) => void;
  config?: {
    defaultPriority?: "low" | "medium" | "high";
    maxTasks?: number;
  };
}

const priorityStyles: Record<DraftTask["priority"], string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export function TasksInput({ value, onChange, config }: TasksInputProps) {
  const defaultPriority = config?.defaultPriority ?? "medium";
  const maxTasks = config?.maxTasks ?? 10;

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(defaultPriority);
  const [dueDate, setDueDate] = useState("");

  function addTask() {
    if (!title.trim() || value.length >= maxTasks) return;
    const next: DraftTask = {
      tempId: crypto.randomUUID(),
      title: title.trim(),
      priority,
      due_date: dueDate || null,
    };
    onChange([...value, next]);
    setTitle("");
    setDueDate("");
    setPriority(defaultPriority);
  }

  function removeTask(tempId: string) {
    onChange(value.filter((t) => t.tempId !== tempId));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTask();
    }
  }

  return (
    <div className="space-y-3">
      {/* Input row */}
      <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
        <Input
          placeholder="Add a task..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <div className="flex-1">
            <DatePicker
              value={dueDate || null}
              onChange={(d) => setDueDate(d ?? '')}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={addTask}
            disabled={!title.trim() || value.length >= maxTasks}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        {value.length >= maxTasks && (
          <p className="text-xs text-muted-foreground">
            Max {maxTasks} tasks reached.
          </p>
        )}
      </div>

      {/* Pending tasks */}
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((task) => (
            <li
              key={task.tempId}
              className="group flex items-center gap-3 rounded-md border p-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm">{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={cn("text-xs h-5", priorityStyles[task.priority])}
                  >
                    {task.priority}
                  </Badge>
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Due {task.due_date}
                    </span>
                  )}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeTask(task.tempId)}
                className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        These tasks will appear on your dashboard once you save the entry.
      </p>
    </div>
  );
}

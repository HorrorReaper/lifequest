"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from '@/lib/supabase/database.types'
import { supabaseInsert, supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { Task } from "@/lib/types";
import { fetchTasks, toggleTask, deleteTask, createTask, updateTask } from "@/lib/tasks";
import { useUserStore } from '@/lib/stores/user-store'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Pencil, Plus, Save, Trash2, X, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, format, isPast, isToday } from "date-fns";

interface TaskListProps {
  userId: string;
  /** Compact mode for dashboard widget */
  compact?: boolean;
  /** Limit how many tasks to display */
  limit?: number;
  /** Show only open (incomplete) tasks */
  onlyOpen?: boolean;
  /** Open the add-task form when the widget mounts */
  initiallyOpen?: boolean;
}

const priorityStyles: Record<Task["priority"], string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export function TaskList({ userId, compact = false, limit, onlyOpen = false, initiallyOpen = false }: TaskListProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { addXp } = useUserStore()
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(initiallyOpen);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium");
  const [editDueDate, setEditDueDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTasks(supabase, userId, { onlyOpen, limit });
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
    setLoading(false);
  }, [limit, onlyOpen, supabase, userId]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    function handleDataUpdated() {
      load();
    }

    window.addEventListener('lifequest-data-updated', handleDataUpdated);
    return () => window.removeEventListener('lifequest-data-updated', handleDataUpdated);
  }, [load]);

  async function handleToggle(task: Task) {
    // optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_completed: !t.is_completed } : t))
    );
    try {
      await toggleTask(supabase, task.id, !task.is_completed);
      // If we just completed the task, award XP
      const completedNow = !task.is_completed === true
      if (completedNow) {
        const award = 5
        try {
          const { data: auth } = await supabase.auth.getUser()
          const user = auth?.user
            if (user) {
            // record xp event
            await supabaseInsert(supabase, 'xp_events', {
                user_id: user.id,
                source_type: 'task',
                source_id: task.id,
                xp_amount: award,
                description: `Completed task: ${task.title}`,
              })

            // update profiles total_xp
            const { data: profileData } = await supabase
              .from('profiles')
              .select('total_xp')
              .eq('id', user.id)
              .single()

            const profile = profileData as Database['public']['Tables']['profiles']['Row'] | null

            if (profile) {
              const newTotal = (profile.total_xp ?? 0) + award
              await supabaseUpdateWhere(supabase, 'profiles', { total_xp: newTotal }, 'id', user.id)
            }

            // update local store for immediate UI
            addXp(award, profile?.total_xp ?? 0)
          }
        } catch (e) {
          console.error('Failed to award task XP', e)
        }
        // Refresh server components (dashboard) to reflect new totals
        try {
          router.refresh()
        } catch {
          // ignore
        }
      }
      // reload to re-sort
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'));
      router.refresh();
      load();
    } catch (err) {
      console.error("Toggle failed:", err);
      load(); // revert
    }
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(supabase, taskId);
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'));
      router.refresh();
    } catch (err) {
      console.error("Delete failed:", err);
      load();
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await createTask(supabase, userId, {
        title: newTitle,
        priority: newPriority,
        due_date: newDueDate || null,
      });
      setNewTitle("");
      setNewDueDate("");
      setNewPriority("medium");
      setShowAddForm(false);
      await load();
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'));
      router.refresh();
    } catch (err) {
      console.error("Create failed:", err);
    }
    setSubmitting(false);
  }

  function startEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDueDate(task.due_date ?? "");
  }

  function cancelEdit() {
    setEditingTaskId(null);
    setEditTitle("");
    setEditPriority("medium");
    setEditDueDate("");
  }

  async function handleSaveEdit(taskId: string) {
    if (!editTitle.trim()) return;
    try {
      const updated = await updateTask(supabase, taskId, {
        title: editTitle,
        priority: editPriority,
        due_date: editDueDate || null,
      });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      cancelEdit();
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'));
      router.refresh();
      await load();
    } catch (err) {
      console.error("Update failed:", err);
      await load();
    }
  }

  async function handleDeferTomorrow(task: Task) {
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    setTasks((prev) => prev.filter((item) => item.id !== task.id));
    try {
      await updateTask(supabase, task.id, { due_date: tomorrow });
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'));
      router.refresh();
      await load();
    } catch (err) {
      console.error("Defer failed:", err);
      await load();
    }
  }

  return (
    <Card size={compact ? "sm" : "default"} className={compact ? "bg-background/60 shadow-none ring-border/80" : undefined}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          Tasks
          {tasks.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {tasks.filter((t) => !t.is_completed).length} open
            </Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant={showAddForm ? "outline" : "default"}
          onClick={() => setShowAddForm((s) => !s)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {showAddForm ? "Cancel" : "Add"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Add form */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="space-y-2 rounded-lg border p-3 bg-muted/30">
            <Input
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
              required
            />
            <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm sm:h-9"
              >
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
              </select>
              <div className="min-w-0">
                <DatePicker
                  value={newDueDate || null}
                  onChange={(d) => setNewDueDate(d ?? '')}
                />
              </div>
              <Button type="submit" size="sm" className="h-10 sm:h-9" disabled={submitting || !newTitle.trim()}>
                {submitting ? "..." : "Save"}
              </Button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No tasks yet. Click <strong>Add</strong> to create one.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((task) => {
              const due = task.due_date ? new Date(task.due_date) : null;
              const overdue = due && !task.is_completed && isPast(due) && !isToday(due);
              const dueToday = due && isToday(due);
              const isEditing = editingTaskId === task.id;

              return (
                <li
                  key={task.id}
                  className={cn(
                    "group flex items-start gap-3 rounded-md border p-2.5 transition-colors",
                    task.is_completed && "opacity-60 bg-muted/30"
                  )}
                >
                  <Checkbox
                    checked={task.is_completed}
                    onCheckedChange={() => handleToggle(task)}
                    className="mt-0.5"
                    disabled={isEditing}
                  />
                  {isEditing ? (
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="h-10 sm:h-8"
                        autoFocus
                      />
                      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto_auto]">
                        <select
                          value={editPriority}
                          onChange={(event) => setEditPriority(event.target.value as "low" | "medium" | "high")}
                          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm sm:h-8 sm:px-2 sm:text-xs"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <DatePicker
                          value={editDueDate || null}
                          onChange={(date) => setEditDueDate(date ?? "")}
                        />
                        <Button size="sm" className="h-10 sm:h-8" onClick={() => handleSaveEdit(task.id)} disabled={!editTitle.trim()}>
                          <Save className="size-3.5" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={cancelEdit}>
                          <X className="size-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm",
                            task.is_completed && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </p>
                        {!compact && task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={cn("text-xs h-5", priorityStyles[task.priority])}
                          >
                            {task.priority}
                          </Badge>
                          {due && (
                            <span
                              className={cn(
                                "text-xs",
                                overdue && "text-red-600 font-medium",
                                dueToday && "text-orange-600 font-medium",
                                !overdue && !dueToday && "text-muted-foreground"
                              )}
                            >
                              {overdue ? "Overdue • " : dueToday ? "Today • " : ""}
                              {format(due, "MMM d")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeferTomorrow(task)}
                          className="size-10 p-0 text-muted-foreground sm:size-7"
                          aria-label="Defer to tomorrow"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(task)}
                          className="size-10 p-0 text-muted-foreground sm:size-7"
                          aria-label="Edit task"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(task.id)}
                          className="size-10 p-0 text-muted-foreground hover:text-destructive sm:size-7"
                          aria-label="Delete task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

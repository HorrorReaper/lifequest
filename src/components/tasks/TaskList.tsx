"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from '@/lib/supabase/database.types'
import { supabaseInsert, supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { Task } from "@/lib/types";
import { fetchTasks, toggleTask, deleteTask, createTask } from "@/lib/tasks";
import { getLevel } from '@/lib/city'
import { useUserStore } from '@/lib/stores/user-store'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";

interface TaskListProps {
  userId: string;
  /** Compact mode for dashboard widget */
  compact?: boolean;
  /** Limit how many tasks to display */
  limit?: number;
  /** Show only open (incomplete) tasks */
  onlyOpen?: boolean;
}

const priorityStyles: Record<Task["priority"], string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export function TaskList({ userId, compact = false, limit, onlyOpen = false }: TaskListProps) {
  const supabase = createClient();
  const router = useRouter();
  const { addXp } = useUserStore()
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchTasks(supabase, userId, { onlyOpen, limit });
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
    setLoading(false);
  }

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

            // update city_states xp and level if present
            const { data: cityRow } = await supabase
              .from('city_states')
              .select('xp')
              .eq('user_id', user.id)
              .single()

            const city = cityRow as Database['public']['Tables']['city_states']['Row'] | null

            if (city) {
              const newXp = (city.xp ?? 0) + award
              await supabaseUpdateWhere(supabase, 'city_states', { xp: newXp, level: getLevel(newXp), updated_at: new Date().toISOString() }, 'user_id', user.id)
            }

            // update local store for immediate UI
            addXp(award)
          }
        } catch (e) {
          console.error('Failed to award task XP', e)
        }
        // Refresh server components (dashboard) to reflect new totals
        try {
          router.refresh()
        } catch (e) {
          // ignore
        }
      }
      // reload to re-sort
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
    } catch (err) {
      console.error("Create failed:", err);
    }
    setSubmitting(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
            <div className="flex gap-2">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as "low" | "medium" | "high")}
                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
              </select>
              <div className="flex-1">
                <DatePicker
                  value={newDueDate || null}
                  onChange={(d) => setNewDueDate(d ?? '')}
                />
              </div>
              <Button type="submit" size="sm" disabled={submitting || !newTitle.trim()}>
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
                  />
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(task.id)}
                    className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

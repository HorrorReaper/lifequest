'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ListTodo, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { awardTaskCompletionXp, toggleTask, type TaskPriority } from '@/lib/tasks'
import type { DashboardTask } from '@/lib/dashboard-tasks'
import { useUserStore } from '@/lib/stores/user-store'
import { formatTaskDate } from '@/lib/task-manager'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface TasksSectionProps {
  userId: string
  /** Due today or earlier. */
  dueTasks: DashboardTask[]
  /**
   * Open tasks with no due date, shown only when nothing is due.
   *
   * The dashboard's task query has always included undated tasks, so leaving
   * them out entirely would show an empty section to anyone who never sets due
   * dates while they hold a full backlog.
   */
  undatedTasks: DashboardTask[]
  /** Every open task, for the footer count. */
  openTaskCount: number
}

const priorityStripe: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
}

export function TasksSection({
  userId,
  dueTasks,
  undatedTasks,
  openTaskCount,
}: TasksSectionProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)

  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const showingUndated = dueTasks.length === 0 && undatedTasks.length > 0
  const tasks = dueTasks.length > 0 ? dueTasks : undatedTasks
  const overdueCount = dueTasks.filter((task) => task.isOverdue).length

  async function completeTask(task: DashboardTask) {
    if (busyId || completedIds.has(task.id)) return

    setBusyId(task.id)
    setError(null)
    setCompletedIds((current) => new Set(current).add(task.id))

    try {
      await toggleTask(supabase, task.id, true)

      try {
        // awardTaskCompletionXp checks for an existing xp_event first, so a
        // repeat completion cannot double-award.
        const result = await awardTaskCompletionXp(supabase, userId, task)
        if (result.awarded) addXp(5, result.previousTotal)
      } catch (xpError) {
        console.error('Failed to award task XP', xpError)
      }

      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (toggleError) {
      setCompletedIds((current) => {
        const next = new Set(current)
        next.delete(task.id)
        return next
      })
      setError(
        toggleError instanceof Error && toggleError.message
          ? toggleError.message
          : `Could not complete ${task.title}.`
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListTodo className="size-4 text-blue-500" />
          <h2 className="text-sm font-semibold">Tasks</h2>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {showingUndated ? (
            <>Nothing due today &middot; {undatedTasks.length} unscheduled</>
          ) : dueTasks.length > 0 ? (
            <>
              {overdueCount > 0 && (
                <span className="text-destructive">{overdueCount} overdue &middot; </span>
              )}
              {dueTasks.length - overdueCount} today
            </>
          ) : null}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nothing due today.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/tasks">Add a task</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-1">
            {tasks.map((task) => {
              const done = completedIds.has(task.id)
              const busy = busyId === task.id

              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => void completeTask(task)}
                    disabled={busy || done}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'h-7 w-[3px] shrink-0 rounded-full',
                        priorityStripe[task.priority]
                      )}
                    />
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                        done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                      )}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        done && <Check className="size-3.5" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm',
                        done && 'text-muted-foreground line-through'
                      )}
                    >
                      {task.title}
                    </span>
                    {task.dueDate && (
                      <span
                        className={cn(
                          'shrink-0 text-xs tabular-nums',
                          task.isOverdue ? 'text-destructive' : 'text-muted-foreground'
                        )}
                      >
                        {task.isOverdue ? 'Overdue' : formatTaskDate(task.dueDate)}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex justify-end border-t pt-3">
            <Link
              href="/tasks"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              All tasks{openTaskCount > 0 && ` (${openTaskCount})`} →
            </Link>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </section>
  )
}

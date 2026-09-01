'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ListTodo, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { awardTaskCompletionXp, createTask, toggleTask, type TaskPriority } from '@/lib/tasks'
import type { DashboardTask } from '@/lib/dashboard-tasks'
import { useUserStore } from '@/lib/stores/user-store'
import { formatTaskDate } from '@/lib/task-manager'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TaskEditorDialog, type TaskEditorDraft } from '@/components/tasks/TaskEditorDialog'

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
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)

  async function handleCreate(draft: TaskEditorDraft) {
    setEditorSaving(true)
    setEditorError(null)
    try {
      await createTask(supabase, userId, draft)
      setEditorOpen(false)
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (createError) {
      setEditorError(
        createError instanceof Error && createError.message
          ? createError.message
          : 'Could not create the task.'
      )
    } finally {
      setEditorSaving(false)
    }
  }

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
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ListTodo className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">Tasks</h2>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground sm:text-xs">
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
          <p className="text-base leading-relaxed text-muted-foreground sm:text-sm">
            Nothing due today.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
            Add a task
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {tasks.map((task) => {
              const done = completedIds.has(task.id)
              const busy = busyId === task.id

              return (
                <li key={task.id}>
                  {/* Sized to match HabitsSection: mobile-first, stepping back
                      down at sm where a cursor needs less room than a thumb. */}
                  <button
                    type="button"
                    onClick={() => void completeTask(task)}
                    disabled={busy || done}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors disabled:opacity-60 sm:min-h-12',
                      done
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-background hover:border-foreground/25 hover:bg-muted/50'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'w-[3px] shrink-0 rounded-full',
                        'h-8 sm:h-7',
                        priorityStripe[task.priority]
                      )}
                    />
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors sm:size-6',
                        done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                      )}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin sm:size-3.5" />
                      ) : (
                        done && <Check className="size-4 sm:size-3.5" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-lg sm:text-base',
                        done && 'text-muted-foreground line-through'
                      )}
                    >
                      {task.title}
                    </span>
                    {task.dueDate && (
                      <span
                        className={cn(
                          'shrink-0 text-sm tabular-nums sm:text-xs',
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

          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              + Add task
            </button>
            <Link
              href="/tasks"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              All tasks{openTaskCount > 0 && ` (${openTaskCount})`} →
            </Link>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive sm:text-xs">{error}</p>}

      <TaskEditorDialog
        key={editorOpen ? 'open' : 'closed'}
        open={editorOpen}
        task={null}
        saving={editorSaving}
        error={editorError}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditorError(null)
        }}
        onSubmit={handleCreate}
      />
    </section>
  )
}

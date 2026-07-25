'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  Inbox,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useUserStore } from '@/lib/stores/user-store'
import { createClient } from '@/lib/supabase/client'
import {
  countTaskViews,
  filterTasks,
  formatTaskDate,
  localDateKey,
  removeTaskLocally,
  sortTasks,
  TASK_VIEW_LABELS,
  tomorrowDateKey,
  type TaskPriorityFilter,
  type TaskView,
} from '@/lib/task-manager'
import {
  awardTaskCompletionXp,
  createTask,
  deleteTask,
  fetchTasks,
  toggleTask,
  updateTask,
  type ManagedTask,
  type TaskPriority,
} from '@/lib/tasks'
import { cn } from '@/lib/utils'
import { TaskDeleteDialog } from './TaskDeleteDialog'
import {
  TaskEditorDialog,
  type TaskEditorDraft,
} from './TaskEditorDialog'

interface TaskManagerProps {
  userId: string
  compact?: boolean
  limit?: number
  onlyOpen?: boolean
  initiallyOpen?: boolean
}

type RetryAction =
  | { kind: 'toggle'; taskId: string; completed: boolean }
  | { kind: 'defer'; taskId: string }
  | { kind: 'delete'; task: ManagedTask }

interface MutationError {
  message: string
  retry: RetryAction
}

const priorityStyles: Record<TaskPriority, string> = {
  high: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  medium:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
}

const views: Array<{
  value: TaskView
  icon: typeof Circle
}> = [
  { value: 'today', icon: Circle },
  { value: 'upcoming', icon: CalendarDays },
  { value: 'no-date', icon: Inbox },
  { value: 'completed', icon: CheckCircle2 },
]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function TaskManager({
  userId,
  compact = false,
  limit,
  onlyOpen = false,
  initiallyOpen = false,
}: TaskManagerProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { addXp } = useUserStore()
  const [tasks, setTasks] = useState<ManagedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<TaskView>('today')
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState<TaskPriorityFilter>('all')
  const [editorOpen, setEditorOpen] = useState(initiallyOpen)
  const [editingTask, setEditingTask] = useState<ManagedTask | null>(null)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<ManagedTask | null>(
    null
  )
  const [mutationKeys, setMutationKeys] = useState<Set<string>>(() => new Set())
  const [mutationError, setMutationError] = useState<MutationError | null>(null)
  const lockRef = useRef(new Set<string>())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchTasks(supabase, userId, {
        onlyOpen,
        limit,
      })
      setTasks(data)
    } catch (error) {
      setLoadError(errorMessage(error, 'Tasks could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }, [limit, onlyOpen, supabase, userId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    const handleDataUpdated = () => {
      void load()
    }
    window.addEventListener('lifequest-data-updated', handleDataUpdated)
    return () =>
      window.removeEventListener('lifequest-data-updated', handleDataUpdated)
  }, [load])

  function beginMutation(key: string): boolean {
    if (lockRef.current.has(key)) return false
    lockRef.current.add(key)
    setMutationKeys(new Set(lockRef.current))
    return true
  }

  function endMutation(key: string) {
    lockRef.current.delete(key)
    setMutationKeys(new Set(lockRef.current))
  }

  function notifyDataUpdated() {
    window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
    router.refresh()
  }

  function openCreate() {
    setEditingTask(null)
    setEditorError(null)
    setEditorOpen(true)
  }

  function openEdit(task: ManagedTask) {
    setEditingTask(task)
    setEditorError(null)
    setEditorOpen(true)
  }

  async function handleEditorSubmit(draft: TaskEditorDraft) {
    const key = editingTask ? `edit:${editingTask.id}` : 'create'
    if (!beginMutation(key)) return
    setEditorSaving(true)
    setEditorError(null)

    try {
      if (editingTask) {
        const updated = await updateTask(supabase, editingTask.id, {
          title: draft.title,
          description: draft.description,
          due_date: draft.due_date,
          priority: draft.priority,
        })
        setTasks((current) =>
          current.map((task) => (task.id === updated.id ? updated : task))
        )
      } else {
        const created = await createTask(supabase, userId, draft)
        setTasks((current) => [created, ...current])
      }

      setEditorOpen(false)
      setEditingTask(null)
      notifyDataUpdated()
    } catch (error) {
      setEditorError(
        errorMessage(
          error,
          editingTask
            ? 'Changes could not be saved. Try again.'
            : 'The task could not be created. Try again.'
        )
      )
    } finally {
      setEditorSaving(false)
      endMutation(key)
    }
  }

  async function awardXp(task: ManagedTask) {
    try {
      const result = await awardTaskCompletionXp(
        supabase,
        userId,
        task
      )
      if (result.awarded) addXp(5, result.previousTotal)
    } catch (error) {
      console.error('Failed to award task XP', error)
    }
  }

  async function performToggle(
    task: ManagedTask,
    completed: boolean,
    isRetry = false
  ) {
    const key = `toggle:${task.id}`
    if (!beginMutation(key)) return
    const previous = task
    setMutationError(null)
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, is_completed: completed } : item
      )
    )

    try {
      const updated = await toggleTask(supabase, task.id, completed)
      setTasks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
      if (completed) await awardXp(updated)
      notifyDataUpdated()
    } catch (error) {
      setTasks((current) =>
        current.map((item) => (item.id === previous.id ? previous : item))
      )
      setMutationError({
        message: errorMessage(
          error,
          isRetry
            ? 'The task still could not be updated.'
            : 'The task change was not saved.'
        ),
        retry: { kind: 'toggle', taskId: task.id, completed },
      })
    } finally {
      endMutation(key)
    }
  }

  async function performDefer(task: ManagedTask, isRetry = false) {
    const key = `defer:${task.id}`
    if (!beginMutation(key)) return
    const previous = task
    const dueDate = tomorrowDateKey()
    setMutationError(null)
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? { ...item, due_date: dueDate } : item
      )
    )

    try {
      const updated = await updateTask(supabase, task.id, {
        due_date: dueDate,
      })
      setTasks((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
      notifyDataUpdated()
    } catch (error) {
      setTasks((current) =>
        current.map((item) => (item.id === previous.id ? previous : item))
      )
      setMutationError({
        message: errorMessage(
          error,
          isRetry
            ? 'The task still could not be deferred.'
            : 'The task stayed on its original date.'
        ),
        retry: { kind: 'defer', taskId: task.id },
      })
    } finally {
      endMutation(key)
    }
  }

  async function performDelete(task: ManagedTask, isRetry = false) {
    const key = `delete:${task.id}`
    if (!beginMutation(key)) return
    setDeleteCandidate(null)
    setMutationError(null)
    setTasks((current) => removeTaskLocally(current, task.id))

    try {
      await deleteTask(supabase, task.id)
      notifyDataUpdated()
    } catch (error) {
      setTasks((current) =>
        current.some((item) => item.id === task.id)
          ? current
          : [...current, task]
      )
      setMutationError({
        message: errorMessage(
          error,
          isRetry
            ? 'The task still could not be deleted.'
            : 'The task was restored because deletion failed.'
        ),
        retry: { kind: 'delete', task },
      })
    } finally {
      endMutation(key)
    }
  }

  async function retryMutation() {
    if (!mutationError) return
    const action = mutationError.retry
    const currentTask =
      action.kind === 'delete'
        ? action.task
        : tasks.find((task) => task.id === action.taskId)
    if (!currentTask) {
      setMutationError(null)
      return
    }

    if (action.kind === 'toggle') {
      await performToggle(currentTask, action.completed, true)
    } else if (action.kind === 'defer') {
      await performDefer(currentTask, true)
    } else {
      await performDelete(currentTask, true)
    }
  }

  const todayKey = localDateKey()
  const counts = useMemo(
    () => countTaskViews(tasks, todayKey),
    [tasks, todayKey]
  )
  const displayedTasks = useMemo(
    () =>
      compact
        ? sortTasks(tasks).slice(0, limit)
        : filterTasks(tasks, view, { search, priority }, todayKey),
    [compact, limit, priority, search, tasks, todayKey, view]
  )

  const taskRows = (
    <TaskRows
      tasks={displayedTasks}
      compact={compact}
      todayKey={todayKey}
      mutationKeys={mutationKeys}
      onToggle={(task) => void performToggle(task, !task.is_completed)}
      onEdit={openEdit}
      onDefer={(task) => void performDefer(task)}
      onDelete={setDeleteCandidate}
    />
  )

  return (
    <>
      {compact ? (
        <Card
          size="sm"
          className="bg-background/60 shadow-none ring-border/80"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListTodo className="size-5" />
              Tasks
              {tasks.length > 0 && (
                <Badge variant="secondary">{tasks.length} open</Badge>
              )}
            </CardTitle>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <TaskStatus
              loading={loading}
              loadError={loadError}
              empty={displayedTasks.length === 0}
              compact
              onRetry={() => void load()}
            >
              {taskRows}
            </TaskStatus>
            <MutationErrorBanner
              error={mutationError}
              onDismiss={() => setMutationError(null)}
              onRetry={() => void retryMutation()}
            />
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-5" aria-label="Task manager">
          <div
            role="tablist"
            aria-label="Task views"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {views.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  'flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  view === value &&
                    'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {TASK_VIEW_LABELS[value]}
                  </span>
                  <span className="text-xs opacity-70">
                    {counts[value]} {counts[value] === 1 ? 'task' : 'tasks'}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="gap-4 border-b">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">
                    {TASK_VIEW_LABELS[view]}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {view === 'today' &&
                      'Today’s commitments, including anything overdue.'}
                    {view === 'upcoming' &&
                      'What is scheduled after today.'}
                    {view === 'no-date' &&
                      'Important work that still needs a place.'}
                    {view === 'completed' &&
                      'Finished work you can reopen when needed.'}
                  </p>
                </div>
                <Button onClick={openCreate} className="h-11">
                  <Plus className="size-4" />
                  Add task
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                <label className="relative">
                  <span className="sr-only">Search tasks</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search title or description"
                    className="h-11 pl-9"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter by priority</span>
                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as TaskPriorityFilter)
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">All priorities</option>
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                </label>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-3 sm:p-5">
              <MutationErrorBanner
                error={mutationError}
                onDismiss={() => setMutationError(null)}
                onRetry={() => void retryMutation()}
              />
              <TaskStatus
                loading={loading}
                loadError={loadError}
                empty={displayedTasks.length === 0}
                searchActive={Boolean(search.trim()) || priority !== 'all'}
                view={view}
                onRetry={() => void load()}
              >
                {taskRows}
              </TaskStatus>
            </CardContent>
          </Card>
        </section>
      )}

      <TaskEditorDialog
        key={`${editingTask?.id ?? 'new'}:${editorOpen ? 'open' : 'closed'}`}
        open={editorOpen}
        task={editingTask}
        saving={editorSaving}
        error={editorError}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            setEditingTask(null)
            setEditorError(null)
          }
        }}
        onSubmit={handleEditorSubmit}
      />
      <TaskDeleteDialog
        task={deleteCandidate}
        deleting={
          deleteCandidate
            ? mutationKeys.has(`delete:${deleteCandidate.id}`)
            : false
        }
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => {
          if (deleteCandidate) void performDelete(deleteCandidate)
        }}
      />
    </>
  )
}

interface TaskRowsProps {
  tasks: ManagedTask[]
  compact: boolean
  todayKey: string
  mutationKeys: Set<string>
  onToggle: (task: ManagedTask) => void
  onEdit: (task: ManagedTask) => void
  onDefer: (task: ManagedTask) => void
  onDelete: (task: ManagedTask) => void
}

function TaskRows({
  tasks,
  compact,
  todayKey,
  mutationKeys,
  onToggle,
  onEdit,
  onDefer,
  onDelete,
}: TaskRowsProps) {
  return (
    <ul className="space-y-2">
      {tasks.map((task) => {
        const mutating = [...mutationKeys].some((key) =>
          key.endsWith(`:${task.id}`)
        )
        const overdue =
          Boolean(task.due_date) &&
          !task.is_completed &&
          task.due_date! < todayKey

        return (
          <li
            key={task.id}
            className={cn(
              'group rounded-2xl border bg-background p-3 transition-colors sm:p-4',
              task.is_completed && 'bg-muted/30'
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={task.is_completed}
                onCheckedChange={() => onToggle(task)}
                disabled={mutating}
                aria-label={
                  task.is_completed
                    ? `Reopen ${task.title}`
                    : `Complete ${task.title}`
                }
                className="mt-0.5 size-6 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-medium leading-5',
                    task.is_completed &&
                      'text-muted-foreground line-through'
                  )}
                >
                  {task.title}
                </p>
                {!compact && task.description && (
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {task.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-6 capitalize',
                      priorityStyles[task.priority]
                    )}
                  >
                    {task.priority}
                  </Badge>
                  {task.due_date && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs text-muted-foreground',
                        overdue && 'font-medium text-destructive'
                      )}
                    >
                      <CalendarDays className="size-3.5" />
                      {overdue && 'Overdue · '}
                      {task.due_date === todayKey
                        ? 'Today'
                        : formatTaskDate(task.due_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-1 border-t pt-2">
              {task.is_completed ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggle(task)}
                  disabled={mutating}
                  className="min-h-10"
                >
                  <RotateCcw className="size-4" />
                  Reopen
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onDefer(task)}
                  disabled={mutating}
                  className="min-h-10"
                >
                  <CalendarClock className="size-4" />
                  Tomorrow
                </Button>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => onEdit(task)}
                disabled={mutating}
                className="size-10"
                aria-label={`Edit ${task.title}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => onDelete(task)}
                disabled={mutating}
                className="size-10 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${task.title}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

interface TaskStatusProps {
  loading: boolean
  loadError: string | null
  empty: boolean
  compact?: boolean
  searchActive?: boolean
  view?: TaskView
  onRetry: () => void
  children: React.ReactNode
}

function TaskStatus({
  loading,
  loadError,
  empty,
  compact = false,
  searchActive = false,
  view = 'today',
  onRetry,
  children,
}: TaskStatusProps) {
  if (loading) {
    return (
      <div className="space-y-2" aria-label="Loading tasks">
        {[0, 1, 2].slice(0, compact ? 2 : 3).map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-2xl border bg-muted/50"
          />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4"
      >
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium">Could not load tasks</p>
            <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">
          {searchActive
            ? 'No matching tasks'
            : compact
              ? 'No open tasks'
              : `Nothing in ${TASK_VIEW_LABELS[view]}`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {searchActive
            ? 'Try a different search or priority.'
            : view === 'completed'
              ? 'Completed tasks will collect here.'
              : 'Create a task when something needs your attention.'}
        </p>
      </div>
    )
  }

  return children
}

function MutationErrorBanner({
  error,
  onDismiss,
  onRetry,
}: {
  error: MutationError | null
  onDismiss: () => void
  onRetry: () => void
}) {
  if (!error) return null

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3"
    >
      <TriangleAlert className="size-5 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 text-sm">{error.message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  )
}

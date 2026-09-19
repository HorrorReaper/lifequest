import type { TaskPriority } from '@/lib/tasks'

/**
 * Rows fetched for the dashboard's task section.
 *
 * More than are shown: the section falls back to undated work when nothing is
 * due, and both sets come out of the one existing query.
 */
export const DASHBOARD_TASK_FETCH_LIMIT = 16

/** Rows rendered in the section before deferring to /tasks. */
export const DASHBOARD_TASK_DISPLAY_LIMIT = 8

export interface TaskRow {
  id: string
  title: string
  due_date: string | null
  priority: TaskPriority | null
}

export interface DashboardTask {
  id: string
  title: string
  dueDate: string | null
  priority: TaskPriority
  isOverdue: boolean
}

export interface DashboardTaskSets {
  /** Due today or earlier. */
  dueTasks: DashboardTask[]
  /** Open but unscheduled, shown only when nothing is due. */
  undatedTasks: DashboardTask[]
}

/**
 * Splits the dashboard's task query into the two sets the section renders.
 *
 * The query has always included undated tasks (`due_date.lte.today` OR
 * `due_date.is.null`), so dropping them would show an empty section to anyone
 * who never sets due dates while they hold a full backlog. Partitioning rather
 * than slicing keeps the split correct whatever order the rows arrive in.
 */
export function partitionDashboardTasks(
  rows: TaskRow[],
  today: string
): DashboardTaskSets {
  const tasks: DashboardTask[] = rows.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.due_date,
    priority: task.priority ?? 'medium',
    isOverdue: task.due_date !== null && task.due_date < today,
  }))

  return {
    dueTasks: tasks
      .filter((task) => task.dueDate !== null)
      .slice(0, DASHBOARD_TASK_DISPLAY_LIMIT),
    undatedTasks: tasks
      .filter((task) => task.dueDate === null)
      .slice(0, DASHBOARD_TASK_DISPLAY_LIMIT),
  }
}

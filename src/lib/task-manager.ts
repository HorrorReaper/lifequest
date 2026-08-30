import { parseLocalDate } from '@/lib/dates'

// Grouping and counting take the current day as a required argument rather
// than defaulting to the browser's. The default used to be `localDateKey()`,
// which made the Today column roll over on the device clock while the rest of
// the app used the profile timezone. Requiring it forces every caller to say
// which day it means.
import type { ManagedTask, TaskPriority } from './tasks'

export type TaskView = 'today' | 'upcoming' | 'no-date' | 'completed'
export type TaskPriorityFilter = TaskPriority | 'all'

export interface TaskFilters {
  search: string
  priority: TaskPriorityFilter
}

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  'no-date': 'No Date',
  completed: 'Completed',
}

export const TASK_PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function formatTaskDate(
  dateKey: string,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  const date = parseLocalDate(dateKey)
  if (!date) return dateKey
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function taskViewForDate(
  task: Pick<ManagedTask, 'due_date' | 'is_completed'>,
  todayKey: string
): TaskView {
  if (task.is_completed) return 'completed'
  if (!task.due_date) return 'no-date'
  return task.due_date <= todayKey ? 'today' : 'upcoming'
}

export function sortTasks(tasks: ManagedTask[]): ManagedTask[] {
  return [...tasks].sort((left, right) => {
    const priorityDifference =
      TASK_PRIORITY_ORDER[left.priority] - TASK_PRIORITY_ORDER[right.priority]
    if (priorityDifference !== 0) return priorityDifference

    if (left.due_date && right.due_date) {
      const dueDifference = left.due_date.localeCompare(right.due_date)
      if (dueDifference !== 0) return dueDifference
    } else if (left.due_date) {
      return -1
    } else if (right.due_date) {
      return 1
    }

    const createdDifference = right.created_at.localeCompare(left.created_at)
    if (createdDifference !== 0) return createdDifference
    return left.title.localeCompare(right.title)
  })
}

export function filterTasks(
  tasks: ManagedTask[],
  view: TaskView,
  filters: TaskFilters,
  todayKey: string
): ManagedTask[] {
  const normalizedSearch = filters.search.trim().toLocaleLowerCase()

  return sortTasks(
    tasks.filter((task) => {
      if (taskViewForDate(task, todayKey) !== view) return false
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false
      }
      if (!normalizedSearch) return true

      return `${task.title} ${task.description ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedSearch)
    })
  )
}

export function countTaskViews(
  tasks: ManagedTask[],
  todayKey: string
): Record<TaskView, number> {
  return tasks.reduce<Record<TaskView, number>>(
    (counts, task) => {
      counts[taskViewForDate(task, todayKey)] += 1
      return counts
    },
    { today: 0, upcoming: 0, 'no-date': 0, completed: 0 }
  )
}

export function patchTaskLocally(
  tasks: ManagedTask[],
  taskId: string,
  patch: Partial<ManagedTask>
): ManagedTask[] {
  return tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task))
}

export function removeTaskLocally(
  tasks: ManagedTask[],
  taskId: string
): ManagedTask[] {
  return tasks.filter((task) => task.id !== taskId)
}

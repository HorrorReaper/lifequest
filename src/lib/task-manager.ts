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

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(dateKey: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function tomorrowDateKey(date = new Date()): string {
  return localDateKey(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12)
  )
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
  todayKey = localDateKey()
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
  todayKey = localDateKey()
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
  todayKey = localDateKey()
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

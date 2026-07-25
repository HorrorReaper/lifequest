import type { TaskStatus } from '@/lib/types'

type ProjectTask = {
  status: TaskStatus
}

export function projectProgress(tasks: ProjectTask[]) {
  const relevant = tasks.filter((task) => task.status !== 'cancelled')
  if (relevant.length === 0) return { completed: 0, total: 0, percent: 0 }
  const completed = relevant.filter((task) => task.status === 'done').length
  return {
    completed,
    total: relevant.length,
    percent: Math.round(completed / relevant.length * 100),
  }
}

export function tasksByStatus<T extends ProjectTask>(tasks: T[]) {
  const grouped: Record<TaskStatus, T[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
    cancelled: [],
  }
  for (const task of tasks) grouped[task.status].push(task)
  return grouped
}

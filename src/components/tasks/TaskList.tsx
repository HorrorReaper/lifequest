'use client'

import { TaskManager } from './TaskManager'

export interface TaskListProps {
  userId: string
  /** The user's current day, resolved from their profile timezone. */
  today: string
  /** Compact mode for dashboard widget */
  compact?: boolean
  /** Limit how many tasks to display */
  limit?: number
  /** Show only open (incomplete) tasks */
  onlyOpen?: boolean
  /** Open the add-task form when the widget mounts */
  initiallyOpen?: boolean
}

/**
 * Backward-compatible dashboard entry point.
 * The full `/tasks` route uses the same controller with the manager layout.
 */
export function TaskList(props: TaskListProps) {
  return <TaskManager {...props} />
}

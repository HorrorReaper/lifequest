import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_TASK_DISPLAY_LIMIT,
  partitionDashboardTasks,
} from '@/lib/dashboard-tasks'

const today = '2026-08-31'

describe('partitionDashboardTasks', () => {
  it('splits dated from undated work', () => {
    const { dueTasks, undatedTasks } = partitionDashboardTasks(
      [
        { id: 't1', title: 'Report', due_date: '2026-08-31', priority: 'high' },
        { id: 't2', title: 'Someday', due_date: null, priority: 'low' },
      ],
      today
    )

    expect(dueTasks.map((task) => task.id)).toEqual(['t1'])
    expect(undatedTasks.map((task) => task.id)).toEqual(['t2'])
  })

  it('flags anything dated before today as overdue', () => {
    const { dueTasks } = partitionDashboardTasks(
      [
        { id: 't1', title: 'Late', due_date: '2026-08-20', priority: 'medium' },
        { id: 't2', title: 'Today', due_date: today, priority: 'medium' },
      ],
      today
    )

    expect(dueTasks[0].isOverdue).toBe(true)
    expect(dueTasks[1].isOverdue).toBe(false)
  })

  it('never marks an undated task overdue', () => {
    const { undatedTasks } = partitionDashboardTasks(
      [{ id: 't1', title: 'Someday', due_date: null, priority: 'low' }],
      today
    )

    expect(undatedTasks[0].isOverdue).toBe(false)
  })

  it('defaults a missing priority to medium', () => {
    const { dueTasks } = partitionDashboardTasks(
      [{ id: 't1', title: 'Report', due_date: today, priority: null }],
      today
    )

    expect(dueTasks[0].priority).toBe('medium')
  })

  it('caps each set at the display limit', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({
      id: `t${index}`,
      title: `Task ${index}`,
      due_date: today,
      priority: 'medium' as const,
    }))

    expect(partitionDashboardTasks(rows, today).dueTasks).toHaveLength(
      DASHBOARD_TASK_DISPLAY_LIMIT
    )
  })

  it('partitions correctly even when undated rows come first', () => {
    // The query orders dated rows first, but the split must not depend on it.
    const { dueTasks, undatedTasks } = partitionDashboardTasks(
      [
        { id: 't1', title: 'Someday', due_date: null, priority: 'low' },
        { id: 't2', title: 'Report', due_date: today, priority: 'high' },
      ],
      today
    )

    expect(dueTasks.map((task) => task.id)).toEqual(['t2'])
    expect(undatedTasks.map((task) => task.id)).toEqual(['t1'])
  })
})

import { describe, expect, it } from 'vitest'
import type { ManagedTask } from './tasks'
import {
  countTaskViews,
  filterTasks,
  formatTaskDate,
  localDateKey,
  parseLocalDate,
  patchTaskLocally,
  removeTaskLocally,
  sortTasks,
  taskViewForDate,
  tomorrowDateKey,
} from './task-manager'

function task(
  id: string,
  patch: Partial<ManagedTask> = {}
): ManagedTask {
  return {
    id,
    user_id: 'user-1',
    title: `Task ${id}`,
    description: null,
    is_completed: false,
    due_date: null,
    priority: 'medium',
    created_at: `2026-07-${id.padStart(2, '0')}T10:00:00Z`,
    updated_at: `2026-07-${id.padStart(2, '0')}T10:00:00Z`,
    ...patch,
  }
}

describe('task manager date handling', () => {
  it('creates date-only keys from local calendar values without UTC conversion', () => {
    const local = new Date(2026, 6, 25, 0, 5)
    expect(localDateKey(local)).toBe('2026-07-25')
    expect(tomorrowDateKey(local)).toBe('2026-07-26')

    const parsed = parseLocalDate('2026-07-25')
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(6)
    expect(parsed?.getDate()).toBe(25)
    expect(formatTaskDate('not-a-date')).toBe('not-a-date')
  })

  it('handles month and year boundaries locally', () => {
    expect(tomorrowDateKey(new Date(2026, 11, 31, 23, 30))).toBe(
      '2027-01-01'
    )
    expect(parseLocalDate('2026-02-30')).toBeNull()
  })
})

describe('task manager grouping and filters', () => {
  const today = '2026-07-25'
  const tasks = [
    task('1', { due_date: '2026-07-24', priority: 'low' }),
    task('2', { due_date: today, priority: 'high' }),
    task('3', { due_date: '2026-07-26', priority: 'medium' }),
    task('4', { due_date: null, priority: 'high' }),
    task('5', { is_completed: true, due_date: today, priority: 'low' }),
  ]

  it('puts overdue work in Today and completed work only in Completed', () => {
    expect(taskViewForDate(tasks[0], today)).toBe('today')
    expect(taskViewForDate(tasks[2], today)).toBe('upcoming')
    expect(taskViewForDate(tasks[3], today)).toBe('no-date')
    expect(taskViewForDate(tasks[4], today)).toBe('completed')
    expect(countTaskViews(tasks, today)).toEqual({
      today: 2,
      upcoming: 1,
      'no-date': 1,
      completed: 1,
    })
  })

  it('sorts high, medium, then low and filters title or description', () => {
    expect(sortTasks(tasks).map((item) => item.priority)).toEqual([
      'high',
      'high',
      'medium',
      'low',
      'low',
    ])

    const matching = filterTasks(
      [
        task('6', {
          title: 'Write launch brief',
          description: 'Clarify positioning',
          due_date: today,
          priority: 'high',
        }),
        task('7', {
          title: 'Buy groceries',
          description: 'Protein and fruit',
          due_date: today,
          priority: 'low',
        }),
      ],
      'today',
      { search: 'positioning', priority: 'high' },
      today
    )

    expect(matching.map((item) => item.id)).toEqual(['6'])
  })
})

describe('optimistic task helpers', () => {
  it('supports completion/reopen patches and rollback with the original task', () => {
    const original = task('1')
    const completed = patchTaskLocally([original], original.id, {
      is_completed: true,
    })
    expect(completed[0].is_completed).toBe(true)

    const rolledBack = patchTaskLocally(completed, original.id, original)
    expect(rolledBack).toEqual([original])
  })

  it('removes a task optimistically without mutating the original array', () => {
    const original = [task('1'), task('2')]
    expect(removeTaskLocally(original, '1').map((item) => item.id)).toEqual([
      '2',
    ])
    expect(original).toHaveLength(2)
  })
})

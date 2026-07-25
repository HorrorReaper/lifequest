import { describe, expect, it } from 'vitest'
import { projectProgress, tasksByStatus } from './project-metrics'

describe('project metrics', () => {
  it('calculates progress without counting cancelled work', () => {
    expect(projectProgress([
      { status: 'done' },
      { status: 'todo' },
      { status: 'cancelled' },
    ])).toEqual({ completed: 1, total: 2, percent: 50 })
  })

  it('returns a stable empty result', () => {
    expect(projectProgress([])).toEqual({ completed: 0, total: 0, percent: 0 })
  })

  it('groups every workflow status', () => {
    const grouped = tasksByStatus([
      { id: 'a', status: 'blocked' as const },
      { id: 'b', status: 'done' as const },
    ])
    expect(grouped.blocked[0].id).toBe('a')
    expect(grouped.done[0].id).toBe('b')
    expect(grouped.todo).toEqual([])
  })
})

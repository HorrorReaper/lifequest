import { describe, expect, it } from 'vitest'
import { dayProgress, type DayProgressInput } from '@/lib/day-progress'

const empty: DayProgressInput = {
  habitsDone: 0,
  habitsTotal: 0,
  plannedTasksDone: 0,
  plannedTasks: 0,
  reflectionsWritten: 0,
  reflectionsPlanned: 0,
  eveningReviewDone: null,
}

describe('dayProgress', () => {
  it('stays at the first stage on a day with nothing on it', () => {
    expect(dayProgress(empty)).toEqual({ done: 0, total: 0, stage: 0 })
  })

  it('counts habits, planned tasks, reflections and the evening review as steps', () => {
    expect(
      dayProgress({
        habitsDone: 2,
        habitsTotal: 4,
        plannedTasksDone: 1,
        plannedTasks: 2,
        reflectionsWritten: 0,
        reflectionsPlanned: 1,
        eveningReviewDone: false,
      })
    ).toEqual({ done: 3, total: 8, stage: 1 })
  })

  it('leaves out an evening review that is switched off', () => {
    expect(dayProgress({ ...empty, habitsDone: 1, habitsTotal: 1 }).total).toBe(1)
    expect(
      dayProgress({ ...empty, habitsDone: 1, habitsTotal: 1, eveningReviewDone: true }).total
    ).toBe(2)
  })

  it('moves up a stage at a third and at two thirds', () => {
    const at = (done: number) => dayProgress({ ...empty, habitsDone: done, habitsTotal: 6 }).stage
    expect(at(0)).toBe(0)
    expect(at(1)).toBe(0)
    expect(at(2)).toBe(1)
    expect(at(3)).toBe(1)
    expect(at(4)).toBe(2)
    expect(at(6)).toBe(2)
  })

  it('never counts more done than there is', () => {
    expect(dayProgress({ ...empty, habitsDone: 9, habitsTotal: 2 })).toEqual({
      done: 2,
      total: 2,
      stage: 2,
    })
  })
})

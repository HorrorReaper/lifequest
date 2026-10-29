import { describe, expect, it } from 'vitest'
import {
  durationFigure,
  formatRelativeMinutes,
  nextUpFor,
  plannedTaskProgress,
  openTasksBehind,
  splitPlanByTime,
  type PlanStatusBlock,
} from '@/lib/dashboard-plan'

function block(
  id: string,
  startTime: string,
  endTime: string,
  extra: Partial<PlanStatusBlock> = {}
): PlanStatusBlock {
  return { id, startTime, endTime, title: id, ...extra }
}

const at = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

describe('splitPlanByTime', () => {
  it('sorts blocks into behind, now and ahead by the clock', () => {
    const split = splitPlanByTime(
      [block('c', '14:00', '15:00'), block('a', '08:00', '09:00'), block('b', '10:00', '12:00')],
      at('11:00')
    )
    expect(split.ordered.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(split.past.map((b) => b.id)).toEqual(['a'])
    expect(split.current?.id).toBe('b')
    expect(split.upcoming.map((b) => b.id)).toEqual(['c'])
  })
})

describe('nextUpFor', () => {
  const base = { nowMinutes: at('12:00'), openTaskCount: 3, openHabits: 2 }

  it('asks for a first task on an empty account, and for a plan otherwise', () => {
    expect(nextUpFor({ ...base, blocks: [], openTaskCount: 0 }).kind).toBe('first-task')
    expect(nextUpFor({ ...base, blocks: [] }).kind).toBe('plan-day')
  })

  it('leads with the running block, then the next one', () => {
    const blocks = [block('now', '11:30', '12:30'), block('later', '14:00', '15:00')]
    expect(nextUpFor({ ...base, blocks })).toMatchObject({
      kind: 'current',
      minutesLeft: 30,
    })
    expect(nextUpFor({ ...base, blocks, nowMinutes: at('13:00') })).toMatchObject({
      kind: 'next',
      minutesUntil: 60,
    })
  })

  // The confirmed bug: once every block was over, the dashboard called the
  // day done while the tasks in those blocks were still open.
  it('never calls a day done just because every block is over', () => {
    const blocks = [
      block('a', '08:00', '09:00', { taskId: 't1', taskCompleted: false }),
      block('b', '09:00', '10:00', { taskId: 't2', taskCompleted: false }),
      block('c', '10:00', '11:00', { taskId: 't3', taskCompleted: true }),
    ]
    expect(nextUpFor({ ...base, blocks })).toMatchObject({
      kind: 'open-after-plan',
      moreOpen: 1,
    })
  })

  it('reports the plan as over -- not as done -- when no linked task is open', () => {
    const blocks = [block('a', '08:00', '09:00'), block('b', '09:00', '10:00', { taskId: 't1', taskCompleted: true })]
    expect(nextUpFor({ ...base, blocks })).toEqual({ kind: 'plan-finished', openHabits: 2 })
  })
})

describe('nextUpFor, tasks and reflections', () => {
  const base = { nowMinutes: at('12:00'), openTaskCount: 3, openHabits: 0 }
  const reflection = (templateId: string, written: boolean) => ({
    templateId,
    title: templateId,
    written,
  })

  it('names the tasks due today when there is no plan yet', () => {
    expect(
      nextUpFor({ ...base, blocks: [], dueTodayCount: 4, overdueCount: 1 })
    ).toEqual({ kind: 'tasks-due', dueToday: 4, overdue: 1 })
    // Open tasks without a due date still only ask for a plan.
    expect(nextUpFor({ ...base, blocks: [] }).kind).toBe('plan-day')
  })

  it('carries how long the running block is, for its progress', () => {
    expect(
      nextUpFor({ ...base, blocks: [block('now', '11:30', '13:00')] })
    ).toMatchObject({ kind: 'current', minutesLeft: 60, durationMinutes: 90 })
  })

  it('counts the planned tasks behind an open one', () => {
    const blocks = [
      block('a', '08:00', '09:00', { taskId: 't1', taskCompleted: false }),
      block('b', '09:00', '10:00', { taskId: 't2', taskCompleted: true }),
      block('c', '10:00', '10:30', { taskId: 't2', taskCompleted: true }),
    ]
    expect(nextUpFor({ ...base, blocks })).toMatchObject({
      kind: 'open-after-plan',
      plannedTasks: 2,
      plannedDone: 1,
    })
  })

  it('puts open habits before reflections', () => {
    const blocks = [block('a', '08:00', '09:00')]
    expect(
      nextUpFor({ ...base, blocks, openHabits: 2, reflections: [reflection('j1', false)] })
    ).toEqual({ kind: 'plan-finished', openHabits: 2 })
  })

  it('points at the first unwritten reflection, then says the journal is done', () => {
    const blocks = [block('a', '08:00', '09:00')]
    expect(
      nextUpFor({
        ...base,
        blocks,
        reflections: [reflection('j1', true), reflection('j2', false)],
      })
    ).toEqual({
      kind: 'journal-open',
      reflection: reflection('j2', false),
      planned: 2,
      written: 1,
    })
    expect(
      nextUpFor({ ...base, blocks, reflections: [reflection('j1', true)] })
    ).toEqual({ kind: 'journal-done', written: 1 })
    expect(nextUpFor({ ...base, blocks })).toEqual({ kind: 'plan-finished', openHabits: 0 })
  })
})

describe('plannedTaskProgress', () => {
  it('counts each linked task once and skips blocks without one', () => {
    expect(
      plannedTaskProgress([
        block('a', '08:00', '09:00', { taskId: 't1', taskCompleted: true }),
        block('b', '09:00', '10:00', { taskId: 't1', taskCompleted: true }),
        block('c', '10:00', '11:00', { taskId: 't2', taskCompleted: false }),
        block('d', '11:00', '12:00'),
      ])
    ).toEqual({ planned: 2, done: 1 })
  })
})

describe('durationFigure', () => {
  it('splits a duration into a figure and its unit', () => {
    expect(durationFigure(45)).toEqual({ value: '45', unit: 'min' })
    expect(durationFigure(80)).toEqual({ value: '1 h 20', unit: 'min' })
    expect(durationFigure(120)).toEqual({ value: '2', unit: 'h' })
    expect(durationFigure(-4)).toEqual({ value: '0', unit: 'min' })
  })
})

describe('openTasksBehind', () => {
  it('counts each open linked task once and ignores blocks without a task', () => {
    const past = [
      block('a', '08:00', '09:00', { taskId: 't1', taskCompleted: false }),
      block('b', '09:00', '10:00', { taskId: 't1', taskCompleted: false }),
      block('c', '10:00', '11:00'),
      block('d', '11:00', '11:30', { taskId: 't2', taskCompleted: true }),
    ]
    expect(openTasksBehind(past).map((b) => b.id)).toEqual(['a'])
  })
})

describe('formatRelativeMinutes', () => {
  it('reads as minutes, then hours and minutes', () => {
    expect(formatRelativeMinutes(5)).toBe('5 min')
    expect(formatRelativeMinutes(60)).toBe('1 h')
    expect(formatRelativeMinutes(80)).toBe('1 h 20 min')
    expect(formatRelativeMinutes(-3)).toBe('0 min')
  })
})

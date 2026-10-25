import { describe, expect, it } from 'vitest'
import {
  buildOnboardingPlan,
  onboardingEndTime,
  suggestedStartTime,
} from '@/lib/onboarding'
import { plannedTaskIds } from '@/lib/day-plans'
import { parseTodayPlanNotes, serializeTodayPlanNotes, createDefaultTodayPlanMetadata } from '@/lib/today-plan'
import type { DayPlanBlock } from '@/lib/types'

describe('suggestedStartTime', () => {
  it('rounds up to the next quarter hour at least five minutes ahead', () => {
    expect(suggestedStartTime(14 * 60 + 7)).toBe('14:15')
    expect(suggestedStartTime(14 * 60 + 12)).toBe('14:30')
    expect(suggestedStartTime(14 * 60)).toBe('14:15')
  })

  it('stops at 23:30 late at night so a block still fits', () => {
    expect(suggestedStartTime(23 * 60 + 50)).toBe('23:30')
  })
})

describe('onboardingEndTime', () => {
  it('adds the length and keeps the block inside the day', () => {
    expect(onboardingEndTime('15:00', 25)).toBe('15:25')
    expect(onboardingEndTime('23:50', 60)).toBe('23:59')
    expect(onboardingEndTime('nope', 25)).toBeNull()
  })
})

describe('buildOnboardingPlan', () => {
  const now = new Date('2026-10-25T10:00:00Z')

  it('links the block to the task and makes it the main priority', () => {
    const plan = buildOnboardingPlan({
      existingBlocks: [],
      existingNotes: null,
      taskId: 'task-1',
      title: 'Pay the bill',
      start: '19:00',
      end: '19:25',
      now,
    })
    expect(plan.blocks).toEqual([
      expect.objectContaining({ id: 'onboarding-task-1', source_type: 'task', source_id: 'task-1' }),
    ])
    const metadata = parseTodayPlanNotes(plan.notes).metadata
    expect(metadata?.outcomes).toEqual([
      expect.objectContaining({ role: 'must_win', task_id: 'task-1', duration_minutes: 25 }),
    ])
    // Widened to hold an evening block, and marked as planned.
    expect(metadata?.day_end).toBe('19:25')
    expect(metadata?.ritual_completed_at).toBe(now.toISOString())
  })

  it('is idempotent: running it again replaces its own block, keeps the rest', () => {
    const other: DayPlanBlock = {
      id: 'mine',
      start_time: '09:00',
      end_time: '10:00',
      title: 'Existing',
      category: 'other',
    }
    const first = buildOnboardingPlan({
      existingBlocks: [other],
      existingNotes: serializeTodayPlanNotes(createDefaultTodayPlanMetadata()),
      taskId: 'task-1',
      title: 'Pay the bill',
      start: '11:00',
      end: '11:25',
      now,
    })
    const second = buildOnboardingPlan({
      existingBlocks: first.blocks,
      existingNotes: first.notes,
      taskId: 'task-1',
      title: 'Pay the bill',
      start: '12:00',
      end: '12:15',
      now,
    })
    expect(second.blocks.map((b) => b.id)).toEqual(['mine', 'onboarding-task-1'])
    expect(second.blocks[1].start_time).toBe('12:00')
    expect(plannedTaskIds(second.blocks)).toEqual(['task-1'])
  })
})

describe('plannedTaskIds', () => {
  it('lists linked tasks once, in block order, and skips other blocks', () => {
    const blocks = [
      { id: 'a', start_time: '08:00', end_time: '09:00', title: 'A', category: 'other', source_type: 'task', source_id: 't2' },
      { id: 'b', start_time: '09:00', end_time: '10:00', title: 'B', category: 'other', source_type: 'manual', source_id: 'x' },
      { id: 'c', start_time: '10:00', end_time: '11:00', title: 'C', category: 'other', source_type: 'task', source_id: 't2' },
      { id: 'd', start_time: '11:00', end_time: '12:00', title: 'D', category: 'other', source_type: 'task', source_id: 't1' },
    ] as DayPlanBlock[]
    expect(plannedTaskIds(blocks)).toEqual(['t2', 't1'])
    expect(plannedTaskIds(null)).toEqual([])
  })
})

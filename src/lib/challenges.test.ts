import { describe, expect, it } from 'vitest'
import { getChallengeView, getProgramDayState, sortChallengePrograms } from '@/lib/challenges'
import type { ChallengeProgram } from '@/lib/challenge-programs'

function program(
  patch: {
    scheduleMode?: 'sequential' | 'strict'
    startDate?: string
    completedDayNumbers?: number[]
    status?: 'active' | 'completed'
  } = {}
): ChallengeProgram {
  const {
    scheduleMode = 'strict',
    startDate = '2026-07-20',
    completedDayNumbers = [],
    status = 'active',
  } = patch

  return {
    template: {
      id: 'template-1',
      created_by: 'admin-1',
      title: '7 days of focus',
      description: null,
      duration_days: 7,
      schedule_mode: scheduleMode,
      xp_reward: 200,
      coin_reward: 80,
      is_published: true,
      is_personal: false,
      slug: null,
      tagline: null,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
    },
    days: [],
    enrollment: {
      id: 'enrollment-1',
      template_id: 'template-1',
      user_id: 'user-1',
      start_date: startDate,
      status,
      completed_at: null,
      created_at: '2026-07-20T00:00:00Z',
      updated_at: '2026-07-20T00:00:00Z',
    },
    progress: completedDayNumbers.map((dayNumber) => ({
      id: `progress-${dayNumber}`,
      enrollment_id: 'enrollment-1',
      challenge_day_id: `day-${dayNumber}`,
      user_id: 'user-1',
      day_number: dayNumber,
      completed_on: `2026-07-${String(19 + dayNumber).padStart(2, '0')}`,
      note: null,
      journal_entry_id: null,
      created_at: '2026-07-20T10:00:00Z',
    })),
  }
}

describe('getProgramDayState', () => {
  it('advances to the next day after each completion', () => {
    expect(
      getProgramDayState(program({ completedDayNumbers: [1, 2] }), '2026-07-22')
        .currentDayNumber
    ).toBe(3)
  })

  it('does not run past the final day', () => {
    expect(
      getProgramDayState(
        program({ completedDayNumbers: [1, 2, 3, 4, 5, 6, 7] }),
        '2026-07-26'
      ).currentDayNumber
    ).toBe(7)
  })

  it('marks the day done when the given day is already logged', () => {
    const state = getProgramDayState(
      program({ completedDayNumbers: [1] }),
      '2026-07-20'
    )

    expect(state.checkedToday).toBe(true)
  })

  it('does not consider a strict schedule missed while the user is on track', () => {
    // Day 1 done on the 20th, and it is the 21st: day 2 is due today.
    expect(
      getProgramDayState(program({ completedDayNumbers: [1] }), '2026-07-21')
        .strictMissed
    ).toBe(false)
  })

  it('flags a strict schedule as missed once a calendar day is skipped', () => {
    // Day 1 done on the 20th, but it is already the 22nd.
    expect(
      getProgramDayState(program({ completedDayNumbers: [1] }), '2026-07-22')
        .strictMissed
    ).toBe(true)
  })

  it('never flags a sequential schedule as missed', () => {
    expect(
      getProgramDayState(
        program({ scheduleMode: 'sequential', completedDayNumbers: [1] }),
        '2026-07-30'
      ).strictMissed
    ).toBe(false)
  })

  it('never flags a completed program as missed', () => {
    expect(
      getProgramDayState(
        program({ completedDayNumbers: [1], status: 'completed' }),
        '2026-07-30'
      ).strictMissed
    ).toBe(false)
  })

  it('reports no enrollment as an unstarted program', () => {
    const unstarted = { ...program(), enrollment: null }
    const state = getProgramDayState(unstarted, '2026-07-22')

    expect(state.strictMissed).toBe(false)
    expect(state.currentDayNumber).toBe(1)
  })
})

describe('getChallengeView', () => {
  function withDays(base: ChallengeProgram): ChallengeProgram {
    return {
      ...base,
      days: Array.from({ length: 7 }, (_, index) => ({
        id: `day-${index + 1}`,
        template_id: 'template-1',
        day_number: index + 1,
        title: `Day ${index + 1}`,
        instructions: 'Do it',
        reflection_prompt: null,
        completion_type: index === 1 ? ('habits_active' as const) : ('manual' as const),
        completion_target: index === 1 ? 3 : 1,
        completion_param: null,
        action_href: null,
        action_label: null,
        created_at: '2026-07-01T00:00:00Z',
      })),
    }
  }

  it('reports a program nobody started', () => {
    const view = getChallengeView({ ...withDays(program()), enrollment: null, progress: [] }, '2026-07-20')
    expect(view.status).toBe('not_started')
    expect(view.currentDayNumber).toBe(1)
  })

  it('takes rule progress from the matching sync row only', () => {
    const base = withDays(program({ scheduleMode: 'sequential', completedDayNumbers: [1] }))
    const sync = {
      enrollment_id: 'enrollment-1',
      day_number: 2,
      completion_type: 'habits_active' as const,
      progress: 2,
      target: 3,
      met: false,
      available_from: '2026-07-21',
      completed_now: false,
      challenge_completed: false,
    }
    const view = getChallengeView(base, '2026-07-21', sync)
    expect(view.automatic).toBe(true)
    expect(view.ruleProgress).toBe(2)
    expect(view.ruleTarget).toBe(3)

    const stale = getChallengeView(base, '2026-07-21', { ...sync, day_number: 5 })
    expect(stale.ruleProgress).toBe(0)
    expect(stale.ruleTarget).toBe(3)
  })

  it('flags a day the sync just completed', () => {
    const base = withDays(program({ scheduleMode: 'sequential', completedDayNumbers: [1, 2] }))
    const view = getChallengeView(base, '2026-07-21', {
      enrollment_id: 'enrollment-1',
      day_number: 3,
      completion_type: 'manual',
      progress: 0,
      target: 1,
      met: false,
      available_from: '2026-07-22',
      completed_now: true,
      challenge_completed: false,
    })
    expect(view.justCompleted).toBe(true)
    expect(view.doneToday).toBe(true)
  })
})

describe('sortChallengePrograms', () => {
  it('puts running challenges first, then new, then finished', () => {
    const active = program()
    const fresh = { ...program(), template: { ...program().template, id: 'fresh' }, enrollment: null }
    const done = { ...program({ status: 'completed' }), template: { ...program().template, id: 'done' } }
    expect(sortChallengePrograms([done, fresh, active]).map((item) => item.template.id)).toEqual([
      'template-1',
      'fresh',
      'done',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { getChallengeProgress, getProgramDayState } from '@/lib/challenges'
import type { ChallengeProgram, CustomQuest } from '@/lib/quests'

function challengeQuest(patch: Partial<CustomQuest> = {}): CustomQuest {
  return {
    id: 'quest-1',
    user_id: 'user-1',
    title: 'Cold shower',
    description: null,
    xp_reward: 50,
    coin_reward: 20,
    quest_type: 'daily_challenge',
    challenge_days: 3,
    challenge_task: 'Take a cold shower',
    challenge_start_date: '2026-07-20',
    is_completed: false,
    completed_at: null,
    created_at: '2026-07-20T08:00:00Z',
    updated_at: '2026-07-20T08:00:00Z',
    daily_logs: [],
    ...patch,
  }
}

function log(date: string) {
  return {
    id: `log-${date}`,
    quest_id: 'quest-1',
    user_id: 'user-1',
    log_date: date,
    note: null,
    created_at: `${date}T09:00:00Z`,
  }
}

describe('getChallengeProgress', () => {
  it('ignores quests that are not daily challenges', () => {
    expect(
      getChallengeProgress(challengeQuest({ quest_type: 'single' }), '2026-07-21')
    ).toBeNull()
  })

  it('closes the window on the last day of the challenge', () => {
    // A 3-day challenge starting on the 20th runs through the 22nd.
    const quest = challengeQuest()

    expect(getChallengeProgress(quest, '2026-07-22')?.insideWindow).toBe(true)
    expect(getChallengeProgress(quest, '2026-07-23')?.insideWindow).toBe(false)
  })

  it('has not started before the start date', () => {
    expect(
      getChallengeProgress(challengeQuest(), '2026-07-19')?.insideWindow
    ).toBe(false)
  })

  it('recognises a check-in for the given day only', () => {
    const quest = challengeQuest({ daily_logs: [log('2026-07-21')] })

    expect(getChallengeProgress(quest, '2026-07-21')?.checkedToday).toBe(true)
    expect(getChallengeProgress(quest, '2026-07-22')?.checkedToday).toBe(false)
  })

  it('counts only logs that fall inside the window', () => {
    const quest = challengeQuest({
      daily_logs: [log('2026-07-19'), log('2026-07-20'), log('2026-07-23')],
    })

    expect(getChallengeProgress(quest, '2026-07-21')?.completedDays).toBe(1)
  })

  it('is ready once every required day is logged', () => {
    const quest = challengeQuest({
      daily_logs: [log('2026-07-20'), log('2026-07-21'), log('2026-07-22')],
    })

    expect(getChallengeProgress(quest, '2026-07-22')?.ready).toBe(true)
  })

  it('caps the percentage at 100', () => {
    const quest = challengeQuest({
      challenge_days: 2,
      daily_logs: [log('2026-07-20'), log('2026-07-21')],
    })

    expect(getChallengeProgress(quest, '2026-07-21')?.percent).toBe(100)
  })
})

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

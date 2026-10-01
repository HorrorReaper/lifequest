import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChallengeProgram } from '@/lib/challenge-programs'
import { getChallengeView } from '@/lib/challenges'
import type { ChallengeDayRow } from '@/lib/supabase/database.types'

const refresh = vi.fn()
const push = vi.fn()
const rpc = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }))

const { ChallengeTodayPanel } = await import('@/components/challenges/ChallengeTodayPanel')

function challengeDay(dayNumber: number, patch: Partial<ChallengeDayRow> = {}): ChallengeDayRow {
  return {
    id: `day-${dayNumber}`,
    template_id: 'template-1',
    day_number: dayNumber,
    title: `Day ${dayNumber} title`,
    instructions: `Instructions for day ${dayNumber}`,
    reflection_prompt: null,
    completion_type: 'manual',
    completion_target: 1,
    completion_param: null,
    action_href: null,
    action_label: null,
    created_at: '2026-09-01T00:00:00Z',
    ...patch,
  }
}

function program(completed: number[] = [], enrolled = true): ChallengeProgram {
  return {
    template: {
      id: 'template-1',
      created_by: 'admin',
      title: 'Unfuck Your Life',
      description: null,
      duration_days: 3,
      schedule_mode: 'sequential',
      xp_reward: 1000,
      coin_reward: 500,
      is_published: true,
      is_personal: false,
      slug: 'unfuck-your-life',
      tagline: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    days: [
      challengeDay(1, { reflection_prompt: 'What did you notice?' }),
      challengeDay(2, { completion_type: 'habits_active', completion_target: 3 }),
      challengeDay(3),
    ],
    enrollment: enrolled
      ? {
          id: 'enrollment-1',
          template_id: 'template-1',
          user_id: 'user-1',
          start_date: '2026-09-28',
          status: 'active',
          completed_at: null,
          created_at: '2026-09-28T00:00:00Z',
          updated_at: '2026-09-28T00:00:00Z',
        }
      : null,
    progress: completed.map((dayNumber) => ({
      id: `p-${dayNumber}`,
      enrollment_id: 'enrollment-1',
      challenge_day_id: `day-${dayNumber}`,
      user_id: 'user-1',
      day_number: dayNumber,
      completed_on: `2026-09-${27 + dayNumber}`,
      note: null,
      created_at: '2026-09-28T00:00:00Z',
    })),
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ChallengeTodayPanel', () => {
  it('offers to start a challenge nobody has joined', async () => {
    rpc.mockResolvedValue({ data: [{ enrollment_id: 'e', start_date: '2026-09-30', status: 'active' }], error: null })
    const item = program([], false)
    render(<ChallengeTodayPanel program={item} view={getChallengeView(item, '2026-09-30')} />)

    fireEvent.click(screen.getByRole('button', { name: /start challenge/i }))

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('start_challenge_program', { p_template_id: 'template-1' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('lets a manual day be ticked off with a note', async () => {
    rpc.mockResolvedValue({
      data: [{ completed_day: 1, completed_days: 1, total_days: 3, completion_date: '2026-09-28', challenge_completed: false, total_xp: 10, coins: 5 }],
      error: null,
    })
    const item = program()
    render(<ChallengeTodayPanel program={item} view={getChallengeView(item, '2026-09-28')} />)

    expect(screen.getByText('Day 1 title')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/reflection note/i), { target: { value: 'Felt good' } })
    fireEvent.click(screen.getByRole('button', { name: /mark day as done/i }))

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('complete_challenge_program_day', { p_enrollment_id: 'enrollment-1', p_note: 'Felt good' })
    )
    expect(await screen.findByText('Day 1 done.')).toBeTruthy()
  })

  it('shows detected progress and a deep link on an automatic day, without a manual tick', () => {
    const item = program([1])
    const view = getChallengeView(item, '2026-09-29', {
      enrollment_id: 'enrollment-1',
      day_number: 2,
      completion_type: 'habits_active',
      progress: 1,
      target: 3,
      met: false,
      available_from: '2026-09-29',
      completed_now: false,
      challenge_completed: false,
    })
    render(<ChallengeTodayPanel program={item} view={view} />)

    expect(screen.getByText('1 / 3 active habits')).toBeTruthy()
    expect(screen.getByRole('link', { name: /open habits/i }).getAttribute('href')).toBe('/habits')
    expect(screen.queryByRole('button', { name: /mark day as done/i })).toBeNull()
    expect(screen.getByRole('button', { name: /check progress/i })).toBeTruthy()
  })

  it('opens a tool day with the challenge attached, so the tool can lead back', () => {
    const item = program()
    item.days[0] = challengeDay(1, { completion_type: 'tool_entries', completion_param: 'vision', action_label: 'Open Vision' })
    render(<ChallengeTodayPanel program={item} view={getChallengeView(item, '2026-09-28')} />)

    expect(screen.getByRole('link', { name: /open vision/i }).getAttribute('href')).toBe(
      '/learn/tools/vision?challenge=template-1'
    )
  })

  it('says what is left when a progress check finds the day not done', async () => {
    rpc.mockResolvedValue({
      data: [{ enrollment_id: 'enrollment-1', day_number: 2, completion_type: 'habits_active', progress: 2, target: 3, met: false, available_from: '2026-09-29', completed_now: false, challenge_completed: false }],
      error: null,
    })
    const item = program([1])
    render(<ChallengeTodayPanel program={item} view={getChallengeView(item, '2026-09-29')} />)

    fireEvent.click(screen.getByRole('button', { name: /check progress/i }))

    expect(await screen.findByText('Not yet: 2 / 3 active habits.')).toBeTruthy()
  })

  it('points at tomorrow once today is done', () => {
    const item = program([1])
    render(<ChallengeTodayPanel program={item} view={getChallengeView(item, '2026-09-28')} />)

    expect(screen.getByText('Day 1 is done.')).toBeTruthy()
    expect(screen.getByText('Day 2 title')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

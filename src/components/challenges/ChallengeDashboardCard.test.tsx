import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChallengeProgram } from '@/lib/challenge-programs'
import { getChallengeView } from '@/lib/challenges'
import { GOAL_FORM_HREF } from '@/lib/goals'
import type { ChallengeDayRow } from '@/lib/supabase/database.types'
import { ChallengeDashboardCard, challengeCardContent } from './ChallengeDashboardCard'

afterEach(cleanup)

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
    image_url: null,
    created_at: '2026-09-01T00:00:00Z',
    ...patch,
  }
}

/** Sequential, started 2026-09-28; day N was completed on 2026-09-(27+N). */
function program(
  completed: number[],
  { days, cover = null, status = 'active' }: { days?: ChallengeDayRow[]; cover?: string | null; status?: string } = {}
): ChallengeProgram {
  return {
    template: {
      id: 'template-1',
      created_by: 'admin',
      title: '14 Days to Unfuck Your Life',
      description: null,
      duration_days: 3,
      schedule_mode: 'sequential',
      xp_reward: 1000,
      coin_reward: 500,
      is_published: true,
      is_personal: false,
      slug: null,
      tagline: null,
      cover_image_url: cover,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    days: days ?? [challengeDay(1), challengeDay(2), challengeDay(3)],
    enrollment: {
      id: 'enrollment-1',
      template_id: 'template-1',
      user_id: 'user-1',
      start_date: '2026-09-28',
      status: status as 'active',
      completed_at: null,
      created_at: '2026-09-28T00:00:00Z',
      updated_at: '2026-09-28T00:00:00Z',
    },
    progress: completed.map((dayNumber) => ({
      id: `p-${dayNumber}`,
      enrollment_id: 'enrollment-1',
      challenge_day_id: `day-${dayNumber}`,
      user_id: 'user-1',
      day_number: dayNumber,
      completed_on: `2026-09-${27 + dayNumber}`,
      note: null,
      journal_entry_id: null,
      created_at: '2026-09-28T00:00:00Z',
    })),
  }
}

function renderCard(item: ChallengeProgram, today = '2026-09-30') {
  render(<ChallengeDashboardCard program={item} view={getChallengeView(item, today)} />)
  return screen.getByRole('link')
}

describe('ChallengeDashboardCard', () => {
  it("shows the challenge, today's step and the day, as one link", () => {
    const link = renderCard(program([1, 2], { days: [challengeDay(1), challengeDay(2), challengeDay(3, { title: 'Turn your vision into SMART goals' })] }))

    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(link.textContent).toContain('14 Days to Unfuck Your Life')
    expect(link.textContent).toContain('Turn your vision into SMART goals')
    expect(link.textContent).toContain('Day 3 / 3')
    // The instructions and buttons stay on the challenge page.
    expect(link.textContent).not.toContain('Instructions for day 3')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('goes straight to the goal form on a goals day', () => {
    const link = renderCard(
      program([1, 2], { days: [challengeDay(1), challengeDay(2), challengeDay(3, { completion_type: 'goals_created' })] })
    )
    expect(link.getAttribute('href')).toBe(GOAL_FORM_HREF)
  })

  it("opens a tool day's tool, with the way back to the challenge", () => {
    const link = renderCard(
      program([1, 2], {
        days: [challengeDay(1), challengeDay(2), challengeDay(3, { completion_type: 'tool_entries', completion_param: 'wheel-of-life' })],
      })
    )
    expect(link.getAttribute('href')).toBe('/learn/tools/wheel-of-life?challenge=template-1')
  })

  it('opens the challenge when the day has no step of its own', () => {
    // A manual day with no link: ticking it off happens on the challenge page.
    const link = renderCard(program([1, 2]))
    expect(link.getAttribute('href')).toBe('/challenges/template-1')
  })

  it('says the day is done, names tomorrow, and opens the challenge', () => {
    const link = renderCard(program([1, 2], { days: [challengeDay(1), challengeDay(2), challengeDay(3, { title: 'Break goals down' })] }), '2026-09-29')

    expect(link.textContent).toContain('Day 2 done')
    expect(link.textContent).toContain('Tomorrow: Break goals down')
    expect(link.textContent).toContain('Day 2 / 3')
    expect(link.getAttribute('href')).toBe('/challenges/template-1')
  })

  it('celebrates a finished challenge', () => {
    const item = program([1, 2, 3], { status: 'completed' })
    const content = challengeCardContent(item, getChallengeView(item, '2026-10-01'))

    expect(content).toMatchObject({ headline: 'Challenge complete', dayLabel: '3 / 3', href: '/challenges/template-1' })
  })

  it("uses the day's image, else the challenge cover, as the background", () => {
    const withDayImage = program([1, 2], {
      cover: 'https://images.unsplash.com/cover.jpg',
      days: [challengeDay(1), challengeDay(2), challengeDay(3, { image_url: 'https://images.unsplash.com/day-3.jpg' })],
    })
    renderCard(withDayImage)
    expect(document.querySelector('img')?.getAttribute('src')).toContain('day-3.jpg')
    cleanup()

    renderCard(program([1, 2], { cover: 'https://images.unsplash.com/cover.jpg' }))
    expect(document.querySelector('img')?.getAttribute('src')).toContain('cover.jpg')
  })
})

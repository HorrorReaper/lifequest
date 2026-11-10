import { describe, expect, it, vi } from 'vitest'
import { activationRate, buildActivationSteps } from '@/lib/activation'
import { feedbackPagePath, sendFeedback } from '@/lib/feedback'

describe('buildActivationSteps', () => {
  it('orders the funnel and reads bigint strings as numbers', () => {
    const steps = buildActivationSteps([
      {
        signed_up: '10',
        onboarding_completed: 8,
        first_task: 8,
        first_plan: 7,
        first_habit_checkin: 4,
        returned_later_day: 3,
      },
    ])
    expect(steps?.map((step) => [step.key, step.count])).toEqual([
      ['signed_up', 10],
      ['onboarding_completed', 8],
      ['first_task', 8],
      ['first_plan', 7],
      ['first_habit_checkin', 4],
      ['returned_later_day', 3],
    ])
    expect(activationRate(steps![4], 10)).toBe(40)
  })

  it('returns null without a row, and zero rates without sign-ups', () => {
    expect(buildActivationSteps(null)).toBeNull()
    expect(buildActivationSteps([])).toBeNull()
    expect(activationRate({ key: 'first_task', label: '', count: 3 }, 0)).toBe(0)
  })
})

describe('feedback', () => {
  it('keeps only the path of the page, never its query string', () => {
    expect(feedbackPagePath('/tasks?new=1#x')).toBe('/tasks')
    expect(feedbackPagePath(null)).toBeNull()
  })

  it('sends the category, trimmed message and path, and refuses an empty message', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ insert })) }

    await sendFeedback(supabase as never, {
      category: 'problem',
      message: '  Calendar hidden  ',
      pagePath: '/tasks?new=1',
    })
    expect(supabase.from).toHaveBeenCalledWith('beta_feedback')
    expect(insert).toHaveBeenCalledWith({
      category: 'problem',
      message: 'Calendar hidden',
      page_path: '/tasks',
    })

    await expect(
      sendFeedback(supabase as never, { category: 'idea', message: '   ', pagePath: null })
    ).rejects.toThrow()
  })
})

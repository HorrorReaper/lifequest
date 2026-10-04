import { describe, expect, it } from 'vitest'
import {
  DAY_INSTRUCTIONS_PLACEHOLDER,
  blankChallengeDraft,
  blankDay,
  draftDaysPayload,
  draftFromTemplate,
  unfuckYourLifeDraft,
  validateChallengeDraft,
} from '@/lib/challenge-draft'

function validDraft() {
  return { ...blankChallengeDraft(), title: 'Test', days: [blankDay({ title: 'A', instructions: 'Do A' })] }
}

describe('validateChallengeDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateChallengeDraft(validDraft())).toBeNull()
  })

  it('names the day that is missing something', () => {
    const draft = validDraft()
    draft.days.push(blankDay({ title: 'B' }))
    expect(validateChallengeDraft(draft)).toBe('Day 2 needs instructions.')
  })

  it('rejects a bad public link', () => {
    expect(validateChallengeDraft({ ...validDraft(), slug: 'Not A Slug' })).toMatch(/public link/)
  })

  it('requires a tool for a tool rule', () => {
    const draft = validDraft()
    draft.days[0] = { ...draft.days[0], completion_type: 'tool_entries' }
    expect(validateChallengeDraft(draft)).toBe('Day 1: pick the tool.')
  })

  it('rejects a button link that leaves the app', () => {
    const draft = validDraft()
    draft.days[0] = { ...draft.days[0], action_href: '//evil.example' }
    expect(validateChallengeDraft(draft)).toMatch(/button link/)
  })

  it('never publishes a day that still carries the placeholder', () => {
    const draft = { ...validDraft(), days: [blankDay({ title: 'A', instructions: DAY_INSTRUCTIONS_PLACEHOLDER })] }
    expect(validateChallengeDraft(draft)).toBeNull()
    expect(validateChallengeDraft(draft, { publishing: true })).toBe(
      'Day 1 still needs its instructions before the challenge can go live.'
    )
  })

  it('accepts images from allowed hosts and names the day with a bad one', () => {
    const draft = { ...validDraft(), cover_image_url: 'https://images.unsplash.com/photo-1' }
    draft.days[0] = { ...draft.days[0], image_url: 'https://images.unsplash.com/photo-2' }
    expect(validateChallengeDraft(draft)).toBeNull()
    expect(validateChallengeDraft({ ...draft, cover_image_url: 'https://evil.example/a.png' })).toMatch(/images must be https links/i)
    draft.days[0] = { ...draft.days[0], image_url: 'http://images.unsplash.com/photo-2' }
    expect(validateChallengeDraft(draft)).toMatch(/^Day 1: images must be https links/)
  })

  it('requires the question on a reflection day', () => {
    const draft = validDraft()
    draft.days[0] = { ...draft.days[0], completion_type: 'reflection' }
    expect(validateChallengeDraft(draft)).toBe('Day 1: a reflection day needs the question to answer.')
    draft.days[0] = { ...draft.days[0], reflection_prompt: 'How did it go?' }
    expect(validateChallengeDraft(draft)).toBeNull()
  })
})

describe('unfuckYourLifeDraft', () => {
  it('is a complete, publishable 14-day draft that starts unpublished', () => {
    const draft = unfuckYourLifeDraft()
    expect(draft.title).toBe('14 Days to Unfuck Your Life')
    expect(draft.slug).toBe('unfuck-your-life')
    expect(draft.days).toHaveLength(14)
    expect(draft.is_published).toBe(false)
    expect(validateChallengeDraft(draft, { publishing: true })).toBeNull()
  })

  it('follows the agreed arc, detected automatically wherever the app can', () => {
    const rules = unfuckYourLifeDraft().days.map((day) =>
      day.completion_param ? `${day.completion_type}:${day.completion_param}` : day.completion_type
    )
    expect(rules).toEqual([
      'tool_entries:wheel-of-life',
      'tool_entries:vision',
      'goals_created',
      'tool_entries:goal-breakdown',
      'habits_created',
      'manual',
      'tool_entries:identity',
      'journal_entries:a7d4e2b1-3c6f-4e8a-9b05-2f1d8c7e6a02',
      'manual',
      'tool_entries:time-audit',
      'tool_entries:environment-audit',
      'tool_entries:limiting-beliefs',
      'tool_entries:wheel-of-life',
      'reflection',
    ])
  })

  it('only points at tools that exist', async () => {
    const { TOOL_REGISTRY } = await import('@/lib/tools/registry')
    const toolIds = new Set(TOOL_REGISTRY.map((tool) => tool.id))
    for (const day of unfuckYourLifeDraft().days) {
      if (day.completion_type === 'tool_entries') expect(toolIds.has(day.completion_param)).toBe(true)
    }
  })
})

describe('draftDaysPayload', () => {
  it('drops parameters a rule does not take and normalises manual targets', () => {
    const payload = draftDaysPayload([
      blankDay({ title: ' A ', instructions: ' x ', completion_type: 'manual', completion_target: 5, completion_param: 'junk' }),
      blankDay({ title: 'B', instructions: 'y', completion_type: 'tool_entries', completion_target: 2, completion_param: 'vision' }),
    ])
    expect(payload[0]).toMatchObject({ title: 'A', instructions: 'x', completion_target: 1, completion_param: '' })
    expect(payload[1]).toMatchObject({ completion_type: 'tool_entries', completion_target: 2, completion_param: 'vision' })
    expect(payload[0].image_url).toBe('')
  })
})

describe('draftFromTemplate', () => {
  it('orders days and fills defaults for older rows', () => {
    const draft = draftFromTemplate(
      {
        id: 't',
        created_by: 'a',
        title: 'T',
        description: null,
        duration_days: 2,
        schedule_mode: 'sequential',
        xp_reward: 1,
        coin_reward: 1,
        is_published: true,
        is_personal: false,
        slug: null,
        tagline: null,
        cover_image_url: null,
        created_at: '',
        updated_at: '',
      },
      [
        { id: 'd2', template_id: 't', day_number: 2, title: 'Second', instructions: 'b', reflection_prompt: null, completion_type: 'day_plans', completion_target: 1, completion_param: null, action_href: null, action_label: null, image_url: null, created_at: '' },
        { id: 'd1', template_id: 't', day_number: 1, title: 'First', instructions: 'a', reflection_prompt: 'Why?', completion_type: 'manual', completion_target: 1, completion_param: null, action_href: '/plan', action_label: null, image_url: null, created_at: '' },
      ]
    )
    expect(draft.days.map((day) => day.title)).toEqual(['First', 'Second'])
    expect(draft.days[0]).toMatchObject({ reflection_prompt: 'Why?', action_href: '/plan', action_label: '' })
    expect(draft.slug).toBe('')
  })
})

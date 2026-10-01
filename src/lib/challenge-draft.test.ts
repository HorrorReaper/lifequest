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

  it('saves the Unfuck Your Life frame as a draft but will not publish it unwritten', () => {
    const draft = unfuckYourLifeDraft()
    expect(draft.days).toHaveLength(14)
    expect(draft.slug).toBe('unfuck-your-life')
    expect(draft.days[0]).toMatchObject({
      title: 'Write down your vision',
      completion_type: 'tool_entries',
      completion_param: 'vision',
    })
    expect(draft.is_published).toBe(false)
    expect(validateChallengeDraft(draft)).toBeNull()
    expect(validateChallengeDraft(draft, { publishing: true })).toBe(
      'Day 1 still needs its instructions before the challenge can go live.'
    )
  })

  it('publishes once every placeholder is replaced', () => {
    const draft = unfuckYourLifeDraft()
    draft.days = draft.days.map((day) => ({ ...day, instructions: 'Real content' }))
    expect(validateChallengeDraft(draft, { publishing: true })).toBeNull()
    expect(draft.days.every((day) => day.instructions !== DAY_INSTRUCTIONS_PLACEHOLDER)).toBe(true)
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
        created_at: '',
        updated_at: '',
      },
      [
        { id: 'd2', template_id: 't', day_number: 2, title: 'Second', instructions: 'b', reflection_prompt: null, completion_type: 'day_plans', completion_target: 1, completion_param: null, action_href: null, action_label: null, created_at: '' },
        { id: 'd1', template_id: 't', day_number: 1, title: 'First', instructions: 'a', reflection_prompt: 'Why?', completion_type: 'manual', completion_target: 1, completion_param: null, action_href: '/plan', action_label: null, created_at: '' },
      ]
    )
    expect(draft.days.map((day) => day.title)).toEqual(['First', 'Second'])
    expect(draft.days[0]).toMatchObject({ reflection_prompt: 'Why?', action_href: '/plan', action_label: '' })
    expect(draft.slug).toBe('')
  })
})

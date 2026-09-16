import { describe, expect, it } from 'vitest'
import {
  REFLECTION_PROMPTS,
  findReflectionPrompt,
  randomReflectionPrompt,
  reflectionPromptForDate,
  reflectionPromptStorageKey,
} from '@/lib/daily-reflection'
import { addDays } from '@/lib/dates'

describe('REFLECTION_PROMPTS', () => {
  it('gives every prompt a unique id, a theme, and a question', () => {
    const ids = REFLECTION_PROMPTS.map((prompt) => prompt.id)

    expect(REFLECTION_PROMPTS.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const prompt of REFLECTION_PROMPTS) {
      expect(prompt.theme.length).toBeGreaterThan(0)
      expect(prompt.text.trim().endsWith('?')).toBe(true)
    }
  })
})

describe('reflectionPromptForDate', () => {
  it('gives the same date the same prompt every time', () => {
    // Whatever else changes, two reads of one day must agree: the dashboard,
    // the entry form it opens, and the entry read back later all call this.
    expect(reflectionPromptForDate('2026-09-11')).toBe(
      reflectionPromptForDate('2026-09-11')
    )
  })

  it('moves to a different prompt the next day', () => {
    expect(reflectionPromptForDate('2026-09-11').id).not.toBe(
      reflectionPromptForDate('2026-09-12').id
    )
  })

  it('uses every prompt once before repeating any', () => {
    const start = '2026-09-11'
    const seen = REFLECTION_PROMPTS.map((_, offset) =>
      reflectionPromptForDate(addDays(start, offset)).id
    )

    expect(new Set(seen).size).toBe(REFLECTION_PROMPTS.length)
    // The cycle is the list length, so the day after the last one comes back
    // round to where it started.
    expect(reflectionPromptForDate(addDays(start, REFLECTION_PROMPTS.length)).id).toBe(
      seen[0]
    )
  })

  it('still returns a prompt for a date before the epoch', () => {
    // Day numbers go negative there and JS keeps the sign through %, which
    // would index off the front of the list.
    expect(REFLECTION_PROMPTS).toContain(reflectionPromptForDate('1969-07-20'))
  })
})

describe('randomReflectionPrompt', () => {
  it('gives back a real prompt', () => {
    expect(REFLECTION_PROMPTS).toContainEqual(randomReflectionPrompt())
  })

  it('never hands back the one it was told to move on from', () => {
    const current = REFLECTION_PROMPTS[0]
    for (let i = 0; i < 50; i++) {
      expect(randomReflectionPrompt(current.id).id).not.toBe(current.id)
    }
  })

  it('still returns something if the excluded id is not in the list', () => {
    expect(REFLECTION_PROMPTS).toContainEqual(randomReflectionPrompt('not-a-real-id'))
  })
})

describe('reflectionPromptStorageKey', () => {
  it('differs by date, so a new day is not stuck on yesterday’s pick', () => {
    expect(reflectionPromptStorageKey('user-1', '2026-09-11')).not.toBe(
      reflectionPromptStorageKey('user-1', '2026-09-12')
    )
  })

  it('differs by user, so a shared browser cannot leak one pick into another', () => {
    expect(reflectionPromptStorageKey('user-1', '2026-09-11')).not.toBe(
      reflectionPromptStorageKey('user-2', '2026-09-11')
    )
  })
})

describe('findReflectionPrompt', () => {
  it('resolves an id that is in the list', () => {
    const [first] = REFLECTION_PROMPTS
    expect(findReflectionPrompt(first.id)).toBe(first)
  })

  it('returns null for anything else, so a stale or forged link shows nothing', () => {
    expect(findReflectionPrompt('not-a-prompt')).toBeNull()
    expect(findReflectionPrompt('')).toBeNull()
    expect(findReflectionPrompt(null)).toBeNull()
    expect(findReflectionPrompt(undefined)).toBeNull()
  })
})

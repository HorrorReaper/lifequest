import { describe, expect, it } from 'vitest'
import type { ToolEntry } from '@/lib/tools/storage'
import { isLimitingBeliefPayload, toLimitingBeliefEntries } from './LimitingBeliefsTool'

function entry(payload: unknown, id = 'entry-1'): ToolEntry {
  return {
    id,
    toolId: 'limiting-beliefs',
    runId: null,
    payload,
    createdAt: '2026-08-04T10:00:00.000Z',
    updatedAt: '2026-08-04T10:00:00.000Z',
  }
}

describe('isLimitingBeliefPayload', () => {
  it('accepts a payload with belief, evidenceAgainst, and reframe strings', () => {
    expect(
      isLimitingBeliefPayload({
        belief: 'I am not good enough to start my own business.',
        evidenceAgainst: 'I have already shipped two side projects people paid for.',
        reframe: 'I am learning what it takes, one project at a time.',
      })
    ).toBe(true)
  })

  it('rejects shapes another tool could have written to the same table', () => {
    // tool_entries is shared across every tool and has no per-tool SQL
    // constraint, so a mismatched payload is a realistic case rather than a
    // theoretical one.
    expect(isLimitingBeliefPayload({ statement: 'Building calmly' })).toBe(false)
    expect(isLimitingBeliefPayload({ belief: 'x', evidenceAgainst: 'y' })).toBe(false)
    expect(
      isLimitingBeliefPayload({ belief: 42, evidenceAgainst: 'y', reframe: 'z' })
    ).toBe(false)
    expect(isLimitingBeliefPayload(['belief'])).toBe(false)
    expect(isLimitingBeliefPayload(null)).toBe(false)
    expect(isLimitingBeliefPayload(undefined)).toBe(false)
  })
})

describe('toLimitingBeliefEntries', () => {
  it('keeps valid entries and drops foreign payloads', () => {
    const result = toLimitingBeliefEntries([
      entry({ belief: 'Newest', evidenceAgainst: 'a', reframe: 'b' }, 'a'),
      entry({ statement: 'Foreign payload' }, 'b'),
      entry({ belief: 'Older', evidenceAgainst: 'c', reframe: 'd' }, 'c'),
    ])

    expect(result.map((item) => item.id)).toEqual(['a', 'c'])
    expect(result[0].payload.belief).toBe('Newest')
  })

  it('preserves the given order, so the newest entry stays first', () => {
    const result = toLimitingBeliefEntries([
      entry({ belief: 'Newest', evidenceAgainst: 'a', reframe: 'b' }, 'new'),
      entry({ belief: 'Oldest', evidenceAgainst: 'c', reframe: 'd' }, 'old'),
    ])

    expect(result.map((item) => item.payload.belief)).toEqual(['Newest', 'Oldest'])
  })

  it('returns nothing for a user who has not added a belief yet', () => {
    expect(toLimitingBeliefEntries([])).toEqual([])
  })
})

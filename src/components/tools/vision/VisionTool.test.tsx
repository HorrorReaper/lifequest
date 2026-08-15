import { describe, expect, it } from 'vitest'
import type { ToolEntry } from '@/lib/tools/storage'
import { isVisionPayload, toVisionRevisions } from './VisionTool'

function entry(payload: unknown, id = 'entry-1'): ToolEntry {
  return {
    id,
    toolId: 'vision',
    runId: null,
    payload,
    createdAt: '2026-08-04T10:00:00.000Z',
    updatedAt: '2026-08-04T10:00:00.000Z',
  }
}

describe('isVisionPayload', () => {
  it('accepts a payload with a statement string', () => {
    expect(isVisionPayload({ statement: 'Building calmly' })).toBe(true)
  })

  it('rejects shapes another tool could have written to the same table', () => {
    // tool_entries is shared across every tool and has no per-tool SQL
    // constraint, so a mismatched payload is a realistic case rather than a
    // theoretical one.
    expect(isVisionPayload({ scores: [1, 2, 3] })).toBe(false)
    expect(isVisionPayload({ statement: 42 })).toBe(false)
    expect(isVisionPayload(['statement'])).toBe(false)
    expect(isVisionPayload(null)).toBe(false)
    expect(isVisionPayload(undefined)).toBe(false)
  })
})

describe('toVisionRevisions', () => {
  it('keeps valid entries and drops foreign payloads', () => {
    const result = toVisionRevisions([
      entry({ statement: 'Current' }, 'a'),
      entry({ blocks: [] }, 'b'),
      entry({ statement: 'Older' }, 'c'),
    ])

    expect(result.map((item) => item.id)).toEqual(['a', 'c'])
    expect(result[0].payload.statement).toBe('Current')
  })

  it('preserves the given order, so the newest entry stays first', () => {
    const result = toVisionRevisions([
      entry({ statement: 'Newest' }, 'new'),
      entry({ statement: 'Oldest' }, 'old'),
    ])

    expect(result.map((item) => item.payload.statement)).toEqual(['Newest', 'Oldest'])
  })

  it('returns nothing for a user who has not written a vision yet', () => {
    expect(toVisionRevisions([])).toEqual([])
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { ToolEntry } from '@/lib/tools/storage'
import {
  addCategory,
  BLOCKS_PER_DAY,
  blockLabel,
  blockRangeLabel,
  daysInWindow,
  formatDuration,
  isTimeAuditPayload,
  paintRange,
  removeCategory,
  seedCategories,
  shiftDate,
  summarize,
  toAuditDays,
  todayDate,
  type TimeAuditCategory,
} from './time-audit'

function categories(): TimeAuditCategory[] {
  return [
    { id: 'sleep', label: 'Sleep', color: 'slate', value: 'neutral' },
    { id: 'deep-work', label: 'Deep work', color: 'emerald', value: 'worth_it' },
    { id: 'scrolling', label: 'Scrolling', color: 'rose', value: 'wasted' },
  ]
}

function blocks(fill: string | null = null): (string | null)[] {
  return Array.from({ length: BLOCKS_PER_DAY }, () => fill)
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'time-audit-day',
    date: '2026-08-24',
    blocks: blocks(),
    categories: categories(),
    ...overrides,
  }
}

describe('isTimeAuditPayload', () => {
  it('accepts a well-formed day', () => {
    expect(isTimeAuditPayload(payload())).toBe(true)
  })

  it('accepts a day whose blocks reference known categories', () => {
    const filled = blocks()
    filled[36] = 'deep-work'
    filled[37] = 'scrolling'
    expect(isTimeAuditPayload(payload({ blocks: filled }))).toBe(true)
  })

  it('rejects shapes another tool could have written to the same table', () => {
    // tool_entries is shared and has no per-tool SQL constraint, so a
    // mismatched payload is a realistic case rather than a theoretical one.
    expect(isTimeAuditPayload({ statement: 'Building calmly' })).toBe(false)
    expect(isTimeAuditPayload(null)).toBe(false)
    expect(isTimeAuditPayload(undefined)).toBe(false)
    expect(isTimeAuditPayload([])).toBe(false)
  })

  it('rejects a day missing the kind discriminator', () => {
    const withoutKind: Record<string, unknown> = payload()
    delete withoutKind.kind
    expect(isTimeAuditPayload(withoutKind)).toBe(false)
  })

  it('rejects a block array that is not exactly one day long', () => {
    expect(isTimeAuditPayload(payload({ blocks: blocks().slice(1) }))).toBe(false)
    expect(isTimeAuditPayload(payload({ blocks: [...blocks(), null] }))).toBe(false)
  })

  it('rejects a block referencing a category the day does not define', () => {
    const filled = blocks()
    filled[0] = 'meditation'
    expect(isTimeAuditPayload(payload({ blocks: filled }))).toBe(false)
  })

  it('rejects a malformed date', () => {
    expect(isTimeAuditPayload(payload({ date: '24-08-2026' }))).toBe(false)
    expect(isTimeAuditPayload(payload({ date: '' }))).toBe(false)
  })

  it('rejects a category with an unknown value tag', () => {
    const bad = [{ id: 'x', label: 'X', color: 'slate', value: 'productive' }]
    expect(isTimeAuditPayload(payload({ categories: bad, blocks: blocks() }))).toBe(false)
  })
})

describe('toAuditDays', () => {
  function entry(entryPayload: unknown, id: string): ToolEntry {
    return {
      id,
      toolId: 'time-audit',
      runId: null,
      payload: entryPayload,
      createdAt: '2026-08-24T10:00:00.000Z',
      updatedAt: '2026-08-24T10:00:00.000Z',
    }
  }

  it('keeps valid days and drops rows another tool wrote to the shared table', () => {
    const result = toAuditDays([
      entry(payload({ date: '2026-08-24' }), 'a'),
      entry({ statement: 'Building calmly' }, 'b'),
      entry(payload({ date: '2026-08-23' }), 'c'),
    ])

    expect(result.map((item) => item.id)).toEqual(['a', 'c'])
    expect(result[0].payload.date).toBe('2026-08-24')
  })

  it('drops a day that is corrupt rather than merely foreign', () => {
    const result = toAuditDays([entry(payload({ blocks: [] }), 'truncated')])
    expect(result).toEqual([])
  })

  it('returns nothing for a user who has not logged a day yet', () => {
    expect(toAuditDays([])).toEqual([])
  })
})

describe('seedCategories', () => {
  it('produces a usable starter palette so the first run is not a blank config screen', () => {
    const seeded = seedCategories()
    expect(seeded.length).toBeGreaterThan(3)
    expect(seeded.every((category) => category.id && category.label)).toBe(true)
  })

  it('covers all three value tags, so the summary is meaningful on day one', () => {
    const values = new Set(seedCategories().map((category) => category.value))
    expect([...values].sort()).toEqual(['neutral', 'wasted', 'worth_it'])
  })

  it('returns a fresh array each call, so editing one day cannot mutate the seed', () => {
    const first = seedCategories()
    first[0].label = 'Changed'
    expect(seedCategories()[0].label).not.toBe('Changed')
  })
})

describe('blockLabel', () => {
  it('labels the first block as midnight', () => {
    expect(blockLabel(0)).toBe('00:00')
  })

  it('labels a mid-morning block at quarter-hour precision', () => {
    expect(blockLabel(37)).toBe('09:15')
  })

  it('labels the last block of the day as 23:45', () => {
    expect(blockLabel(BLOCKS_PER_DAY - 1)).toBe('23:45')
  })
})

describe('blockRangeLabel', () => {
  it('spans from the start of the first block to the end of the last', () => {
    expect(blockRangeLabel(36, 39)).toBe('09:00 – 10:00')
  })

  it('describes a single block as its own quarter hour', () => {
    expect(blockRangeLabel(36, 36)).toBe('09:00 – 09:15')
  })

  it('ends a range that runs to the end of the day at 24:00 rather than 00:00', () => {
    // 23:45 + 15m wrapping to 00:00 would read as a zero-length range.
    expect(blockRangeLabel(94, 95)).toBe('23:30 – 24:00')
  })
})

describe('formatDuration', () => {
  it('shows hours and minutes together', () => {
    expect(formatDuration(135)).toBe('2h 15m')
  })

  it('omits the minutes on a whole number of hours', () => {
    expect(formatDuration(120)).toBe('2h')
  })

  it('omits the hours below an hour', () => {
    expect(formatDuration(45)).toBe('45m')
  })

  it('shows zero as a duration rather than an empty string', () => {
    expect(formatDuration(0)).toBe('0m')
  })
})

describe('paintRange', () => {
  it('paints every block in the range, inclusive of both ends', () => {
    const painted = paintRange(blocks(), 4, 7, 'deep-work')
    expect(painted.slice(4, 8)).toEqual(['deep-work', 'deep-work', 'deep-work', 'deep-work'])
  })

  it('leaves blocks outside the range untouched', () => {
    const painted = paintRange(blocks(), 4, 7, 'deep-work')
    expect(painted[3]).toBeNull()
    expect(painted[8]).toBeNull()
  })

  it('paints the same range when dragged upwards', () => {
    // Dragging bottom-to-top is as natural as top-to-bottom, so anchor and
    // head arrive in either order.
    expect(paintRange(blocks(), 7, 4, 'sleep')).toEqual(paintRange(blocks(), 4, 7, 'sleep'))
  })

  it('erases when painting null, so the eraser needs no separate path', () => {
    const filled = paintRange(blocks(), 0, 95, 'sleep')
    const erased = paintRange(filled, 10, 11, null)
    expect(erased.slice(10, 12)).toEqual([null, null])
    expect(erased[12]).toBe('sleep')
  })

  it('returns a new array rather than mutating the one passed in', () => {
    const original = blocks()
    paintRange(original, 0, 5, 'sleep')
    expect(original[0]).toBeNull()
  })

  it('clamps a range that runs past the end of the day', () => {
    const painted = paintRange(blocks(), 94, 300, 'sleep')
    expect(painted).toHaveLength(BLOCKS_PER_DAY)
    expect(painted[95]).toBe('sleep')
  })
})

function day(date: string, fills: Array<[number, number, string]>, cats = categories()) {
  let filled = blocks()
  for (const [from, to, id] of fills) filled = paintRange(filled, from, to, id)
  return { kind: 'time-audit-day' as const, date, blocks: filled, categories: cats }
}

describe('summarize', () => {
  it('totals the minutes painted with each category', () => {
    // 4 blocks = 1h of deep work, 2 blocks = 30m of scrolling.
    const summary = summarize([day('2026-08-24', [[36, 39, 'deep-work'], [40, 41, 'scrolling']])])
    const totals = Object.fromEntries(summary.totals.map((t) => [t.id, t.minutes]))
    expect(totals).toEqual({ 'deep-work': 60, scrolling: 30 })
  })

  it('ranks categories by time spent, biggest first', () => {
    const summary = summarize([day('2026-08-24', [[0, 3, 'deep-work'], [4, 19, 'sleep']])])
    expect(summary.totals.map((total) => total.id)).toEqual(['sleep', 'deep-work'])
  })

  it('merges the same category across several days', () => {
    const summary = summarize([
      day('2026-08-24', [[0, 3, 'deep-work']]),
      day('2026-08-23', [[0, 3, 'deep-work']]),
    ])
    expect(summary.totals).toHaveLength(1)
    expect(summary.totals[0].minutes).toBe(120)
  })

  it('displays a renamed category under its newest label while keeping older time', () => {
    // Days snapshot their own palette, so a rename must not split the total
    // in two, and the summary should show the name currently in use.
    const renamed = [{ id: 'scrolling', label: 'Doomscrolling', color: 'rose', value: 'wasted' as const }]
    const older = [{ id: 'scrolling', label: 'Scrolling', color: 'rose', value: 'wasted' as const }]
    const summary = summarize([
      day('2026-08-23', [[0, 3, 'scrolling']], older),
      day('2026-08-24', [[0, 3, 'scrolling']], renamed),
    ])
    expect(summary.totals).toHaveLength(1)
    expect(summary.totals[0].label).toBe('Doomscrolling')
    expect(summary.totals[0].minutes).toBe(120)
  })

  it('counts unlogged blocks separately instead of as time spent', () => {
    const summary = summarize([day('2026-08-24', [[0, 3, 'deep-work']])])
    expect(summary.loggedMinutes).toBe(60)
    expect(summary.unloggedMinutes).toBe(24 * 60 - 60)
  })

  it('measures wasted time against logged time, not against the whole day', () => {
    // A half-filled day must not report a flattering waste percentage just
    // because the rest of the day was never entered.
    const summary = summarize([day('2026-08-24', [[0, 3, 'deep-work'], [4, 7, 'scrolling']])])
    expect(summary.wastedMinutes).toBe(60)
    expect(summary.wastedShare).toBeCloseTo(0.5)
  })

  it('reports each category share of logged time', () => {
    const summary = summarize([day('2026-08-24', [[0, 3, 'deep-work'], [4, 7, 'scrolling']])])
    expect(summary.totals.every((total) => total.share === 0.5)).toBe(true)
  })

  it('counts the days that contributed', () => {
    const summary = summarize([
      day('2026-08-24', [[0, 3, 'deep-work']]),
      day('2026-08-23', [[0, 3, 'sleep']]),
    ])
    expect(summary.dayCount).toBe(2)
  })

  it('returns an empty summary rather than dividing by zero when nothing is logged', () => {
    const summary = summarize([])
    expect(summary.totals).toEqual([])
    expect(summary.loggedMinutes).toBe(0)
    expect(summary.wastedShare).toBe(0)
  })

  it('ignores a day that was opened but never painted', () => {
    const summary = summarize([day('2026-08-24', [])])
    expect(summary.loggedMinutes).toBe(0)
    expect(summary.wastedShare).toBe(0)
  })
})

describe('daysInWindow', () => {
  const days = [
    day('2026-08-24', [[0, 3, 'sleep']]),
    day('2026-08-20', [[0, 3, 'sleep']]),
    day('2026-08-01', [[0, 3, 'sleep']]),
  ]

  it('keeps only days inside a seven-day window', () => {
    expect(daysInWindow(days, 7, '2026-08-24').map((d) => d.date)).toEqual([
      '2026-08-24',
      '2026-08-20',
    ])
  })

  it('includes the day exactly at the edge of the window', () => {
    expect(daysInWindow(days, 5, '2026-08-24').map((d) => d.date)).toEqual([
      '2026-08-24',
      '2026-08-20',
    ])
  })

  it('excludes a day one past the edge', () => {
    expect(daysInWindow(days, 4, '2026-08-24').map((d) => d.date)).toEqual(['2026-08-24'])
  })

  it('keeps every day when the window is null', () => {
    expect(daysInWindow(days, null, '2026-08-24')).toHaveLength(3)
  })

  it('excludes days logged after the reference date', () => {
    expect(daysInWindow(days, 7, '2026-08-21').map((d) => d.date)).toEqual(['2026-08-20'])
  })
})

describe('addCategory', () => {
  it('derives a stable id from the label', () => {
    const [added] = addCategory([], 'Deep work', 'emerald', 'worth_it').slice(-1)
    expect(added.id).toBe('deep-work')
  })

  it('keeps ids unique so two categories cannot collide', () => {
    const first = addCategory([], 'Admin', 'sky', 'neutral')
    const second = addCategory(first, 'Admin', 'rose', 'wasted')
    expect(second.map((category) => category.id)).toEqual(['admin', 'admin-2'])
  })

  it('falls back to a generated id when the label has no usable characters', () => {
    const [added] = addCategory([], '!!!', 'sky', 'neutral').slice(-1)
    expect(added.id.length).toBeGreaterThan(0)
  })

  it('appends rather than replacing', () => {
    const result = addCategory(seedCategories(), 'Reading', 'violet', 'worth_it')
    expect(result).toHaveLength(seedCategories().length + 1)
  })
})

describe('removeCategory', () => {
  it('drops the category from the palette', () => {
    const result = removeCategory(day('2026-08-24', [[0, 3, 'deep-work']]), 'scrolling')
    expect(result.categories.map((category) => category.id)).not.toContain('scrolling')
  })

  it('clears the blocks that used it, so the day cannot reference a category it no longer defines', () => {
    // isTimeAuditPayload rejects that state outright, which would make the
    // whole day unreadable rather than merely mislabelled.
    const result = removeCategory(day('2026-08-24', [[0, 3, 'scrolling'], [4, 7, 'sleep']]), 'scrolling')
    expect(result.blocks.slice(0, 4)).toEqual([null, null, null, null])
    expect(result.blocks[4]).toBe('sleep')
    expect(isTimeAuditPayload(result)).toBe(true)
  })

  it('leaves the day untouched when the category was never there', () => {
    const before = day('2026-08-24', [[0, 3, 'sleep']])
    expect(removeCategory(before, 'nope')).toEqual(before)
  })
})

describe('shiftDate', () => {
  it('steps back a day', () => {
    expect(shiftDate('2026-08-24', -1)).toBe('2026-08-23')
  })

  it('steps forward a day', () => {
    expect(shiftDate('2026-08-24', 1)).toBe('2026-08-25')
  })

  it('crosses a month boundary', () => {
    expect(shiftDate('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('crosses a leap day', () => {
    expect(shiftDate('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('todayDate', () => {
  it('reads the local calendar date, not the UTC one', () => {
    // Late-evening local time is already tomorrow in UTC for positive
    // offsets; the day being audited is the local one.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 24, 23, 30, 0))
    expect(todayDate()).toBe('2026-08-24')
    vi.useRealTimers()
  })
})

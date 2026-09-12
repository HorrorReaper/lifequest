import { describe, expect, it } from 'vitest'
import {
  INSIGHT_RAIL_LIMIT,
  groupInsightsByType,
  mapInsightRows,
  type JournalInsightItem,
} from '@/lib/journal-insights'
import type { InsightType } from '@/lib/types'

function insight(
  id: string,
  type: InsightType,
  { markedAt = '2026-01-01T00:00:00Z', isFavorite = false } = {}
): JournalInsightItem {
  return {
    id,
    source: 'response',
    sourceId: id,
    entryId: `entry-${id}`,
    fieldId: 'field',
    type,
    title: null,
    answer: `answer ${id}`,
    prompt: null,
    tags: [],
    actionText: null,
    isFavorite,
    markedAt,
    entryDate: markedAt.slice(0, 10),
    template: null,
  }
}

describe('groupInsightsByType', () => {
  it('gives each insight type a rail, the fullest first', () => {
    const rails = groupInsightsByType([
      insight('a', 'learning'),
      insight('b', 'idea'),
      insight('c', 'learning'),
      insight('d', 'learning'),
      insight('e', 'idea'),
      insight('f', 'win'),
    ])

    expect(rails.map((rail) => rail.type)).toEqual(['learning', 'idea', 'win'])
    expect(rails.map((rail) => rail.total)).toEqual([3, 2, 1])
  })

  it('labels each rail for reading', () => {
    const rails = groupInsightsByType([insight('a', 'learning')])

    expect(rails[0].label).toBe('Learnings')
  })

  it('leaves out a type nothing was marked as', () => {
    const rails = groupInsightsByType([insight('a', 'learning')])

    expect(rails.map((rail) => rail.type)).toEqual(['learning'])
  })

  it('breaks a tie in the order the types are defined in', () => {
    const rails = groupInsightsByType([
      insight('a', 'win'),
      insight('b', 'problem'),
      insight('c', 'idea'),
    ])

    expect(rails.map((rail) => rail.type)).toEqual(['problem', 'idea', 'win'])
  })

  it('puts favorites first, then the newest', () => {
    const rails = groupInsightsByType([
      insight('old', 'learning', { markedAt: '2026-01-01T00:00:00Z' }),
      insight('new', 'learning', { markedAt: '2026-03-01T00:00:00Z' }),
      insight('starred', 'learning', { markedAt: '2025-01-01T00:00:00Z', isFavorite: true }),
    ])

    expect(rails[0].insights.map((item) => item.id)).toEqual(['starred', 'new', 'old'])
  })

  it('caps a rail but still reports the true total', () => {
    const many = Array.from({ length: INSIGHT_RAIL_LIMIT + 5 }, (_, index) =>
      insight(`i${index}`, 'learning')
    )

    const [rail] = groupInsightsByType(many)

    expect(rail.insights).toHaveLength(INSIGHT_RAIL_LIMIT)
    expect(rail.total).toBe(INSIGHT_RAIL_LIMIT + 5)
  })

  it('has no rails when nothing has been marked', () => {
    expect(groupInsightsByType([])).toEqual([])
  })
})

const ENTRY = {
  entry_date: '2026-02-03',
  journal_templates: { id: 'tpl', name: 'Evening', icon: '🌙' },
}

describe('mapInsightRows', () => {
  it('reads a marked response into an insight', () => {
    const [item] = mapInsightRows(
      [
        {
          id: 'r1',
          entry_id: 'e1',
          field_id: 'f1',
          value_text: 'Ship smaller changes',
          value_json: null,
          insight_type: 'learning',
          topic_tags: ['work'],
          insight_marked_at: '2026-02-03T10:00:00Z',
          insight_is_favorite: true,
          created_at: '2026-02-03T09:00:00Z',
          template_fields: { label: 'What did you learn?' },
          journal_entries: ENTRY,
        },
      ],
      []
    )

    expect(item).toMatchObject({
      id: 'response:r1',
      source: 'response',
      type: 'learning',
      answer: 'Ship smaller changes',
      prompt: 'What did you learn?',
      tags: ['work'],
      isFavorite: true,
      entryDate: '2026-02-03',
    })
  })

  it('skips a response whose type is not an insight type', () => {
    const items = mapInsightRows(
      [
        {
          id: 'r1',
          entry_id: 'e1',
          field_id: 'f1',
          value_text: 'text',
          value_json: null,
          insight_type: 'nonsense',
          topic_tags: null,
          insight_marked_at: null,
          insight_is_favorite: false,
          created_at: '2026-02-03T09:00:00Z',
          template_fields: null,
          journal_entries: ENTRY,
        },
      ],
      []
    )

    expect(items).toEqual([])
  })

  it('skips a response with nothing written in it', () => {
    const items = mapInsightRows(
      [
        {
          id: 'r1',
          entry_id: 'e1',
          field_id: 'f1',
          value_text: '   ',
          value_json: null,
          insight_type: 'idea',
          topic_tags: null,
          insight_marked_at: null,
          insight_is_favorite: false,
          created_at: '2026-02-03T09:00:00Z',
          template_fields: null,
          journal_entries: ENTRY,
        },
      ],
      []
    )

    expect(items).toEqual([])
  })

  it('keeps a legacy learning that no response has replaced', () => {
    const [item] = mapInsightRows(
      [],
      [
        {
          id: 'l1',
          entry_id: 'e9',
          field_id: 'f9',
          title: 'Sleep runs everything',
          note: 'Protect the shutdown routine.',
          tags: ['health'],
          action_text: 'Lights out at 22:30',
          is_favorite: false,
          created_at: '2026-01-02T08:00:00Z',
          updated_at: '2026-01-03T08:00:00Z',
          journal_entries: ENTRY,
        },
      ]
    )

    expect(item).toMatchObject({
      id: 'legacy:l1',
      source: 'legacy',
      type: 'learning',
      title: 'Sleep runs everything',
      answer: 'Protect the shutdown routine.',
      actionText: 'Lights out at 22:30',
      markedAt: '2026-01-03T08:00:00Z',
    })
  })

  it('drops a legacy learning the response table already covers', () => {
    const items = mapInsightRows(
      [
        {
          id: 'r1',
          entry_id: 'e1',
          field_id: 'f1',
          value_text: 'Ship smaller changes',
          value_json: null,
          insight_type: 'learning',
          topic_tags: null,
          insight_marked_at: '2026-02-03T10:00:00Z',
          insight_is_favorite: false,
          created_at: '2026-02-03T09:00:00Z',
          template_fields: null,
          journal_entries: ENTRY,
        },
      ],
      [
        {
          id: 'l1',
          entry_id: 'e1',
          field_id: 'f1',
          title: 'Older copy',
          note: 'Same thing, written before.',
          tags: [],
          action_text: null,
          is_favorite: false,
          created_at: '2026-01-02T08:00:00Z',
          updated_at: '2026-01-02T08:00:00Z',
          journal_entries: ENTRY,
        },
      ]
    )

    expect(items.map((item) => item.id)).toEqual(['response:r1'])
  })

  it('returns the newest insight first, whichever table it came from', () => {
    const items = mapInsightRows(
      [
        {
          id: 'r1',
          entry_id: 'e1',
          field_id: 'f1',
          value_text: 'older response',
          value_json: null,
          insight_type: 'learning',
          topic_tags: null,
          insight_marked_at: '2026-01-01T00:00:00Z',
          insight_is_favorite: false,
          created_at: '2026-01-01T00:00:00Z',
          template_fields: null,
          journal_entries: ENTRY,
        },
      ],
      [
        {
          id: 'l1',
          entry_id: 'e2',
          field_id: 'f2',
          title: 'newer legacy',
          note: 'note',
          tags: [],
          action_text: null,
          is_favorite: false,
          created_at: '2026-05-01T00:00:00Z',
          updated_at: '2026-05-01T00:00:00Z',
          journal_entries: ENTRY,
        },
      ]
    )

    expect(items.map((item) => item.id)).toEqual(['legacy:l1', 'response:r1'])
  })
})

import { describe, expect, it } from 'vitest'
import {
  adjacentDiaryEntries,
  DIARY_BODY_FIELD_ID,
  DIARY_TITLE_FIELD_ID,
  diaryEntriesFrom,
  diaryMonth,
  diaryTitle,
  groupDiaryByMonth,
  isMonthKey,
  shiftMonth,
  type DiaryEntry,
} from '@/lib/diary'

const entry = (id: string, entryDate: string, title: string | null = 'A day'): DiaryEntry => ({
  id,
  entryDate,
  title,
  body: 'Text',
  updatedAt: `${entryDate}T20:00:00Z`,
})

describe('diaryEntriesFrom', () => {
  it('reads title and body from the responses, newest day first', () => {
    const entries = diaryEntriesFrom([
      {
        id: 'a',
        entry_date: '2026-11-18',
        updated_at: 'x',
        journal_responses: [
          { field_id: DIARY_TITLE_FIELD_ID, value_text: '  Shipped it  ' },
          { field_id: DIARY_BODY_FIELD_ID, value_text: '**Long** day' },
        ],
      },
      {
        id: 'b',
        entry_date: '2026-11-19',
        updated_at: 'y',
        journal_responses: [{ field_id: DIARY_TITLE_FIELD_ID, value_text: '   ' }],
      },
    ])
    expect(entries.map((item) => item.id)).toEqual(['b', 'a'])
    expect(entries[1]).toMatchObject({ title: 'Shipped it', body: '**Long** day' })
    expect(entries[0]).toMatchObject({ title: null, body: '' })
    expect(diaryTitle(entries[0])).toBe('Untitled')
  })
})

describe('diaryMonth', () => {
  it('lays the month out Monday first and counts written days up to today', () => {
    // November 2026 starts on a Sunday.
    const month = diaryMonth([entry('a', '2026-11-02'), entry('b', '2026-11-19'), entry('c', '2026-10-31')], '2026-11', '2026-11-19')
    expect(month.label).toBe('November 2026')
    expect(month.leadingBlanks).toBe(6)
    expect(month.days).toHaveLength(30)
    expect(month.written).toBe(2)
    expect(month.elapsed).toBe(19)
    expect(month.days[18]).toMatchObject({ day: 19, entryId: 'b', isToday: true, isFuture: false })
    expect(month.days[19].isFuture).toBe(true)
  })

  it('counts every day of a past month as elapsed', () => {
    expect(diaryMonth([], '2026-10', '2026-11-19').elapsed).toBe(31)
  })
})

describe('months and neighbours', () => {
  it('groups by month, newest first', () => {
    const groups = groupDiaryByMonth([entry('a', '2026-11-19'), entry('b', '2026-10-02'), entry('c', '2026-11-01')])
    expect(groups.map((group) => [group.monthKey, group.entries.map((item) => item.id)])).toEqual([
      ['2026-11', ['a', 'c']],
      ['2026-10', ['b']],
    ])
  })

  it('finds the days before and after', () => {
    const entries = [entry('a', '2026-11-19'), entry('b', '2026-11-16'), entry('c', '2026-11-18')]
    expect(adjacentDiaryEntries(entries, 'c')).toMatchObject({ previous: { id: 'b' }, next: { id: 'a' } })
    expect(adjacentDiaryEntries(entries, 'b').previous).toBeNull()
    expect(adjacentDiaryEntries(entries, 'zzz')).toEqual({ previous: null, next: null })
  })

  it('reads and moves month keys', () => {
    expect(isMonthKey('2026-11')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey(undefined)).toBe(false)
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})

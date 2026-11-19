import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, formatDateOnly, weekdayOf } from '@/lib/dates'

/**
 * The diary (docs/features/journal.md#diary): one entry a day on the system
 * "Diary" template, with an optional title and a Markdown body. Ids are fixed
 * by supabase/migrations/20261119150000_diary.sql.
 */
export const DIARY_TEMPLATE_ID = 'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a11'
export const DIARY_TITLE_FIELD_ID = 'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a12'
export const DIARY_BODY_FIELD_ID = 'd1a7e5c2-4b8f-4e3a-9c61-2f7b8d0e5a13'

export const DIARY_PATH = '/journal/diary'
/** Writes today's entry; opens it for editing when there is one already. */
export const DIARY_WRITE_PATH = `/journal/new/${DIARY_TEMPLATE_ID}`

export interface DiaryEntry {
  id: string
  /** The local day the entry is for, as a date key. */
  entryDate: string
  title: string | null
  body: string
  updatedAt: string
}

interface DiaryRow {
  id: string
  entry_date: string
  updated_at: string
  journal_responses?: Array<{ field_id: string; value_text: string | null }> | null
}

export function diaryEntriesFrom(rows: readonly DiaryRow[]): DiaryEntry[] {
  return rows
    .map((row) => {
      const responses = row.journal_responses ?? []
      const text = (fieldId: string) =>
        responses.find((response) => response.field_id === fieldId)?.value_text ?? null
      return {
        id: row.id,
        entryDate: row.entry_date,
        title: text(DIARY_TITLE_FIELD_ID)?.trim() || null,
        body: text(DIARY_BODY_FIELD_ID) ?? '',
        updatedAt: row.updated_at,
      }
    })
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
}

/** Every diary entry of the user, newest day first. */
export async function fetchDiaryEntries(
  supabase: SupabaseClient,
  userId: string
): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, entry_date, updated_at, journal_responses(field_id, value_text)')
    .eq('user_id', userId)
    .eq('is_diary', true)
    .order('entry_date', { ascending: false })
  if (error) throw error
  return diaryEntriesFrom((data ?? []) as DiaryRow[])
}

/** The id of the user's diary entry for a day, or null. */
export async function findDiaryEntryForDay(
  supabase: SupabaseClient,
  userId: string,
  day: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('is_diary', true)
    .eq('entry_date', day)
    .maybeSingle()
  if (error) throw error
  return (data as { id: string } | null)?.id ?? null
}

/** The title to show: the one written, or "Untitled". */
export function diaryTitle(entry: Pick<DiaryEntry, 'title'>): string {
  return entry.title ?? 'Untitled'
}

/** "2026-11" for a date key. */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/** Whether a string is a month key ("2026-11"). */
export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function shiftMonth(monthKey: string, amount: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const index = year * 12 + (month - 1) + amount
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey: string): string {
  return formatDateOnly(`${monthKey}-01`, { month: 'long', year: 'numeric' })
}

export interface DiaryMonthDay {
  date: string
  day: number
  entryId: string | null
  isToday: boolean
  isFuture: boolean
}

export interface DiaryMonth {
  monthKey: string
  label: string
  /** Empty cells before the 1st in a Monday-first week. */
  leadingBlanks: number
  days: DiaryMonthDay[]
  /** Days of the month with an entry. */
  written: number
  /** Days of the month up to today (all of them for a past month). */
  elapsed: number
}

/** A month at a glance: each day, whether it has an entry, and the counts. */
export function diaryMonth(
  entries: readonly Pick<DiaryEntry, 'id' | 'entryDate'>[],
  monthKey: string,
  today: string
): DiaryMonth {
  const first = `${monthKey}-01`
  const byDate = new Map(entries.map((entry) => [entry.entryDate, entry.id]))
  const days: DiaryMonthDay[] = []
  for (let date = first; monthKeyOf(date) === monthKey; date = addDays(date, 1)) {
    days.push({
      date,
      day: Number(date.slice(8, 10)),
      entryId: byDate.get(date) ?? null,
      isToday: date === today,
      isFuture: date > today,
    })
  }
  return {
    monthKey,
    label: monthLabel(monthKey),
    leadingBlanks: weekdayOf(first),
    days,
    written: days.filter((day) => day.entryId).length,
    elapsed: days.filter((day) => !day.isFuture).length,
  }
}

/** Entries grouped by month, newest month first. */
export function groupDiaryByMonth(
  entries: readonly DiaryEntry[]
): Array<{ monthKey: string; label: string; entries: DiaryEntry[] }> {
  const groups = new Map<string, DiaryEntry[]>()
  for (const entry of entries) {
    const key = monthKeyOf(entry.entryDate)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, items]) => ({ monthKey, label: monthLabel(monthKey), entries: items }))
}

/** The entries before and after one, by day. */
export function adjacentDiaryEntries(
  entries: readonly DiaryEntry[],
  id: string
): { previous: DiaryEntry | null; next: DiaryEntry | null } {
  const sorted = [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate))
  const index = sorted.findIndex((entry) => entry.id === id)
  if (index === -1) return { previous: null, next: null }
  return { previous: sorted[index - 1] ?? null, next: sorted[index + 1] ?? null }
}

import type { ToolEntry } from '@/lib/tools/storage'

/** Stable identifier, also the tool_id written to tool_entries. Never rename. */
export const TIME_AUDIT_TOOL_ID = 'time-audit'

export const MINUTES_PER_BLOCK = 15
export const BLOCKS_PER_HOUR = 60 / MINUTES_PER_BLOCK
export const BLOCKS_PER_DAY = 24 * BLOCKS_PER_HOUR

export type CategoryValue = 'worth_it' | 'neutral' | 'wasted'

const CATEGORY_VALUES: CategoryValue[] = ['worth_it', 'neutral', 'wasted']

export interface TimeAuditCategory {
  /** Stable slug. Renaming edits the label, never this. */
  id: string
  label: string
  /** Key into CATEGORY_COLORS, not a raw CSS colour, so themes stay in charge. */
  color: string
  value: CategoryValue
}

export interface TimeAuditPayload {
  /**
   * Discriminator. tool_entries is shared across every tool with no per-tool
   * SQL constraint, so a day has to be recognisable from its payload alone.
   */
  kind: 'time-audit-day'
  /** YYYY-MM-DD. One entry per date; re-logging updates rather than inserts. */
  date: string
  /** Exactly BLOCKS_PER_DAY items; a category id, or null when unlogged. */
  blocks: (string | null)[]
  /**
   * The palette as it stood on this day. Snapshotted per day rather than kept
   * in one shared settings row: no cross-row dependency, and a past day stays
   * truthful about what its blocks meant.
   */
  categories: TimeAuditCategory[]
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isCategory(value: unknown): value is TimeAuditCategory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const category = value as TimeAuditCategory
  return (
    typeof category.id === 'string' &&
    category.id.length > 0 &&
    typeof category.label === 'string' &&
    typeof category.color === 'string' &&
    CATEGORY_VALUES.includes(category.value)
  )
}

export function isTimeAuditPayload(value: unknown): value is TimeAuditPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const payload = value as TimeAuditPayload

  if (payload.kind !== 'time-audit-day') return false
  if (typeof payload.date !== 'string' || !DATE_PATTERN.test(payload.date)) return false
  if (!Array.isArray(payload.categories) || !payload.categories.every(isCategory)) return false
  if (!Array.isArray(payload.blocks) || payload.blocks.length !== BLOCKS_PER_DAY) return false

  // A block pointing at a category the day never defined would render as a
  // blank cell with no way to fix it, so treat the whole day as unreadable.
  const known = new Set(payload.categories.map((category) => category.id))
  return payload.blocks.every(
    (block) => block === null || (typeof block === 'string' && known.has(block))
  )
}

/**
 * tool_entries is deliberately schema-less so a new tool needs no migration,
 * which means each tool filters out rows written by a different tool itself.
 */
export function toAuditDays(entries: ToolEntry[]): ToolEntry<TimeAuditPayload>[] {
  return entries.filter(
    (entry): entry is ToolEntry<TimeAuditPayload> => isTimeAuditPayload(entry.payload)
  )
}

/** A starter palette, so the first run is not a blank config screen. */
export function seedCategories(): TimeAuditCategory[] {
  return [
    { id: 'sleep', label: 'Sleep', color: 'slate', value: 'neutral' },
    { id: 'deep-work', label: 'Deep work', color: 'emerald', value: 'worth_it' },
    { id: 'admin', label: 'Admin', color: 'sky', value: 'neutral' },
    { id: 'training', label: 'Training', color: 'lime', value: 'worth_it' },
    { id: 'scrolling', label: 'Scrolling', color: 'rose', value: 'wasted' },
    { id: 'commute', label: 'Commute', color: 'amber', value: 'neutral' },
  ]
}

function pad(value: number) {
  return value.toString().padStart(2, '0')
}

/** Clock time at which a block starts, e.g. block 37 → '09:15'. */
export function blockLabel(index: number): string {
  const minutes = index * MINUTES_PER_BLOCK
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

/** Inclusive range of blocks as a clock span, e.g. '09:00 – 10:00'. */
export function blockRangeLabel(start: number, end: number): string {
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  const endMinutes = (to + 1) * MINUTES_PER_BLOCK
  // A range ending on the last block finishes at midnight; rendering that as
  // '00:00' would read as a zero-length span, so say 24:00 instead.
  const endLabel =
    endMinutes === 24 * 60
      ? '24:00'
      : `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`
  return `${blockLabel(from)} – ${endLabel}`
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  if (!rest) return `${hours}h`
  return `${hours}h ${rest}m`
}

/**
 * Paints an inclusive block range. Anchor and head arrive in either order
 * because dragging upwards is as natural as dragging down; a null category
 * erases, so the eraser needs no separate path.
 */
export function paintRange(
  blocks: (string | null)[],
  start: number,
  end: number,
  categoryId: string | null
): (string | null)[] {
  const from = Math.max(0, Math.min(start, end))
  const to = Math.min(BLOCKS_PER_DAY - 1, Math.max(start, end))
  const next = [...blocks]
  for (let index = from; index <= to; index += 1) next[index] = categoryId
  return next
}

export interface CategoryTotal extends TimeAuditCategory {
  minutes: number
  /** Fraction of logged time, not of the calendar day. */
  share: number
}

export interface AuditSummary {
  /** Ranked by time spent, biggest first. */
  totals: CategoryTotal[]
  loggedMinutes: number
  unloggedMinutes: number
  wastedMinutes: number
  wastedShare: number
  dayCount: number
}

const EMPTY_SUMMARY: AuditSummary = {
  totals: [],
  loggedMinutes: 0,
  unloggedMinutes: 0,
  wastedMinutes: 0,
  wastedShare: 0,
  dayCount: 0,
}

/**
 * Aggregates logged days into a ranked breakdown.
 *
 * Shares are measured against logged time rather than against the calendar
 * day: a half-filled day would otherwise report a flattering waste
 * percentage purely because the rest was never entered.
 */
export function summarize(days: TimeAuditPayload[]): AuditSummary {
  if (days.length === 0) return EMPTY_SUMMARY

  // Days snapshot their own palette, so a category renamed later still shares
  // an id with its older self. Newest definition wins for display, which lets
  // a rename reach the summary without splitting or rewriting history.
  const newestFirst = [...days].sort((a, b) => b.date.localeCompare(a.date))
  const definitions = new Map<string, TimeAuditCategory>()
  for (const day of newestFirst) {
    for (const category of day.categories) {
      if (!definitions.has(category.id)) definitions.set(category.id, category)
    }
  }

  const minutesById = new Map<string, number>()
  let loggedMinutes = 0

  for (const day of days) {
    for (const block of day.blocks) {
      if (block === null) continue
      minutesById.set(block, (minutesById.get(block) ?? 0) + MINUTES_PER_BLOCK)
      loggedMinutes += MINUTES_PER_BLOCK
    }
  }

  const totals: CategoryTotal[] = [...minutesById.entries()]
    .map(([id, minutes]) => {
      const definition = definitions.get(id)
      return {
        id,
        label: definition?.label ?? id,
        color: definition?.color ?? 'slate',
        value: definition?.value ?? ('neutral' as CategoryValue),
        minutes,
        share: loggedMinutes ? minutes / loggedMinutes : 0,
      }
    })
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label))

  const wastedMinutes = totals
    .filter((total) => total.value === 'wasted')
    .reduce((sum, total) => sum + total.minutes, 0)

  return {
    totals,
    loggedMinutes,
    unloggedMinutes: days.length * BLOCKS_PER_DAY * MINUTES_PER_BLOCK - loggedMinutes,
    wastedMinutes,
    wastedShare: loggedMinutes ? wastedMinutes / loggedMinutes : 0,
    dayCount: days.length,
  }
}

/** Days falling within `windowDays` back from `today`, inclusive. Null keeps all. */
export function daysInWindow<T extends { date: string }>(
  days: T[],
  windowDays: number | null,
  today: string
): T[] {
  if (windowDays === null) return days

  const end = new Date(`${today}T00:00:00Z`)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))
  const from = start.toISOString().slice(0, 10)

  return days.filter((day) => day.date >= from && day.date <= today)
}

/**
 * Tailwind builds class names statically, so category colours have to be a
 * closed map of literal classes rather than an interpolated `bg-${color}-500`.
 */
export const CATEGORY_COLORS: Record<string, { swatch: string; block: string }> = {
  slate: { swatch: 'bg-slate-400', block: 'bg-slate-400 hover:bg-slate-500' },
  emerald: { swatch: 'bg-emerald-500', block: 'bg-emerald-500 hover:bg-emerald-600' },
  sky: { swatch: 'bg-sky-500', block: 'bg-sky-500 hover:bg-sky-600' },
  lime: { swatch: 'bg-lime-500', block: 'bg-lime-500 hover:bg-lime-600' },
  rose: { swatch: 'bg-rose-500', block: 'bg-rose-500 hover:bg-rose-600' },
  amber: { swatch: 'bg-amber-500', block: 'bg-amber-500 hover:bg-amber-600' },
  violet: { swatch: 'bg-violet-500', block: 'bg-violet-500 hover:bg-violet-600' },
  teal: { swatch: 'bg-teal-500', block: 'bg-teal-500 hover:bg-teal-600' },
  orange: { swatch: 'bg-orange-500', block: 'bg-orange-500 hover:bg-orange-600' },
  fuchsia: { swatch: 'bg-fuchsia-500', block: 'bg-fuchsia-500 hover:bg-fuchsia-600' },
}

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS)

export function categoryColor(color: string) {
  return CATEGORY_COLORS[color] ?? CATEGORY_COLORS.slate
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Ids are derived once from the label and then frozen: renaming a category
 * must not split its history in the summary, which merges days by id.
 */
export function addCategory(
  categories: TimeAuditCategory[],
  label: string,
  color: string,
  value: CategoryValue
): TimeAuditCategory[] {
  const base = slugify(label) || `category-${categories.length + 1}`
  const taken = new Set(categories.map((category) => category.id))

  let id = base
  let suffix = 2
  while (taken.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }

  return [...categories, { id, label: label.trim() || id, color, value }]
}

/**
 * Removes a category and clears the blocks that used it. The two go together:
 * a day whose blocks point at a category it no longer defines is rejected by
 * isTimeAuditPayload, which would make the whole day unreadable.
 */
export function removeCategory(day: TimeAuditPayload, categoryId: string): TimeAuditPayload {
  if (!day.categories.some((category) => category.id === categoryId)) return day

  return {
    ...day,
    categories: day.categories.filter((category) => category.id !== categoryId),
    blocks: day.blocks.map((block) => (block === categoryId ? null : block)),
  }
}

/**
 * Local calendar date, not the UTC one: at 23:30 in a positive offset it is
 * already tomorrow in UTC, but the day being audited is still today's.
 */
export function todayDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

import type { ToolEntry } from '@/lib/tools/storage'

export const WHEEL_OF_LIFE_TOOL_ID = 'wheel-of-life'

export const LIFE_AREAS = [
  { id: 'relationships', label: 'Relationships', hint: 'Partner, family, friends' },
  { id: 'health', label: 'Health', hint: 'Body, sleep, energy, mind' },
  { id: 'career', label: 'Business & career', hint: 'Work, money, ambition' },
  { id: 'fun', label: 'Fun & free time', hint: 'Hobbies, play, rest' },
  { id: 'growth', label: 'Personal growth', hint: 'Learning, character, meaning' },
] as const

export type LifeAreaId = (typeof LIFE_AREAS)[number]['id']

export interface WheelOfLifePayload {
  ratings: Record<LifeAreaId, number>
  note: string
}

export const MIN_RATING = 1
export const MAX_RATING = 10

function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_RATING && value <= MAX_RATING
}

export function isWheelOfLifePayload(value: unknown): value is WheelOfLifePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<WheelOfLifePayload>
  if (typeof candidate.note !== 'string') return false
  const ratings = candidate.ratings as Record<string, unknown> | undefined
  if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) return false
  return LIFE_AREAS.every((area) => isRating(ratings[area.id]))
}

/**
 * tool_entries is schema-less, so the tool validates its own rows. Each save
 * is a snapshot (a new row), newest first, which is what makes "how has this
 * changed since I started" answerable.
 */
export function toWheelSnapshots(entries: ToolEntry[]): ToolEntry<WheelOfLifePayload>[] {
  return entries.filter((entry): entry is ToolEntry<WheelOfLifePayload> => isWheelOfLifePayload(entry.payload))
}

export function defaultRatings(): Record<LifeAreaId, number> {
  return Object.fromEntries(LIFE_AREAS.map((area) => [area.id, 5])) as Record<LifeAreaId, number>
}

export function averageRating(ratings: Record<LifeAreaId, number>): number {
  const total = LIFE_AREAS.reduce((sum, area) => sum + ratings[area.id], 0)
  return Math.round((total / LIFE_AREAS.length) * 10) / 10
}

export interface AreaComparison {
  id: LifeAreaId
  label: string
  current: number
  /** The first snapshot's rating, or null when there is only one snapshot. */
  baseline: number | null
  delta: number | null
}

/** Latest snapshot against the first one ever taken. */
export function compareToBaseline(snapshots: ToolEntry<WheelOfLifePayload>[]): AreaComparison[] {
  const latest = snapshots[0]
  if (!latest) return []
  const first = snapshots.length > 1 ? snapshots[snapshots.length - 1] : null
  return LIFE_AREAS.map((area) => {
    const current = latest.payload.ratings[area.id]
    const baseline = first ? first.payload.ratings[area.id] : null
    return { id: area.id, label: area.label, current, baseline, delta: baseline === null ? null : current - baseline }
  })
}

/** The area with the most room to grow: lowest current rating, first on ties. */
export function lowestArea(comparisons: AreaComparison[]): AreaComparison | null {
  return comparisons.reduce<AreaComparison | null>((lowest, item) => (!lowest || item.current < lowest.current ? item : lowest), null)
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return ''
  if (delta === 0) return '±0'
  return delta > 0 ? `+${delta}` : `${delta}`
}

import type { ToolEntry } from '@/lib/tools/storage'

export const ENVIRONMENT_AUDIT_TOOL_ID = 'environment-audit'

export const ENVIRONMENT_AREAS = [
  { id: 'space', label: 'Physical space', hint: 'Home, desk, bedroom, what is in sight' },
  { id: 'digital', label: 'Digital', hint: 'Phone, apps, notifications, feeds' },
  { id: 'people', label: 'People', hint: 'Who drains you, who pulls you forward' },
  { id: 'routines', label: 'Routines & defaults', hint: 'What happens automatically' },
] as const

export type EnvironmentAreaId = (typeof ENVIRONMENT_AREAS)[number]['id']

export const MAX_ITEM_LENGTH = 200

export interface EnvironmentItemPayload {
  area: EnvironmentAreaId
  /** What in the environment is holding the user back. */
  item: string
  /** What they will remove or change about it. */
  change: string
  /** Removed or changed already. */
  done: boolean
}

const AREA_IDS = new Set<string>(ENVIRONMENT_AREAS.map((area) => area.id))

export function isEnvironmentItemPayload(value: unknown): value is EnvironmentItemPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<EnvironmentItemPayload>
  return (
    typeof candidate.area === 'string' &&
    AREA_IDS.has(candidate.area) &&
    typeof candidate.item === 'string' &&
    typeof candidate.change === 'string' &&
    typeof candidate.done === 'boolean'
  )
}

export function toEnvironmentItems(entries: ToolEntry[]): ToolEntry<EnvironmentItemPayload>[] {
  return entries.filter((entry): entry is ToolEntry<EnvironmentItemPayload> => isEnvironmentItemPayload(entry.payload))
}

/** Items per area in the fixed area order; open items before done ones. */
export function groupByArea(items: ToolEntry<EnvironmentItemPayload>[]) {
  return ENVIRONMENT_AREAS.map((area) => ({
    ...area,
    items: items
      .filter((entry) => entry.payload.area === area.id)
      .sort((a, b) => Number(a.payload.done) - Number(b.payload.done)),
  })).filter((group) => group.items.length > 0)
}

export function countDone(items: ToolEntry<EnvironmentItemPayload>[]): number {
  return items.filter((entry) => entry.payload.done).length
}

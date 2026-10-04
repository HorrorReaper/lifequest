import type { ToolEntry } from '@/lib/tools/storage'

export const WHEEL_OF_LIFE_TOOL_ID = 'wheel-of-life'

export interface LifeAreaInfo {
  id: string
  label: string
  /** A few words, shown next to the label. */
  hint: string
  /** What the area covers, in a sentence or two. */
  description: string
  /** Questions to answer honestly before picking a number. */
  questions: readonly string[]
  /** What the ends and the middle of the scale look like, so a 6 means roughly the same to everyone. */
  anchors: { readonly low: string; readonly mid: string; readonly high: string }
}

export const LIFE_AREAS = [
  {
    id: 'relationships',
    label: 'Relationships',
    hint: 'Partner, family, friends',
    description:
      'The people closest to you: partner, family and friends. This is about how connected, supported and honest these relationships feel, not how many people you know.',
    questions: [
      'Is there someone you could call at 2 a.m. if things went wrong?',
      'Do you spend real, undistracted time with the people who matter to you?',
      'Are there relationships that cost you more energy than they give?',
    ],
    anchors: {
      low: 'You often feel alone, or your closest relationships are tense, distant or draining.',
      mid: 'You have people who care about you, but they get too little of your time or attention.',
      high: 'You feel deeply connected and supported, and you show up for the people you love.',
    },
  },
  {
    id: 'health',
    label: 'Health',
    hint: 'Body, sleep, energy, mind',
    description:
      'Your body and mind: sleep, movement, food, energy and how you feel emotionally day to day. Not a fitness score, but whether your health carries you or holds you back.',
    questions: [
      'Do you usually wake up rested?',
      'How do you move and eat in a normal week, not your best one?',
      'How are your energy and mood across a typical day?',
    ],
    anchors: {
      low: 'You are often tired, in pain or low, and your health limits what you can do.',
      mid: 'You get by, but sleep, movement or food are inconsistent and your energy dips.',
      high: 'You sleep well, move regularly, eat in a way that fuels you and feel energetic most days.',
    },
  },
  {
    id: 'career',
    label: 'Business & career',
    hint: 'Work, money, ambition',
    description:
      'Your work, your income and your ambition: whether what you do pays for the life you want, uses your strengths and moves you towards where you want to be.',
    questions: [
      'Does your work feel worthwhile, or do you mostly count the hours?',
      'Are you growing in what you do, or standing still?',
      'Is money a calm background topic or a constant worry?',
    ],
    anchors: {
      low: 'Work drains you or feels pointless, and money is a source of stress.',
      mid: 'Work is okay and pays the bills, but it is not where you want to be yet.',
      high: 'Your work energises you, you are growing, and your finances support your plans.',
    },
  },
  {
    id: 'fun',
    label: 'Fun & free time',
    hint: 'Hobbies, play, rest',
    description:
      'Time that is just for you: hobbies, play, rest and adventure. The things you do because you enjoy them, not because they are useful.',
    questions: [
      'When did you last do something just because it was fun?',
      'Does your time off actually recharge you?',
      'Is your free time chosen, or does it disappear into scrolling?',
    ],
    anchors: {
      low: 'There is hardly any time for yourself, or it vanishes without you enjoying it.',
      mid: 'You have some free time and a few things you enjoy, but rarely make room for them.',
      high: 'You regularly do things you love, rest without guilt and look forward to your free time.',
    },
  },
  {
    id: 'growth',
    label: 'Personal growth',
    hint: 'Learning, character, meaning',
    description:
      'Becoming more of who you want to be: learning, building character and living by what matters to you. It includes the sense that your life is going somewhere.',
    questions: [
      'Are you learning something that matters to you right now?',
      'Do you act on your values, even when it is uncomfortable?',
      'Do you know what you want your life to be about?',
    ],
    anchors: {
      low: 'You feel stuck, on autopilot, or unsure what you even want.',
      mid: 'You grow in bursts and have a rough direction, but it is not a priority yet.',
      high: 'You learn deliberately, live by your values and feel your life has direction and meaning.',
    },
  },
] as const satisfies readonly LifeAreaInfo[]

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

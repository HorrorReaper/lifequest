import type { RitualId } from '@/lib/supabase/database.types'
import {
  WEEKLY_PLAN_TEMPLATE_ID,
  WEEKLY_REVIEW_TEMPLATE_ID,
} from '@/lib/weekly-rituals'

export type { RitualId }

/**
 * One dashboard ritual's configuration: whether it prompts, when, what the
 * dialog says, and which journal template it opens.
 *
 * camelCase because it is the app's type; the database row it comes from
 * is snake_case, and `normalizeRitualSettings` is the one place that maps
 * between them.
 */
export interface RitualSetting {
  ritual: RitualId
  enabled: boolean
  /** 0 = Monday … 6 = Sunday, as weekdayOf(); null means every day. */
  weekday: number | null
  /** Minutes after local midnight the prompt may open from. */
  fromMinutes: number
  /** The journal template the prompt opens; null for the Daily Plan, or once the chosen template is gone. */
  templateId: string | null
  /** `{name}` in any of these becomes the user's name. */
  title: string
  description: string
  ctaLabel: string
}

export type RitualSettings = Record<RitualId, RitualSetting>

/** The rituals in the order the dashboard runs them through a day and a week. */
export const RITUAL_IDS: RitualId[] = [
  'daily_plan',
  'evening_review',
  'weekly_review',
  'weekly_plan',
]

/**
 * What every ritual does when its row is missing or unreadable.
 *
 * The same values the migration seeds
 * (supabase/migrations/20260919120000_create_ritual_settings.sql), minus the
 * Evening Review's template id, which differs per environment because that
 * template was made by hand. Keep the two in step: the dashboard must not
 * depend on the seed having run.
 */
export const DEFAULT_RITUAL_SETTINGS: RitualSettings = {
  daily_plan: {
    ritual: 'daily_plan',
    enabled: true,
    weekday: null,
    fromMinutes: 0,
    templateId: null,
    title: 'Welcome back, {name} 👋',
    description:
      'Want to start with your daily briefing? A few minutes now to set your Top Three makes the rest of the day easier to navigate.',
    ctaLabel: 'Start briefing',
  },
  evening_review: {
    ritual: 'evening_review',
    enabled: true,
    weekday: null,
    fromMinutes: 20 * 60,
    templateId: null,
    title: 'How was your day, {name}?',
    description:
      'Close the loop before you switch off. A couple of minutes to reflect on today and set tomorrow\'s focus.',
    ctaLabel: 'Start evening review',
  },
  weekly_review: {
    ritual: 'weekly_review',
    enabled: true,
    weekday: 6,
    fromMinutes: 18 * 60,
    templateId: WEEKLY_REVIEW_TEMPLATE_ID,
    title: 'How was your week, {name}?',
    description:
      'Step back before the next one starts. A few minutes on what worked, what did not, and what you want to change.',
    ctaLabel: 'Start weekly review',
  },
  weekly_plan: {
    ritual: 'weekly_plan',
    enabled: true,
    weekday: 0,
    fromMinutes: 0,
    templateId: WEEKLY_PLAN_TEMPLATE_ID,
    title: 'New week, {name} 🗓️',
    description:
      'Give the week a theme and three outcomes before the days start deciding for you. Each morning\'s briefing gets easier with them set.',
    ctaLabel: 'Plan the week',
  },
}

const RITUAL_ID_SET = new Set<string>(RITUAL_IDS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function intInRange(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * Reads what the database returned for `ritual_settings`, keeping what
 * passes the checks and falling back to the default for anything else --
 * per field, so one bad value does not throw away the rest of the row, and
 * never throwing, so a broken row cannot take the dashboard down with it.
 * Rows for rituals this build does not know are dropped.
 */
export function normalizeRitualSettings(rows: unknown): RitualSettings {
  const settings: RitualSettings = { ...DEFAULT_RITUAL_SETTINGS }
  if (!Array.isArray(rows)) return settings

  for (const row of rows) {
    if (!isRecord(row) || typeof row.ritual !== 'string' || !RITUAL_ID_SET.has(row.ritual)) continue
    const ritual = row.ritual as RitualId
    const fallback = DEFAULT_RITUAL_SETTINGS[ritual]
    settings[ritual] = {
      ritual,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : fallback.enabled,
      weekday: row.weekday === null ? null : intInRange(row.weekday, 0, 6) ?? fallback.weekday,
      fromMinutes: intInRange(row.from_minutes, 0, 1439) ?? fallback.fromMinutes,
      templateId:
        row.template_id === null
          ? null
          : nonEmptyString(row.template_id) ?? fallback.templateId,
      title: nonEmptyString(row.title) ?? fallback.title,
      description: nonEmptyString(row.description) ?? fallback.description,
      ctaLabel: nonEmptyString(row.cta_label) ?? fallback.ctaLabel,
    }
  }

  return settings
}

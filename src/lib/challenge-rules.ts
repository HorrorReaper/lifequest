import type { ChallengeCompletionType } from '@/lib/supabase/database.types'

/**
 * The Challenge Reflection journal template and its one answer field,
 * seeded by 20260922120000_challenge_engine.sql. A reflection day is done
 * when the user answers the day's reflection prompt in this template.
 */
export const CHALLENGE_REFLECTION_TEMPLATE_ID = 'afc4f953-3ad1-432f-abd4-acab80f82e68'

/**
 * How a challenge day can be completed.
 *
 * `manual` is ticked off by the user. Every other rule is detected from what
 * the user did in the app and evaluated in SQL (challenge_rule_count, last
 * defined in supabase/migrations/20261001130000_reconcile_challenge_engine.sql),
 * which is the only place that decides. This module is the vocabulary around
 * it: labels for the admin editor, wording for the user, and a default deep
 * link. Keep the ids in step with the check constraint in that migration.
 *
 * "state" rules look at what exists right now (a user who already has three
 * habits meets "have three habits" on the spot); "activity" rules count what
 * happened since the day became available.
 */
export interface ChallengeRuleDef {
  id: ChallengeCompletionType
  kind: 'manual' | 'state' | 'activity'
  /** Shown in the admin rule picker. */
  adminLabel: string
  /** Which extra parameter the rule takes, if any. */
  param?: 'journal_template' | 'tool'
  /** Singular/plural noun for "2 of 3 habits". */
  unit: [singular: string, plural: string]
  /** Where the action happens, when the admin does not set a link. */
  defaultHref?: string
  defaultActionLabel?: string
}

export const CHALLENGE_RULES: ChallengeRuleDef[] = [
  {
    id: 'manual',
    kind: 'manual',
    adminLabel: 'Manual · user ticks the day off',
    unit: ['step', 'steps'],
  },
  {
    id: 'reflection',
    kind: 'activity',
    adminLabel: 'Answers the reflection question in the journal',
    unit: ['reflection', 'reflections'],
    defaultHref: `/journal/new/${CHALLENGE_REFLECTION_TEMPLATE_ID}`,
    defaultActionLabel: 'Write reflection',
  },
  {
    id: 'habits_active',
    kind: 'state',
    adminLabel: 'Has at least N active habits',
    unit: ['active habit', 'active habits'],
    defaultHref: '/habits',
    defaultActionLabel: 'Open habits',
  },
  {
    id: 'habits_created',
    kind: 'activity',
    adminLabel: 'Creates N new habits',
    unit: ['new habit', 'new habits'],
    defaultHref: '/habits',
    defaultActionLabel: 'Create a habit',
  },
  {
    id: 'habit_checkins',
    kind: 'activity',
    adminLabel: 'Checks in N habits',
    unit: ['habit check-in', 'habit check-ins'],
    defaultHref: '/habits',
    defaultActionLabel: 'Check in habits',
  },
  {
    id: 'journal_entries',
    kind: 'activity',
    adminLabel: 'Completes N journal entries (optionally one template)',
    param: 'journal_template',
    unit: ['journal entry', 'journal entries'],
    defaultHref: '/journal',
    defaultActionLabel: 'Open journal',
  },
  {
    id: 'day_plans',
    kind: 'activity',
    adminLabel: 'Plans N days',
    unit: ['planned day', 'planned days'],
    defaultHref: '/plan',
    defaultActionLabel: 'Plan your day',
  },
  {
    id: 'tasks_created',
    kind: 'activity',
    adminLabel: 'Creates N tasks',
    unit: ['new task', 'new tasks'],
    defaultHref: '/tasks',
    defaultActionLabel: 'Open tasks',
  },
  {
    id: 'tasks_completed',
    kind: 'activity',
    adminLabel: 'Completes N tasks',
    unit: ['completed task', 'completed tasks'],
    defaultHref: '/tasks',
    defaultActionLabel: 'Open tasks',
  },
  {
    id: 'goals_active',
    kind: 'state',
    adminLabel: 'Has at least N goals',
    unit: ['goal', 'goals'],
    defaultHref: '/dashboard',
    defaultActionLabel: 'Set a goal',
  },
  {
    id: 'goals_created',
    kind: 'activity',
    adminLabel: 'Sets N new goals',
    unit: ['new goal', 'new goals'],
    defaultHref: '/dashboard',
    defaultActionLabel: 'Set a goal',
  },
  {
    id: 'learnings_captured',
    kind: 'activity',
    adminLabel: 'Captures N learnings',
    unit: ['learning', 'learnings'],
    defaultHref: '/learnings',
    defaultActionLabel: 'Open learnings',
  },
  {
    id: 'tool_entries',
    kind: 'activity',
    adminLabel: 'Uses a tool N times',
    param: 'tool',
    unit: ['tool entry', 'tool entries'],
    defaultHref: '/learn/tools',
    defaultActionLabel: 'Open tool',
  },
]

const RULES_BY_ID = new Map(CHALLENGE_RULES.map((rule) => [rule.id, rule]))

export function getChallengeRule(id: string | null | undefined): ChallengeRuleDef {
  return RULES_BY_ID.get(id as ChallengeCompletionType) ?? RULES_BY_ID.get('manual')!
}

export function isAutomaticRule(id: string | null | undefined): boolean {
  return getChallengeRule(id).kind !== 'manual'
}

export function ruleUnit(id: string | null | undefined, count: number): string {
  const [singular, plural] = getChallengeRule(id).unit
  return count === 1 ? singular : plural
}

/** "2 / 3 active habits", clamped so a surplus never reads as 5 / 3. */
export function formatRuleProgress(id: string | null | undefined, progress: number, target: number): string {
  const shown = Math.min(Math.max(progress, 0), target)
  return `${shown} / ${target} ${ruleUnit(id, target)}`
}

/** The day's button: the admin's link, else the rule's default, else none. */
export function resolveDayAction(day: {
  completion_type: string | null
  completion_param: string | null
  action_href: string | null
  action_label: string | null
}): { href: string; label: string } | null {
  const rule = getChallengeRule(day.completion_type)
  let href = day.action_href?.trim() || null
  if (!href && rule.id === 'tool_entries' && day.completion_param) {
    href = `/learn/tools/${encodeURIComponent(day.completion_param)}`
  }
  if (!href && rule.id === 'journal_entries' && day.completion_param) {
    href = `/journal/new/${encodeURIComponent(day.completion_param)}`
  }
  href = href ?? rule.defaultHref ?? null
  if (!href || !isSafeInternalHref(href)) return null
  return { href, label: day.action_label?.trim() || rule.defaultActionLabel || 'Open' }
}

/**
 * Same-origin path only, mirroring challenge_days_action_href_check. A day's
 * button must never become an open redirect.
 */
export function isSafeInternalHref(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') && value.length <= 200
}

/** A URL-safe slug for a challenge's public page. */
export function slugifyChallengeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

export const CHALLENGE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function isValidChallengeSlug(value: string): boolean {
  return value.length >= 3 && value.length <= 80 && CHALLENGE_SLUG_PATTERN.test(value)
}

/** The query parameter a tool page reads to offer the way back to a challenge. */
export const CHALLENGE_RETURN_PARAM = 'challenge'

/**
 * Tags a day's button with the challenge it belongs to, so the page it
 * opens can say "this is part of your challenge" and lead back once saved.
 * Tool pages and new journal entries read it; every other link is returned
 * unchanged.
 */
export function withChallengeReturn(href: string, templateId: string): string {
  if (!href.startsWith('/learn/tools/') && !href.startsWith('/journal/new/')) return href
  const [path, query = ''] = href.split('?', 2)
  const params = new URLSearchParams(query)
  params.set(CHALLENGE_RETURN_PARAM, templateId)
  return `${path}?${params.toString()}`
}

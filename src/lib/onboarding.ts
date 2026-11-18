import type { GoalCategory } from '@/lib/types'

/**
 * The first-run flow at /onboarding: name, age, a goal, reminders, and the
 * first step of the day. Pure helpers here; the screens are in
 * `src/components/onboarding/onboarding-flow.tsx`.
 */

/** The steps in order. `reminders` is left out where push is unavailable. */
export const ONBOARDING_STEPS = ['welcome', 'name', 'age', 'goal', 'reminders', 'start', 'done'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

/** The steps that ask something, for "2 / 5" in the header. */
export function questionSteps(withReminders: boolean): OnboardingStep[] {
  return ONBOARDING_STEPS.filter(
    (step) => step !== 'welcome' && step !== 'done' && (withReminders || step !== 'reminders')
  )
}

/**
 * The range an age is accepted in. The floor is the usual minimum age for an
 * account rather than anything this app enforces elsewhere.
 */
export const MIN_AGE = 13
export const MAX_AGE = 120

export function isValidAge(value: string): boolean {
  if (!/^\d{1,3}$/.test(value.trim())) return false
  const age = Number(value)
  return age >= MIN_AGE && age <= MAX_AGE
}

/**
 * The year someone was born, from the age they gave. Off by one for anyone
 * whose birthday has not passed yet this year, which is why
 * `profiles.birth_year` is documented as approximate.
 */
export function birthYearFromAge(age: number, today = new Date()): number {
  return today.getFullYear() - age
}

/** The goal areas offered, in order, each with an example goal as placeholder. */
export const ONBOARDING_GOAL_AREAS: ReadonlyArray<{
  category: GoalCategory
  label: string
  example: string
}> = [
  { category: 'health', label: 'Health', example: 'Run a half marathon' },
  { category: 'career', label: 'Career', example: 'Get the promotion' },
  { category: 'learning', label: 'Learning', example: 'Read 12 books this year' },
  { category: 'relationships', label: 'Relationships', example: 'Call my parents every week' },
  { category: 'personal', label: 'Personal', example: 'Wake up before 7' },
  { category: 'finance', label: 'Finance', example: 'Save 3 months of expenses' },
]

/**
 * How far the trail scene has grown on a step (`DashboardHeroScene` stage):
 * bare at the start, green with the first answers, in bloom by the end.
 */
export function sceneStageFor(step: OnboardingStep): 0 | 1 | 2 {
  if (step === 'welcome' || step === 'name') return 0
  if (step === 'age' || step === 'goal') return 1
  return 2
}

export interface OnboardingTemplate {
  id: string
  name: string
  description: string | null
  entry_type: string
  xp_reward: number
  sort_order: number | null
}

export type StartOption =
  | { kind: 'plan'; id: 'plan'; title: string; detail: string; href: string }
  | {
      kind: 'template'
      id: string
      title: string
      detail: string
      xpReward: number
      entryType: string
      href: string
    }

/** Where the daily plan option leads: the full ritual, mood first. */
export const PLAN_START_HREF = '/plan?step=ritual'

/**
 * What the last step offers: the daily plan first, then every active system
 * journal template in their sort order. Two system templates with the same
 * name (an older seed next to the one the weekly ritual uses) are shown
 * once, the later one in the sort order.
 */
export function startOptions(templates: readonly OnboardingTemplate[]): StartOption[] {
  const sorted = [...templates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const byName = new Map<string, OnboardingTemplate>()
  for (const template of sorted) byName.set(template.name.trim().toLowerCase(), template)
  const unique = sorted.filter(
    (template) => byName.get(template.name.trim().toLowerCase()) === template
  )

  return [
    {
      kind: 'plan',
      id: 'plan',
      title: 'Plan today',
      detail: 'How you feel, what you are grateful for, and what matters most.',
      href: PLAN_START_HREF,
    },
    ...unique.map((template) => ({
      kind: 'template' as const,
      id: template.id,
      title: template.name,
      detail: template.description ?? '',
      xpReward: template.xp_reward,
      entryType: template.entry_type,
      href: `/journal/new/${encodeURIComponent(template.id)}?firstEntry=1`,
    })),
  ]
}

/** "08:00" from minutes after midnight, for the reminder times shown. */
export function clockFromMinutes(minutes: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

import type { ChallengeCompletionType, ChallengeDayRow, ChallengeTemplateRow } from '@/lib/supabase/database.types'
import { getChallengeRule, isSafeInternalHref, isValidChallengeSlug } from '@/lib/challenge-rules'

// The admin editor's working copy of a challenge, and the conversions to and
// from what admin_save_challenge_template takes. Pure, so the rules the
// editor enforces before saving are tested without a browser.

export interface DayDraft {
  title: string
  instructions: string
  reflection_prompt: string
  completion_type: ChallengeCompletionType
  completion_target: number
  completion_param: string
  action_href: string
  action_label: string
}

export interface ChallengeDraft {
  id: string | null
  title: string
  tagline: string
  description: string
  slug: string
  schedule_mode: 'sequential' | 'strict'
  xp_reward: number
  coin_reward: number
  is_published: boolean
  days: DayDraft[]
}

export function blankDay(patch: Partial<DayDraft> = {}): DayDraft {
  return {
    title: '',
    instructions: '',
    reflection_prompt: '',
    completion_type: 'manual',
    completion_target: 1,
    completion_param: '',
    action_href: '',
    action_label: '',
    ...patch,
  }
}

export function blankChallengeDraft(): ChallengeDraft {
  return {
    id: null,
    title: '',
    tagline: '',
    description: '',
    slug: '',
    schedule_mode: 'sequential',
    xp_reward: 500,
    coin_reward: 250,
    is_published: false,
    days: [blankDay()],
  }
}

/**
 * Stands in for instructions not written yet, so a half-finished challenge
 * can be saved as a draft (the table requires instructions) but not
 * published.
 */
export const DAY_INSTRUCTIONS_PLACEHOLDER = 'To be written.'

/**
 * The frame for the 14-day "Unfuck Your Life" challenge: fourteen empty days
 * with a slug for its landing page, unpublished. The content is written in
 * the editor.
 */
export function unfuckYourLifeDraft(): ChallengeDraft {
  return {
    ...blankChallengeDraft(),
    title: 'Unfuck Your Life',
    slug: 'unfuck-your-life',
    xp_reward: 1000,
    coin_reward: 500,
    days: Array.from({ length: 14 }, (_, index) =>
      index === 0
        ? // Day 1 is decided: write down where you are headed, in the Vision
          // tool, detected automatically. The instructions are still the
          // admin's to write.
          blankDay({
            title: 'Write down your vision',
            instructions: DAY_INSTRUCTIONS_PLACEHOLDER,
            completion_type: 'tool_entries',
            completion_param: 'vision',
            action_label: 'Open Vision',
          })
        : blankDay({ title: `Day ${index + 1}`, instructions: DAY_INSTRUCTIONS_PLACEHOLDER })
    ),
  }
}

export function draftFromTemplate(template: ChallengeTemplateRow, days: ChallengeDayRow[]): ChallengeDraft {
  return {
    id: template.id,
    title: template.title,
    tagline: template.tagline ?? '',
    description: template.description ?? '',
    slug: template.slug ?? '',
    schedule_mode: template.schedule_mode,
    xp_reward: template.xp_reward,
    coin_reward: template.coin_reward,
    is_published: template.is_published,
    days: [...days]
      .sort((a, b) => a.day_number - b.day_number)
      .map((day) =>
        blankDay({
          title: day.title,
          instructions: day.instructions,
          reflection_prompt: day.reflection_prompt ?? '',
          completion_type: day.completion_type ?? 'manual',
          completion_target: day.completion_target ?? 1,
          completion_param: day.completion_param ?? '',
          action_href: day.action_href ?? '',
          action_label: day.action_label ?? '',
        })
      ),
  }
}

/**
 * The first thing stopping this draft from saving, or null. Publishing is
 * stricter: no day may still carry the placeholder.
 */
export function validateChallengeDraft(
  draft: ChallengeDraft,
  options: { publishing?: boolean } = {}
): string | null {
  if (!draft.title.trim()) return 'Give the challenge a title.'
  if (draft.title.trim().length > 120) return 'The title can be at most 120 characters.'
  if (draft.tagline.trim().length > 200) return 'The tagline can be at most 200 characters.'
  const slug = draft.slug.trim()
  if (slug && !isValidChallengeSlug(slug)) {
    return 'The public link may only use lowercase letters, digits and single dashes (3–80 characters).'
  }
  if (draft.days.length < 1 || draft.days.length > 365) return 'A challenge needs between 1 and 365 days.'
  for (const [index, day] of draft.days.entries()) {
    const label = `Day ${index + 1}`
    if (!day.title.trim()) return `${label} needs a title.`
    if (day.title.trim().length > 120) return `${label}: the title can be at most 120 characters.`
    if (!day.instructions.trim()) return `${label} needs instructions.`
    if (options.publishing && day.instructions.trim() === DAY_INSTRUCTIONS_PLACEHOLDER) {
      return `${label} still needs its instructions before the challenge can go live.`
    }
    if (day.instructions.trim().length > 2000) return `${label}: instructions can be at most 2000 characters.`
    if (day.reflection_prompt.trim().length > 500) return `${label}: the reflection prompt can be at most 500 characters.`
    const rule = getChallengeRule(day.completion_type)
    if (rule.id !== 'manual' && !(day.completion_target >= 1 && day.completion_target <= 100)) {
      return `${label}: the target must be between 1 and 100.`
    }
    if (rule.param === 'tool' && !day.completion_param) return `${label}: pick the tool.`
    const href = day.action_href.trim()
    if (href && !isSafeInternalHref(href)) return `${label}: the button link must be an app path starting with a single “/”.`
    if (day.action_label.trim().length > 40) return `${label}: the button label can be at most 40 characters.`
  }
  return null
}

/** The p_days payload for admin_save_challenge_template. */
export function draftDaysPayload(days: DayDraft[]) {
  return days.map((day) => {
    const rule = getChallengeRule(day.completion_type)
    return {
      title: day.title.trim(),
      instructions: day.instructions.trim(),
      reflection_prompt: day.reflection_prompt.trim(),
      completion_type: rule.id,
      completion_target: rule.id === 'manual' ? 1 : Math.round(day.completion_target),
      completion_param: rule.param ? day.completion_param.trim() : '',
      action_href: day.action_href.trim(),
      action_label: day.action_label.trim(),
    }
  })
}

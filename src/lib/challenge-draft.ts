import type { ChallengeCompletionType, ChallengeDayRow, ChallengeTemplateRow } from '@/lib/supabase/database.types'
import { getChallengeRule, isSafeInternalHref, isValidChallengeSlug } from '@/lib/challenge-rules'
import { WEEKLY_PLAN_TEMPLATE_ID } from '@/lib/weekly-rituals'

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
 * The first draft of "14 Days to Unfuck Your Life", loaded by the Challenge
 * Lab's button as an unpublished challenge. A starting point to edit, not a
 * fixed program: every text, rule and link can change in the editor.
 *
 * The arc: week one gives direction (vision, goals, next steps, one habit)
 * and the first proof of change; week two clears what is in the way (time,
 * environment, fear) and closes by measuring the life areas again and
 * looking back.
 */
export function unfuckYourLifeDraft(): ChallengeDraft {
  const tool = (id: string, label: string) =>
    ({ completion_type: 'tool_entries', completion_param: id, action_label: label }) as const

  return {
    ...blankChallengeDraft(),
    title: '14 Days to Unfuck Your Life',
    tagline: 'Fourteen days, one honest step a day. From stuck and scattered to clear and moving.',
    description:
      'No 5 a.m. routine, no cold plunges, no reinventing yourself overnight. For fourteen days you take one concrete step a day: ' +
      'decide where you are going, turn it into goals and a daily habit, and clear out what keeps getting in the way. ' +
      'Most steps take 10 to 30 minutes, and LifeQuest notices when you have done them.',
    slug: 'unfuck-your-life',
    xp_reward: 1000,
    coin_reward: 500,
    days: [
      blankDay({
        title: 'Write down your vision',
        instructions:
          'Before anything else: where do you actually want to go?\n\n' +
          'Warm up with two minutes in the Wheel of Life (Toolbox): rate your five life areas from 1 to 10. You will do it again on day 13 and see what moved.\n\n' +
          'Then open Vision and describe your life three years from now, in the present tense, as if it were already true. ' +
          'How does a normal Tuesday look? Who is around you? What do you do, and how do you feel? ' +
          'It does not have to be perfect, it has to be written down. Ten minutes are enough.',
        ...tool('vision', 'Write your vision'),
      }),
      blankDay({
        title: 'Turn your vision into SMART goals',
        instructions:
          'A vision is a direction. A goal is something you can hit.\n\n' +
          'Pick one to three goals that move you toward your vision and make each one SMART: Specific, Measurable, Achievable, Relevant, Time-bound. ' +
          '“Get fit” becomes “Run 5 km without stopping by 30 March”.\n\n' +
          'Add them as goals in LifeQuest: a clear title, why it matters to you, and a target date.',
        completion_type: 'goals_created',
        completion_target: 1,
        action_label: 'Set your goals',
      }),
      blankDay({
        title: 'Break your goals into next steps',
        instructions:
          'Big goals stall because the next step is unclear.\n\n' +
          'Open Goal Breakdown and take your most important goal apart: two to four sub-goals, and under each the concrete actions that get you there. ' +
          'Keep going until every action is something you could start within a day.\n\n' +
          'Then put the first two actions on your task list.',
        ...tool('goal-breakdown', 'Open Goal Breakdown'),
      }),
      blankDay({
        title: 'Start one daily habit',
        instructions:
          'Goals tell you where to go. Habits are what gets you there when motivation is gone.\n\n' +
          'Choose one small habit that moves your most important goal forward every day. Make it so small you cannot fail: ' +
          'ten minutes, one page, one rep. Create it in Habits and check it in today.\n\n' +
          'From now on, check it in every day of this challenge. Ten days of repetition are worth more than a perfect plan.',
        completion_type: 'habits_created',
        completion_target: 1,
        action_label: 'Create your habit',
      }),
      blankDay({
        title: 'Win back 30 minutes of screen time',
        instructions:
          'Most of the time you think you do not have is in your phone.\n\n' +
          'Look at your screen time from yesterday. Today, use 30 minutes less: delete or log out of one app, turn off non-essential notifications, ' +
          'and keep your phone out of reach for your first hour.\n\n' +
          'Spend the 30 minutes you win on your habit or your first next step. Tonight, compare and tick the day off.',
        reflection_prompt: 'How much screen time did you have today, and what did you do with the time you won back?',
      }),
      blankDay({
        title: 'Decide who you need to be',
        instructions:
          'You do not rise to your goals, you fall to your identity.\n\n' +
          'Open Identity and write three lines that start with “I am someone who…”: the person who naturally reaches your goals. ' +
          'Describe behaviour, not results: “I am someone who trains four times a week”, not “I am fit”.\n\n' +
          'Then write one small thing that person would do today, and do it.',
        ...tool('identity', 'Open Identity'),
      }),
      blankDay({
        title: 'Look back on week one',
        instructions:
          'Half-time. Before you plan the next week, look honestly at this one.\n\n' +
          'Write your reflection: what you started, what you avoided, and what surprised you. No judgement, just facts and what you learned from them.',
        completion_type: 'reflection',
        reflection_prompt:
          'What has changed since day 1? What worked, what did you avoid, and what will you do differently next week?',
        action_label: 'Write your reflection',
      }),
      blankDay({
        title: 'Plan week two around your goals',
        instructions:
          'Now plan the week like the person you described on day 6 would.\n\n' +
          'Open the Weekly Plan: give the week a theme and three outcomes that move your goals forward. ' +
          'Put your daily habit into it, and block 30 minutes for tomorrow: your first dream block.',
        completion_type: 'journal_entries',
        completion_target: 1,
        completion_param: WEEKLY_PLAN_TEMPLATE_ID,
        action_label: 'Plan your week',
      }),
      blankDay({
        title: 'Do a 30-minute dream block',
        instructions:
          'Today you do not plan, you work on your dream.\n\n' +
          'Take the 30 minutes you blocked yesterday. Phone in another room, one task from your goal breakdown, timer on, go. ' +
          'Not answering emails about it, not reading about it: doing it.\n\n' +
          'When the 30 minutes are up, tick the day off and note what you did.',
        reflection_prompt: 'What did you work on, and how did it feel to spend 30 minutes on your own goal?',
        action_href: '/plan',
        action_label: 'Open your plan',
      }),
      blankDay({
        title: 'Find out where your time goes',
        instructions:
          'You cannot change what you do not see.\n\n' +
          'Open Time Audit and log today in 15-minute blocks, as honestly as you can. Mark what was deliberate and what simply happened. ' +
          'Tonight, look at the summary: where did time leak away, and which single leak would you close first?',
        ...tool('time-audit', 'Open Time Audit'),
      }),
      blankDay({
        title: 'Audit your environment',
        instructions:
          'Your environment beats your willpower, every time.\n\n' +
          'Open Environment Audit and walk through four areas: your physical space, your digital life, the people around you, and your routines. ' +
          'List at least three things that pull you away from your goals.\n\n' +
          'Then remove or change at least one of them today, and mark it as done.',
        ...tool('environment-audit', 'Open Environment Audit'),
      }),
      blankDay({
        title: 'Face one fear',
        instructions:
          'Most of what holds you back is not a lack of time, it is fear dressed up as reasons.\n\n' +
          'Open Limiting Beliefs: write down the belief behind the fear, the evidence against it, and a more realistic belief.\n\n' +
          'Then do one thing today that scares you a little: the message you have not sent, the question you have not asked, the first post, the first call.',
        ...tool('limiting-beliefs', 'Open Limiting Beliefs'),
      }),
      blankDay({
        title: 'Rate your life areas again',
        instructions:
          'Two weeks ago you rated your life. Do it again, honestly.\n\n' +
          'Open the Wheel of Life and rate Relationships, Health, Business & career, Fun & free time and Personal growth from 1 to 10. ' +
          'Look at what moved and what did not. Pick the area with the most room to grow: that is where your habit and goals should point next.',
        ...tool('wheel-of-life', 'Open Wheel of Life'),
      }),
      blankDay({
        title: 'Look back, learn, and be grateful',
        instructions:
          'You did fourteen days. That alone is more than most people do.\n\n' +
          'Write your final reflection: what you learned, what you are grateful for, and what you keep doing from here. ' +
          'Read your vision from day 1 once more before you start.',
        completion_type: 'reflection',
        reflection_prompt:
          'What are the three most important things you learned in these 14 days, what are you grateful for, and what will you keep doing?',
        action_label: 'Write your reflection',
      }),
    ],
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
    if (day.completion_type === 'reflection' && !day.reflection_prompt.trim()) {
      return `${label}: a reflection day needs the question to answer.`
    }
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

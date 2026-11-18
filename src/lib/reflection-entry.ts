import type { SupabaseClient } from '@supabase/supabase-js'
import { dateInTimezone } from '@/lib/dates'
import type { StreakCelebration } from '@/lib/streak'
import { recordStreakDay } from '@/lib/streak-day'
import { supabaseInsert, supabaseFrom } from '@/lib/supabase/helpers'
import { DAILY_REFLECTION_FIELD_ID, DAILY_REFLECTION_TEMPLATE_ID } from '@/lib/daily-reflection'

export interface SaveReflectionParams {
  userId: string
  timezone: string
  text: string
  /** Injectable for tests; defaults to the real clock. */
  now?: Date
}

export interface SaveReflectionResult {
  entryId: string
  /** Entry XP plus any streak milestone bonus this save triggered. */
  xpEarned: number
  totalXp: number
  streak: number
  /** Set when this save grew the streak; null otherwise. */
  celebration: StreakCelebration | null
}

/**
 * Writes one Daily Reflection entry and settles the XP and streak it earns.
 *
 * This is the same pipeline `entry-form.tsx`'s submit handler runs, trimmed to
 * what this one template actually needs: a single textarea field with no XP
 * rules of its own, on a `free_write` template, which structurally rules out
 * the morning+evening same-day bonus and every field-type-specific branch
 * (learning, tasks, day planner, habit tracker) the general form also
 * handles. Kept separate from that 900+ line file rather than folding this
 * in there, so the dashboard's inline composer does not have to touch the
 * app's central save path to gain its own entry point.
 */
export async function saveReflectionEntry(
  supabase: SupabaseClient,
  { userId, timezone, text, now = new Date() }: SaveReflectionParams
): Promise<SaveReflectionResult> {
  const answer = text.trim()
  if (!answer) throw new Error('A reflection needs something written in it.')

  const { data: templateData, error: templateError } = await supabase
    .from('journal_templates')
    .select('name, xp_reward')
    .eq('id', DAILY_REFLECTION_TEMPLATE_ID)
    .single()
  if (templateError) throw templateError
  const template = templateData as { name: string; xp_reward: number }

  const today = dateInTimezone(now, timezone)

  const { data: entryData, error: entryError } = await supabaseFrom(supabase, 'journal_entries')
    .insert({
      user_id: userId,
      template_id: DAILY_REFLECTION_TEMPLATE_ID,
      entry_date: today,
      is_complete: true,
      xp_earned: template.xp_reward,
    })
    .select('id')
    .single()
  if (entryError) throw entryError
  const entryId = (entryData as { id: string }).id

  const { error: responseError } = await supabaseInsert(supabase, 'journal_responses', {
    entry_id: entryId,
    field_id: DAILY_REFLECTION_FIELD_ID,
    value_text: answer,
    value_number: null,
    value_boolean: null,
    value_json: null,
    insight_type: null,
    topic_tags: [],
    insight_marked_at: null,
    insight_is_favorite: false,
  })
  if (responseError) throw responseError

  const { error: xpEventError } = await supabaseInsert(supabase, 'xp_events', {
    user_id: userId,
    source_type: 'journal',
    source_id: entryId,
    xp_amount: template.xp_reward,
    description: `Completed ${template.name}`,
  })
  if (xpEventError) throw xpEventError

  const settled = await recordStreakDay(supabase, {
    userId,
    today,
    xp: template.xp_reward,
    sourceId: entryId,
  })

  return {
    entryId,
    xpEarned: settled.xpEarned,
    totalXp: settled.totalXp,
    streak: settled.streak,
    celebration: settled.celebration,
  }
}

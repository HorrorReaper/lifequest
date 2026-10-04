import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchChallengePrograms } from '@/lib/challenge-programs'
import type { ChallengeDayRow } from '@/lib/supabase/database.types'

/**
 * The challenge a page was opened from, read from the ?challenge= parameter
 * a day's button carries (see withChallengeReturn). Pages use it to say which
 * step they belong to, to show the day's reflection question, and to lead
 * back. It is a view hint only: completion is decided by the challenge RPCs.
 */
export interface ChallengeContext {
  templateId: string
  enrollmentId: string
  title: string
  dayNumber: number
  totalDays: number
  /** The day the user is on, or null if the challenge has no such row. */
  day: ChallengeDayRow | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves the parameter, or null when it is missing, malformed, or names a
 * challenge the user is not actively doing. A crafted link can therefore
 * only ever produce the plain page.
 */
export async function fetchChallengeContext(
  supabase: SupabaseClient,
  userId: string,
  value: string | string[] | undefined
): Promise<ChallengeContext | null> {
  const templateId = typeof value === 'string' ? value : null
  if (!templateId || !UUID_PATTERN.test(templateId)) return null
  const [program] = await fetchChallengePrograms(supabase, userId, { templateId })
  if (!program?.enrollment || program.enrollment.status !== 'active') return null
  const dayNumber = Math.min(program.progress.length + 1, program.template.duration_days)
  return {
    templateId,
    enrollmentId: program.enrollment.id,
    title: program.template.title,
    dayNumber,
    totalDays: program.template.duration_days,
    day: program.days.find((day) => day.day_number === dayNumber) ?? null,
  }
}

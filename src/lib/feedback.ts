import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Beta feedback, written to `beta_feedback`
 * (supabase/migrations/20261025120000_beta_feedback_and_activation.sql).
 *
 * The message is what the user chose to write to us; nothing else about them
 * is attached except their account (by RLS default) and the page path they
 * sent it from -- without its query string, which can carry ids.
 */
export type FeedbackCategory = 'problem' | 'idea' | 'other'

export const FEEDBACK_CATEGORIES: ReadonlyArray<{ value: FeedbackCategory; label: string }> = [
  { value: 'problem', label: 'Something is not working' },
  { value: 'idea', label: 'An idea' },
  { value: 'other', label: 'Something else' },
]

export const FEEDBACK_MAX_LENGTH = 2000

/** The path part only, capped to what the column accepts. */
export function feedbackPagePath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const path = pathname.split(/[?#]/)[0]
  return path.slice(0, 200) || null
}

export async function sendFeedback(
  supabase: SupabaseClient,
  input: { category: FeedbackCategory; message: string; pagePath: string | null }
): Promise<void> {
  const message = input.message.trim()
  if (!message) throw new Error('Write a short message first.')
  const { error } = await supabase.from('beta_feedback').insert({
    category: input.category,
    message: message.slice(0, FEEDBACK_MAX_LENGTH),
    page_path: feedbackPagePath(input.pagePath),
  })
  if (error) throw error
}

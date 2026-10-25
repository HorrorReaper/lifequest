/**
 * The beta activation funnel from `admin_activation_funnel`
 * (supabase/migrations/20261025120000_beta_feedback_and_activation.sql).
 *
 * Counts only. The function derives every step from rows the app already
 * stores, so there is no event log and nothing personal is copied into one.
 */
export interface ActivationStep {
  key: ActivationStepKey
  label: string
  count: number
}

export type ActivationStepKey =
  | 'signed_up'
  | 'onboarding_completed'
  | 'first_task'
  | 'first_plan'
  | 'first_habit_checkin'
  | 'returned_later_day'

const STEPS: ReadonlyArray<{ key: ActivationStepKey; label: string }> = [
  { key: 'signed_up', label: 'Signed up' },
  { key: 'onboarding_completed', label: 'Onboarding completed' },
  { key: 'first_task', label: 'First task saved' },
  { key: 'first_plan', label: 'First plan saved' },
  { key: 'first_habit_checkin', label: 'First habit check-in' },
  { key: 'returned_later_day', label: 'Came back on a later day' },
]

function count(value: unknown): number {
  // bigint columns can arrive as strings; anything unreadable is zero.
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

/** The RPC's single row as ordered steps; null when there is no row. */
export function buildActivationSteps(row: unknown): ActivationStep[] | null {
  const data = Array.isArray(row) ? row[0] : row
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  return STEPS.map((step) => ({ ...step, count: count(record[step.key]) }))
}

/** Share of sign-ups that reached a step, as a whole percent. */
export function activationRate(step: ActivationStep, signedUp: number): number {
  return signedUp > 0 ? Math.round((step.count / signedUp) * 100) : 0
}

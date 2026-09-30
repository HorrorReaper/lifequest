// A personal challenge: "X days of Y" that a user sets up for themselves.
// It is stored as an ordinary challenge template with is_personal = true and
// the same daily action on every day, so it runs through the same pages,
// RPCs and dashboard card as the challenges admins publish.
//
// create_personal_challenge (20260930140000_personal_challenges.sql) is the
// authority on every rule here; this mirrors it so the form can say what is
// wrong before a round trip.

export interface PersonalChallengeInput {
  title: string
  task: string
  days: number
  description: string
  scheduleMode: 'sequential' | 'strict'
}

export const PERSONAL_CHALLENGE_DAY_PRESETS = [7, 14, 21, 30, 66] as const

/** Set by the server, not the user: per day of the challenge. */
export const PERSONAL_CHALLENGE_XP_PER_DAY = 10
export const PERSONAL_CHALLENGE_COINS_PER_DAY = 5

export function personalChallengeReward(days: number): { xp: number; coins: number } {
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.round(days)) : 0
  return {
    xp: safeDays * PERSONAL_CHALLENGE_XP_PER_DAY,
    coins: safeDays * PERSONAL_CHALLENGE_COINS_PER_DAY,
  }
}

export function blankPersonalChallenge(): PersonalChallengeInput {
  return { title: '', task: '', days: 30, description: '', scheduleMode: 'sequential' }
}

/** The first problem with the input, or null when it can be created. */
export function validatePersonalChallenge(input: PersonalChallengeInput): string | null {
  const title = input.title.trim()
  const task = input.task.trim()
  if (!title) return 'Give your challenge a title.'
  if (title.length > 120) return 'The title can be at most 120 characters.'
  if (!task) return 'Describe what you will do each day.'
  if (task.length > 120) return 'Keep the daily action to 120 characters.'
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > 365) {
    return 'A challenge runs between 1 and 365 days.'
  }
  if (input.description.trim().length > 2000) return 'The description can be at most 2000 characters.'
  return null
}

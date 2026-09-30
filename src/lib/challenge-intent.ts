import { isValidChallengeSlug } from '@/lib/challenge-rules'

/**
 * Remembers which challenge someone clicked "Start" on before they had an
 * account, so it can be started for them once signup and onboarding are
 * done. Written by /challenge/[slug]/join, read by the session middleware on
 * the dashboard, which sends the user back through the join route; the join
 * route clears it on every path that ends signed in and onboarded, so it can
 * never loop.
 */
export const CHALLENGE_INTENT_COOKIE = 'lifequest-challenge-intent'

/** A week: long enough to survive a confirmation email, short enough to not surprise. */
export const CHALLENGE_INTENT_MAX_AGE = 60 * 60 * 24 * 7

/** The slug in the cookie, or null when it is missing or not a slug at all. */
export function readChallengeIntent(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase()
  return slug && isValidChallengeSlug(slug) ? slug : null
}

export function challengeJoinPath(slug: string): string {
  return `/challenge/${encodeURIComponent(slug)}/join`
}

'use client'

import { useEffect } from 'react'
import { useUserStore, type ChallengeDayCelebration } from '@/lib/stores/user-store'

const CELEBRATED_KEY = 'lifequest-celebrated-challenge-days'

/**
 * Whether this tab already celebrated the day, and remembers it if not.
 *
 * The router can replay a page's earlier server render (back and forward
 * navigation), which still carries the `completed_now` of the load that
 * completed the day. Without this, going back to the dashboard would
 * celebrate the same day again.
 */
function firstTimeInThisTab(celebration: ChallengeDayCelebration): boolean {
  const id = `${celebration.enrollmentId}:${celebration.dayNumber}`
  try {
    const seen: string[] = JSON.parse(window.sessionStorage.getItem(CELEBRATED_KEY) ?? '[]')
    if (seen.includes(id)) return false
    window.sessionStorage.setItem(CELEBRATED_KEY, JSON.stringify([...seen, id].slice(-50)))
    return true
  } catch {
    // Storage unavailable (private mode, blocked): celebrating twice is the
    // lesser failure than never celebrating.
    return true
  }
}

/**
 * Celebrates the challenge days a server page's sync just completed (built
 * with `challengeCelebrationsFrom`), e.g. a reflection day finished by a
 * journal entry and detected when the dashboard loads. Renders nothing.
 *
 * Only the first is shown: two challenges completing a day in the same load
 * is rare, and back-to-back overlays would be more noise than reward.
 */
export function ChallengeCompletionNotifier({
  celebrations,
}: {
  celebrations: ChallengeDayCelebration[]
}) {
  const notify = useUserStore((s) => s.notifyChallengeDay)
  const first = celebrations[0] ?? null
  // Keyed on the content, not the array, so an unrelated re-render with the
  // same props does not run the effect again.
  const key = first ? JSON.stringify(first) : null

  useEffect(() => {
    if (!key) return
    const celebration = JSON.parse(key) as ChallengeDayCelebration
    if (firstTimeInThisTab(celebration)) notify(celebration)
  }, [key, notify])

  return null
}

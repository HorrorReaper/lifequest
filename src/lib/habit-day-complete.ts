// When ticking off a habit completes the day, and whether that day has already
// been celebrated. The dashboard's Habits section and /habits share both, so
// finishing the day on one and toggling on the other cannot celebrate twice.

export interface HabitDayProgress {
  /** Habits done today before this check-in. */
  doneBefore: number
  /** Habits done today with this check-in applied. */
  doneAfter: number
  /** Active (not archived) habits. */
  total: number
}

/** True for the check-in that ticks off the last open habit of the day. */
export function completesHabitDay({ doneBefore, doneAfter, total }: HabitDayProgress): boolean {
  return total > 0 && doneBefore < total && doneAfter === total
}

function storageKey(userId: string, date: string) {
  return `lifequest:habit-day-complete:${userId}:${date}`
}

/**
 * Claims the day's one celebration: true the first time per user and day in
 * this tab, false after that, so unticking and reticking the last habit does
 * not replay it. When storage is unavailable it always celebrates -- a repeat
 * is a smaller loss than never celebrating at all.
 */
export function claimDayCompleteCelebration(userId: string, date: string): boolean {
  try {
    const key = storageKey(userId, date)
    if (window.sessionStorage.getItem(key)) return false
    window.sessionStorage.setItem(key, '1')
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
  return true
}

/** Gives the claim back, for a check-in that claimed it and then failed to save. */
export function releaseDayCompleteCelebration(userId: string, date: string) {
  try {
    window.sessionStorage.removeItem(storageKey(userId, date))
  } catch {
    // Nothing was stored, so there is nothing to give back.
  }
}

// The single source of truth for "which calendar day is this?".
//
// The app used to answer that question five different ways — the profile
// timezone, a hard-coded Europe/Berlin, UTC via toISOString(), the browser
// zone, and toISOString() applied to a local-midnight Date. The last one is
// not merely inconsistent but wrong: local midnight in any zone ahead of UTC
// serialises to the *previous* day, so a picked due date silently moved back
// by one. Every date key in the app should come from this module.
//
// Two distinct concepts live here and must not be confused:
//
//   - A *date key* is a `YYYY-MM-DD` string. It names a calendar day and has
//     no time or zone attached. Arithmetic on it uses day numbers, so a
//     daylight-saving transition cannot make a day 23 or 25 hours long.
//   - An *instant* is a `Date`. Turning one into a date key always requires
//     naming the zone to interpret it in — that is what `dateInTimezone` is
//     for, and it takes the timezone explicitly so no caller can silently
//     fall back to the server's zone.

const DAY_MS = 86_400_000

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * The date key of `date` as seen in `timezone`.
 *
 * `en-CA` is used because it formats as `YYYY-MM-DD`; the locale is an
 * implementation detail and never reaches the user.
 */
export function dateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** The hour (0-23) of `date` as seen in `timezone`. */
export function hourInTimezone(date: Date, timezone: string): number {
  // formatToParts with an explicit h23 cycle avoids the locale-dependent
  // "24" that some locales emit for midnight under hour12: false.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
}

/** Days since the epoch for a date key. The unit of all date-key arithmetic. */
export function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

/** Inverse of {@link dayNumber}. */
export function dateFromDayNumber(value: number): string {
  return new Date(value * DAY_MS).toISOString().slice(0, 10)
}

/** Shift a date key by whole days. Immune to daylight-saving transitions. */
export function addDays(dateKey: string, amount: number): string {
  return dateFromDayNumber(dayNumber(dateKey) + amount)
}

/** Whole days from `start` to `end`, both date keys. */
export function daysBetween(start: string, end: string): number {
  return dayNumber(end) - dayNumber(start)
}

/**
 * The date key of a `Date` read in the runtime's own zone.
 *
 * Use this only for a Date that already carries calendar fields chosen by the
 * user — a date picker's selection, for instance. To decide what "today" is
 * for a user, use {@link dateInTimezone} with their profile timezone instead.
 */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * A date key as a `Date` at local noon.
 *
 * Noon rather than midnight so that neither a positive nor a negative UTC
 * offset can push the value into an adjacent day. Returns null for anything
 * that is not a real calendar date.
 */
export function parseLocalDate(dateKey: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(dateKey)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12)

  // Rejects overflowed input such as 2026-02-30, which the Date constructor
  // would otherwise roll forward into March.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

/** Format a date key for display without letting a zone offset move the day. */
export function formatDateOnly(
  dateKey: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    ...options,
  })
}

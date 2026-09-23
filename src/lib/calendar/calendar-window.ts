import { addDays, formatDateOnly, parseLocalDate, weekStart } from '@/lib/dates'

export type CalendarViewMode = 'month' | 'week'

function daysBetween(start: string, end: string): string[] {
  const days: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day)
  return days
}

function shiftMonth(dateKey: string, offset: -1 | 1): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1 + offset, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/** Date keys stay date-only through navigation, including DST and month ends. */
export function calendarWindow(dateKey: string, view: CalendarViewMode) {
  if (!parseLocalDate(dateKey)) throw new Error('Invalid calendar date')

  if (view === 'week') {
    const start = weekStart(dateKey)
    const end = addDays(start, 6)
    return {
      start,
      end,
      days: daysBetween(start, end),
      previousDate: addDays(dateKey, -7),
      nextDate: addDays(dateKey, 7),
      title: `${formatDateOnly(start, { month: 'short', day: 'numeric' })} – ${formatDateOnly(end, { month: 'short', day: 'numeric', year: 'numeric' })}`,
    }
  }

  const monthStart = `${dateKey.slice(0, 7)}-01`
  const nextMonthStart = shiftMonth(monthStart, 1)
  const lastDay = addDays(nextMonthStart, -1)
  const start = weekStart(monthStart)
  const end = addDays(weekStart(lastDay), 6)
  return {
    start,
    end,
    days: daysBetween(start, end),
    previousDate: shiftMonth(dateKey, -1),
    nextDate: shiftMonth(dateKey, 1),
    title: formatDateOnly(monthStart, { month: 'long', year: 'numeric' }),
  }
}

export function calendarHref(basePath: string, dateKey: string, view: CalendarViewMode) {
  return `${basePath}?date=${encodeURIComponent(dateKey)}&view=${view}`
}

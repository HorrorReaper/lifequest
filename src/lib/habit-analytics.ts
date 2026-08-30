import { addDays, dateFromDayNumber, dayNumber } from '@/lib/dates'

const DAY_MS = 86_400_000

export type HabitAnalyticsPeriod = 30 | 90 | 'all'

export interface HabitAnalyticsInput {
  completionDates: string[]
  createdDate: string
  today: string
  period: HabitAnalyticsPeriod
}

export interface HabitAnalyticsDay {
  date: string
  completed: boolean
  eligible: boolean
}

export interface HabitAnalyticsWeek {
  label: string
  completed: number
  eligible: number
  rate: number
}

export interface HabitAnalyticsWeekday {
  label: string
  shortLabel: string
  completed: number
  eligible: number
  rate: number
}

export interface HabitAnalytics {
  currentStreak: number
  longestStreak: number
  completionRate: number
  totalCompletions: number
  periodCompletions: number
  eligibleDays: number
  periodStart: string
  heatmap: HabitAnalyticsDay[]
  weeklyTrend: HabitAnalyticsWeek[]
  weekdayConsistency: HabitAnalyticsWeekday[]
  recentCompletions: string[]
}

function inclusiveDayCount(start: string, end: string) {
  return Math.max(0, dayNumber(end) - dayNumber(start) + 1)
}

function laterDate(first: string, second: string) {
  return first > second ? first : second
}

function calculateLongestStreak(completionDays: number[]) {
  if (completionDays.length === 0) return 0

  let longest = 1
  let current = 1

  for (let index = 1; index < completionDays.length; index += 1) {
    if (completionDays[index] === completionDays[index - 1] + 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }

  return longest
}

function calculateCurrentStreak(
  completions: Set<string>,
  createdDate: string,
  today: string
) {
  let cursor = completions.has(today) ? today : addDays(today, -1)
  let streak = 0

  while (cursor >= createdDate && completions.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function buildHeatmap(
  completions: Set<string>,
  createdDate: string,
  today: string
): HabitAnalyticsDay[] {
  const firstDate = addDays(mondayOfWeek(today), -35)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstDate, index)

    return {
      date,
      completed: completions.has(date),
      eligible: date >= createdDate && date <= today,
    }
  })
}

function mondayOfWeek(date: string) {
  const dateNumber = dayNumber(date)
  const weekday = new Date(dateNumber * DAY_MS).getUTCDay()
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
  return dateFromDayNumber(dateNumber - daysSinceMonday)
}

function buildWeeklyTrend(
  completions: Set<string>,
  createdDate: string,
  today: string
): HabitAnalyticsWeek[] {
  const currentMonday = mondayOfWeek(today)
  const firstMonday = addDays(currentMonday, -49)

  return Array.from({ length: 8 }, (_, weekIndex) => {
    const weekStart = addDays(firstMonday, weekIndex * 7)
    let completed = 0
    let eligible = 0

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(weekStart, dayIndex)
      if (date < createdDate || date > today) continue

      eligible += 1
      if (completions.has(date)) completed += 1
    }

    return {
      label: new Date(`${weekStart}T12:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      completed,
      eligible,
      rate: eligible > 0 ? Math.round((completed / eligible) * 100) : 0,
    }
  })
}

const WEEKDAYS = [
  { day: 1, label: 'Monday', shortLabel: 'Mon' },
  { day: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { day: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { day: 4, label: 'Thursday', shortLabel: 'Thu' },
  { day: 5, label: 'Friday', shortLabel: 'Fri' },
  { day: 6, label: 'Saturday', shortLabel: 'Sat' },
  { day: 0, label: 'Sunday', shortLabel: 'Sun' },
]

function buildWeekdayConsistency(
  completions: Set<string>,
  periodStart: string,
  today: string
): HabitAnalyticsWeekday[] {
  return WEEKDAYS.map((weekday) => {
    let completed = 0
    let eligible = 0

    for (
      let cursor = periodStart;
      cursor <= today;
      cursor = addDays(cursor, 1)
    ) {
      if (new Date(dayNumber(cursor) * DAY_MS).getUTCDay() !== weekday.day) continue

      eligible += 1
      if (completions.has(cursor)) completed += 1
    }

    return {
      label: weekday.label,
      shortLabel: weekday.shortLabel,
      completed,
      eligible,
      rate: eligible > 0 ? Math.round((completed / eligible) * 100) : 0,
    }
  })
}

export function buildHabitAnalytics({
  completionDates,
  createdDate,
  today,
  period,
}: HabitAnalyticsInput): HabitAnalytics {
  const validDates = [...new Set(completionDates.map((date) => date.slice(0, 10)))]
    .filter((date) => date >= createdDate && date <= today)
    .sort()
  const completions = new Set(validDates)
  const requestedStart =
    period === 'all' ? createdDate : addDays(today, -(period - 1))
  const periodStart = laterDate(createdDate, requestedStart)
  const periodDates = validDates.filter((date) => date >= periodStart)
  const eligibleDays = inclusiveDayCount(periodStart, today)

  return {
    currentStreak: calculateCurrentStreak(completions, createdDate, today),
    longestStreak: calculateLongestStreak(validDates.map(dayNumber)),
    completionRate:
      eligibleDays > 0 ? Math.round((periodDates.length / eligibleDays) * 100) : 0,
    totalCompletions: validDates.length,
    periodCompletions: periodDates.length,
    eligibleDays,
    periodStart,
    heatmap: buildHeatmap(completions, createdDate, today),
    weeklyTrend: buildWeeklyTrend(completions, createdDate, today),
    weekdayConsistency: buildWeekdayConsistency(completions, periodStart, today),
    recentCompletions: validDates.slice().reverse().slice(0, 8),
  }
}

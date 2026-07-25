'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  CheckCheck,
  CircleGauge,
  Flame,
  Settings2,
  Trophy,
} from 'lucide-react'
import {
  buildHabitAnalytics,
  type HabitAnalyticsPeriod,
} from '@/lib/habit-analytics'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface HabitAnalyticsViewProps {
  habit: {
    id: string
    name: string
    emoji: string
    isArchived: boolean
    createdDate: string
  }
  completionDates: string[]
  today: string
}

const PERIODS: Array<{ value: HabitAnalyticsPeriod; label: string }> = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 'all', label: 'All time' },
]

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    ...options,
  })
}

function periodDescription(period: HabitAnalyticsPeriod) {
  if (period === 'all') return 'Since this habit was created'
  return `Across the last ${period} days`
}

export function HabitAnalyticsView({
  habit,
  completionDates,
  today,
}: HabitAnalyticsViewProps) {
  const [period, setPeriod] = useState<HabitAnalyticsPeriod>(30)
  const analytics = buildHabitAnalytics({
    completionDates,
    createdDate: habit.createdDate,
    today,
    period,
  })
  const hasHistory = analytics.totalCompletions > 0

  return (
    <main className="min-h-svh bg-background px-4 pb-24 pt-4 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="space-y-4">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/habits">
              <ArrowLeft className="size-3.5" />
              Habits
            </Link>
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-3xl">
                {habit.emoji}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                    {habit.name}
                  </h1>
                  {habit.isArchived && (
                    <span className="rounded-full bg-muted px-2 py-1 text-[0.65rem] font-medium text-muted-foreground">
                      Archived
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tracking since{' '}
                  {formatDate(habit.createdDate, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/habits">
                <Settings2 className="size-3.5" />
                <span className="hidden sm:inline">Manage</span>
              </Link>
            </Button>
          </div>
        </header>

        <div
          className="grid grid-cols-3 rounded-2xl border bg-card p-1"
          aria-label="Analytics period"
        >
          {PERIODS.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={cn(
                'min-h-11 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                period === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <section className="grid grid-cols-2 gap-3" aria-label="Habit summary">
          <MetricCard
            icon={Flame}
            label="Current streak"
            value={`${analytics.currentStreak}`}
            suffix={analytics.currentStreak === 1 ? 'day' : 'days'}
            accent="text-orange-600 dark:text-orange-400"
          />
          <MetricCard
            icon={CircleGauge}
            label="Completion rate"
            value={`${analytics.completionRate}%`}
            suffix={`${analytics.periodCompletions}/${analytics.eligibleDays} days`}
            accent="text-primary"
          />
          <MetricCard
            icon={Trophy}
            label="Longest streak"
            value={`${analytics.longestStreak}`}
            suffix={analytics.longestStreak === 1 ? 'day' : 'days'}
            accent="text-amber-600 dark:text-amber-400"
          />
          <MetricCard
            icon={CheckCheck}
            label="Total completed"
            value={`${analytics.totalCompletions}`}
            suffix="check-ins"
            accent="text-emerald-600 dark:text-emerald-400"
          />
        </section>

        {!hasHistory && (
          <div className="rounded-2xl border border-dashed bg-card/60 p-5 text-center">
            <CalendarDays className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No completions recorded yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              Complete this habit from the Habits page to start building your pattern.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/habits">Go to today&apos;s habits</Link>
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>Last six weeks</span>
              <span className="text-xs font-normal text-muted-foreground">
                {analytics.heatmap.filter((day) => day.completed).length} completed
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_LABELS.map((label, index) => (
                <span
                  key={`${label}-${index}`}
                  className="pb-1 text-center text-[0.65rem] font-medium text-muted-foreground"
                >
                  {label}
                </span>
              ))}
              {analytics.heatmap.map((day) => (
                <span
                  key={day.date}
                  title={`${formatDate(day.date, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}: ${
                    day.completed
                      ? 'Completed'
                      : day.eligible
                        ? 'Not completed'
                        : 'Not active'
                  }`}
                  className={cn(
                    'aspect-square rounded-md border transition-colors',
                    day.completed
                      ? 'border-primary/30 bg-primary'
                      : day.eligible
                        ? 'border-border/50 bg-muted'
                        : 'border-transparent bg-muted/25'
                  )}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {formatDate(analytics.heatmap[0].date, {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                to{' '}
                {formatDate(today, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-muted" />
                  Open
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-primary" />
                  Done
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span>Weekly consistency</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Completion rate across the last eight weeks
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[30rem] grid-cols-8 gap-2">
                {analytics.weeklyTrend.map((week) => (
                  <div key={week.label} className="space-y-2 text-center">
                    <div className="flex h-28 items-end overflow-hidden rounded-lg bg-muted/55 p-1">
                      <div
                        className="w-full rounded-md bg-primary transition-[height] duration-300"
                        style={{ height: `${Math.max(week.rate, week.completed > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold tabular-nums">{week.rate}%</p>
                      <p className="text-[0.65rem] text-muted-foreground">{week.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>
                <span>Day-of-week pattern</span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {periodDescription(period)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.weekdayConsistency.map((weekday) => (
                <div
                  key={weekday.label}
                  className="grid grid-cols-[2.5rem_1fr_2.75rem] items-center gap-3"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {weekday.shortLabel}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${weekday.rate}%` }}
                    />
                  </div>
                  <span className="text-right text-xs font-semibold tabular-nums">
                    {weekday.rate}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent completions</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.recentCompletions.length === 0 ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  Your completed dates will appear here.
                </p>
              ) : (
                <ol className="space-y-2">
                  {analytics.recentCompletions.map((date) => (
                    <li
                      key={date}
                      className="flex items-center justify-between gap-3 rounded-xl bg-muted/45 px-3 py-2"
                    >
                      <span className="text-sm">
                        {formatDate(date, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <CheckCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: typeof Flame
  label: string
  value: string
  suffix: string
  accent: string
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className={cn('size-4', accent)} />
          {label}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {value}
          </span>
          <span className="text-xs text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  )
}

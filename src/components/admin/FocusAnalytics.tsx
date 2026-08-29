'use client'

import { Clock3, Sparkles, Target, Timer } from 'lucide-react'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import { summarizeFocusDay } from '@/lib/focus-session'

export interface FocusAnalyticsProps {
  sessions: FocusSessionRow[]
  /** Titles for the tasks sessions point at; sessions outlive their tasks. */
  taskTitles: Map<string, string>
}

function taskLabel(taskId: string | null, taskTitles: Map<string, string>) {
  if (taskId === null) return 'Open focus'
  // A session can outlive the task it was started for, and a blank row would
  // read as a bug rather than as history.
  return taskTitles.get(taskId) ?? 'Deleted task'
}

export function FocusAnalytics({ sessions, taskTitles }: FocusAnalyticsProps) {
  const summary = summarizeFocusDay(sessions)

  if (sessions.length === 0) {
    return (
      <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
        <h2 className="font-semibold">Focus today</h2>
        <p className="mt-4 rounded-2xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
          No focus sessions yet today. Start one to see where the time goes.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold">Focus today</h2>
        <span data-testid="focus-counts" className="text-xs text-muted-foreground">
          {summary.completedCount} completed
          {summary.cancelledCount > 0 && ` · ${summary.cancelledCount} cancelled`}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          testId="focused-minutes"
          icon={Clock3}
          value={`${summary.focusedMinutes}`}
          unit="min"
          label="Focused"
        />
        <Metric
          testId="focus-xp"
          icon={Sparkles}
          value={`${summary.xpEarned}`}
          unit="XP"
          label="Earned"
        />
        <Metric
          testId="focus-adherence"
          icon={Target}
          value={`${Math.round(summary.adherence * 100)}%`}
          label={`of ${summary.plannedMinutes} min planned`}
        />
        <Metric
          testId="focus-longest"
          icon={Timer}
          value={`${summary.longestMinutes}`}
          unit="min"
          label={`longest · ${summary.averageMinutes} avg`}
        />
      </div>

      {summary.byTask.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Where the time went</h3>
          {summary.byTask.map((entry) => (
            <div
              key={entry.taskId ?? 'open'}
              data-testid="focus-task-row"
              className="flex items-center gap-3 rounded-xl bg-muted/45 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {taskLabel(entry.taskId, taskTitles)}
              </span>
              <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-background">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{
                    width: `${summary.focusedMinutes ? (entry.minutes / summary.focusedMinutes) * 100 : 0}%`,
                  }}
                />
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">{entry.minutes} min</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({
  testId,
  icon: Icon,
  value,
  unit,
  label,
}: {
  testId: string
  icon: typeof Clock3
  value: string
  unit?: string
  label: string
}) {
  return (
    <div data-testid={testId} className="rounded-2xl bg-muted/45 p-4">
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

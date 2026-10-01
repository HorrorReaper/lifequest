import Link from 'next/link'
import { CalendarClock, ChevronLeft, ChevronRight, Check, Clock3, ListTodo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateOnly } from '@/lib/dates'
import { calendarHref, calendarWindow, type CalendarViewMode } from '@/lib/calendar/calendar-window'
import type { CalendarPlan, CalendarTask } from '@/lib/calendar/calendar-data'
import { cn } from '@/lib/utils'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const blockColors: Record<string, string> = {
  deep_work: 'border-l-purple-500 bg-purple-500/10',
  meeting: 'border-l-blue-500 bg-blue-500/10',
  break: 'border-l-amber-500 bg-amber-500/10',
  personal: 'border-l-emerald-500 bg-emerald-500/10',
  exercise: 'border-l-rose-500 bg-rose-500/10',
  other: 'border-l-muted-foreground bg-muted/50',
}

interface CalendarOverviewProps {
  basePath: string
  plannerPath: string
  tasksPath: string
  date: string
  today: string
  view: CalendarViewMode
  plans: CalendarPlan[]
  tasks: CalendarTask[]
}

export function CalendarOverview({ basePath, plannerPath, tasksPath, date, today, view, plans, tasks }: CalendarOverviewProps) {
  const window = calendarWindow(date, view)
  const planByDate = new Map(plans.map((plan) => [plan.plan_date, plan]))
  const tasksByDate = new Map<string, CalendarTask[]>()
  for (const task of tasks) tasksByDate.set(task.due_date, [...(tasksByDate.get(task.due_date) ?? []), task])
  const selectedBlocks = [...(planByDate.get(date)?.blocks ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const selectedTasks = tasksByDate.get(date) ?? []
  const monthKey = date.slice(0, 7)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Your work at a glance</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Planned time and task deadlines from your existing LifeQuest data.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link href={calendarHref(basePath, today, view)}>Today</Link></Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 rounded-3xl border bg-card p-3 sm:p-5">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-xl font-semibold" aria-live="polite">{window.title}</h2>
            <div className="flex gap-1 rounded-xl bg-muted p-1" aria-label="Calendar view">
              {(['month', 'week'] as const).map((mode) => <Link key={mode} href={calendarHref(basePath, date, mode)} aria-current={view === mode ? 'page' : undefined} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium capitalize', view === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{mode}</Link>)}
            </div>
            <Link href={calendarHref(basePath, window.previousDate, view)} aria-label={`Previous ${view}`} className="grid size-9 place-items-center rounded-lg border hover:bg-muted"><ChevronLeft className="size-4" /></Link>
            <Link href={calendarHref(basePath, window.nextDate, view)} aria-label={`Next ${view}`} className="grid size-9 place-items-center rounded-lg border hover:bg-muted"><ChevronRight className="size-4" /></Link>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2" aria-label={`${view} calendar`}>
            {weekdays.map((day) => <span key={day} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</span>)}
            {window.days.map((day) => {
              const blocks = planByDate.get(day)?.blocks ?? []
              const due = tasksByDate.get(day) ?? []
              const selected = day === date
              const outside = view === 'month' && day.slice(0, 7) !== monthKey
              return <Link key={day} href={calendarHref(basePath, day, view)} prefetch={false}
                aria-label={`${formatDateOnly(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${blocks.length} plan blocks, ${due.length} tasks due`}
                aria-current={selected ? 'date' : undefined}
                className={cn('min-h-24 rounded-xl border p-1.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-28 sm:p-2.5', selected && 'border-primary bg-primary/5 ring-1 ring-primary/30', outside && 'opacity-45')}>
                <span className={cn('grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums', day === today && 'bg-primary text-primary-foreground')}>{Number(day.slice(-2))}</span>
                <div className="mt-1 space-y-1">
                  {blocks.slice(0, 2).map((block) => <p key={block.id} className={cn('hidden truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] sm:block', blockColors[block.category] ?? blockColors.other)}>{block.start_time} {block.title}</p>)}
                  {blocks.length > 0 && <p className="text-[10px] text-muted-foreground sm:hidden">{blocks.length} planned</p>}
                  {blocks.length > 2 && <p className="hidden text-[10px] text-muted-foreground sm:block">+{blocks.length - 2} more</p>}
                  {due.length > 0 && <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><ListTodo className="size-3" />{due.length} due</p>}
                </div>
              </Link>
            })}
          </div>
        </div>

        <aside className="min-w-0 space-y-4 rounded-3xl border bg-card p-5" aria-labelledby="selected-day-title">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected day</p>
              <h2 id="selected-day-title" className="mt-1 text-xl font-semibold">{formatDateOnly(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
            </div>
            {date === today && <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Today</span>}
          </div>

          <section aria-labelledby="calendar-plan-title" className="space-y-2">
            <h3 id="calendar-plan-title" className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4 text-primary" /> Planned time</h3>
            {selectedBlocks.length === 0 && <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">No plan blocks for this day.</p>}
            {selectedBlocks.map((block) => <div key={block.id} className={cn('rounded-xl border-l-4 p-3', blockColors[block.category] ?? blockColors.other)}>
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><Clock3 className="size-3" />{block.start_time}–{block.end_time}</p>
              <p className="mt-1 text-sm font-medium">{block.title}</p>
            </div>)}
            {date === today && <Button asChild size="sm" variant="outline" className="w-full"><Link href={selectedBlocks.length ? `${plannerPath}?step=timeline` : plannerPath}>{selectedBlocks.length ? 'Edit today’s plan' : 'Plan today'}</Link></Button>}
          </section>

          <section aria-labelledby="calendar-tasks-title" className="space-y-2 border-t pt-4">
            <h3 id="calendar-tasks-title" className="flex items-center gap-2 text-sm font-semibold"><ListTodo className="size-4 text-primary" /> Tasks due</h3>
            {selectedTasks.length === 0 && <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">No task deadlines for this day.</p>}
            {selectedTasks.map((task) => <div key={task.id} className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-sm">
              {task.is_completed ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <span className={cn('mt-1 size-3 shrink-0 rounded-full border-2', date < today ? 'border-destructive' : 'border-primary')} />}
              <span className={cn('min-w-0 break-words', task.is_completed && 'text-muted-foreground line-through')}>{task.title}</span>
            </div>)}
            <Link href={tasksPath} className="inline-flex text-sm font-medium text-primary hover:underline">Manage tasks →</Link>
          </section>
          <div className="border-t pt-4 text-xs text-muted-foreground">Dates reflect your profile timezone. Planning changes appear here after the page refreshes.</div>
        </aside>
      </div>
    </div>
  )
}

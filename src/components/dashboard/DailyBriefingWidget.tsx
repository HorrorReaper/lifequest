'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, Circle, Flame, ListTodo, Minus, Plus, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { upsertDayPlan } from '@/lib/day-plans'
import type { DayPlanBlock } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { TaskList } from '@/components/tasks/TaskList'
import { HabitDashboardWidget } from '@/components/dashboard/HabitDashboardWidget'

interface BriefingHabit {
  id: string
  name: string
  emoji: string
  completed: boolean
}

interface BriefingTask {
  id: string
  title: string
  dueDate: string | null
  priority: 'low' | 'medium' | 'high'
  isOverdue: boolean
}

interface BriefingJournal {
  id: string
  name: string
  icon: string
  completedToday: boolean
}

interface BriefingPlanBlock {
  id: string
  startTime: string
  endTime: string
  title: string
  category: string
  isCurrent: boolean
  isPast: boolean
}

interface DailyBriefingWidgetProps {
  userId: string
  todayDate: string
  todayLabel: string
  habits: BriefingHabit[]
  tasks: BriefingTask[]
  journals: BriefingJournal[]
  planBlocks: BriefingPlanBlock[]
  completedJournalCount: number
  initialOpenPanel?: 'plan' | 'task' | 'habit' | null
}

const priorityStyles = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-blue-600 dark:text-blue-400',
}

const categoryLabels: Record<DayPlanBlock['category'], string> = {
  deep_work: 'Deep Work',
  meeting: 'Meeting',
  break: 'Break',
  personal: 'Personal',
  exercise: 'Exercise',
  other: 'Other',
}

export function DailyBriefingWidget({
  userId,
  todayDate,
  todayLabel,
  habits,
  tasks,
  journals,
  planBlocks,
  completedJournalCount,
  initialOpenPanel = null,
}: DailyBriefingWidgetProps) {
  const supabase = createClient()
  const router = useRouter()
  const [blocks, setBlocks] = useState(planBlocks)
  const [showAddPlan, setShowAddPlan] = useState(initialOpenPanel === 'plan')
  const [planTitle, setPlanTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [category, setCategory] = useState<DayPlanBlock['category']>('deep_work')
  const [savingPlan, setSavingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [activeManagePanel, setActiveManagePanel] = useState<'task' | 'habit' | null>(
    initialOpenPanel === 'task' || initialOpenPanel === 'habit' ? initialOpenPanel : null
  )

  const completedHabits = habits.filter((habit) => habit.completed).length
  const openTasks = tasks.length
  const activePlanBlocks = blocks.filter((block) => !block.isPast).length
  const totalItems = habits.length + openTasks + activePlanBlocks + Math.max(journals.length > 0 ? 1 : 0, 0)
  const doneItems = completedHabits + completedJournalCount + blocks.filter((block) => block.isPast).length
  const allClear = totalItems > 0 && doneItems >= totalItems
  const canSavePlan = planTitle.trim().length > 0 && startTime < endTime
  const currentBlock = blocks.find((block) => block.isCurrent)
  const nextPlanBlock = currentBlock ?? blocks.find((block) => !block.isPast) ?? null
  const nextHabit = habits.find((habit) => !habit.completed) ?? null
  const nextJournal = journals.find((journal) => !journal.completedToday) ?? journals[0] ?? null
  const topTask = [...tasks].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    const priorityRank = { high: 0, medium: 1, low: 2 }
    return priorityRank[a.priority] - priorityRank[b.priority]
  })[0] ?? null
  const habitPct = habits.length > 0 ? Math.round((completedHabits / habits.length) * 100) : 0
  const focusCopy = allClear
    ? 'Everything important is handled. Keep the day light or add a deliberate next block.'
    : completedJournalCount === 0
      ? 'Start with a quick journal entry, then move into the next concrete action.'
      : 'Journal is done. Keep momentum with the next plan block, task, or habit.'

  function toPersistedBlock(block: BriefingPlanBlock): DayPlanBlock {
    return {
      id: block.id,
      start_time: block.startTime,
      end_time: block.endTime,
      title: block.title,
      category: block.category as DayPlanBlock['category'],
    }
  }

  async function handleAddPlanBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSavePlan) return

    setSavingPlan(true)
    setPlanError(null)

    const nextBlock: BriefingPlanBlock = {
      id: crypto.randomUUID(),
      startTime,
      endTime,
      title: planTitle.trim(),
      category,
      isCurrent: false,
      isPast: false,
    }
    const nextBlocks = [...blocks, nextBlock].sort((a, b) => a.startTime.localeCompare(b.startTime))

    try {
      await upsertDayPlan(supabase, userId, {
        plan_date: todayDate,
        blocks: nextBlocks.map(toPersistedBlock),
      })
      setBlocks(nextBlocks)
      setPlanTitle('')
      setStartTime(endTime)
      const [endHour] = endTime.split(':').map(Number)
      setEndTime(`${String(Math.min(endHour + 1, 23)).padStart(2, '0')}:00`)
      setShowAddPlan(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to save daily plan:', error)
      setPlanError('Could not save this plan block. Please try again.')
    } finally {
      setSavingPlan(false)
    }
  }

  function toggleManagePanel(panel: 'task' | 'habit') {
    setActiveManagePanel((current) => (current === panel ? null : panel))
  }

  return (
    <Card className="overflow-hidden border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-start gap-3 text-lg">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            Today Focus
            <span className="block text-xs font-normal text-muted-foreground">
              {todayLabel}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border bg-background/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Next best move
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {focusCopy}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {completedJournalCount === 0 && nextJournal ? (
              <Button asChild size="lg" className="h-10 flex-1">
                <Link href={`/journal/new/${nextJournal.id}`}>
                  <span className="mr-1.5">{nextJournal.icon}</span>
                  Start {nextJournal.name}
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" variant="secondary" className="h-10 flex-1">
                <Link href="/journal">
                  <BookOpen className="mr-1.5 size-4" />
                  Add Reflection
                </Link>
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => setShowAddPlan((open) => !open)}
              className="h-10 flex-1"
            >
              {showAddPlan ? (
                <Minus className="mr-1.5 size-4" />
              ) : (
                <Plus className="mr-1.5 size-4" />
              )}
              {showAddPlan ? 'Close Plan' : 'Add Plan Block'}
            </Button>
          </div>
        </div>

        {showAddPlan && (
          <form onSubmit={handleAddPlanBlock} className="space-y-2 rounded-lg border bg-background/80 p-3">
            <Input
              placeholder="What will you do?"
              value={planTitle}
              onChange={(event) => setPlanTitle(event.target.value)}
              disabled={savingPlan}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                disabled={savingPlan}
                aria-label="Start time"
              />
              <Input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                disabled={savingPlan}
                aria-label="End time"
              />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as DayPlanBlock['category'])}
                disabled={savingPlan}
                className="col-span-2 flex h-8 rounded-lg border border-input bg-background px-2 text-xs sm:col-span-1"
                aria-label="Plan category"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                size="sm"
                disabled={savingPlan || !canSavePlan}
                className="col-span-2 h-8 sm:col-span-1"
              >
                {savingPlan ? 'Saving...' : 'Save'}
              </Button>
            </div>
            {startTime >= endTime && (
              <p className="text-xs text-destructive">End time must be after start time.</p>
            )}
            {planError && <p className="text-xs text-destructive">{planError}</p>}
          </form>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-lg border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-purple-500" />
                <h3 className="text-sm font-semibold">Now / Next</h3>
              </div>
              {nextPlanBlock?.isCurrent && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  Now
                </span>
              )}
            </div>

            {nextPlanBlock ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{nextPlanBlock.title}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {nextPlanBlock.startTime}-{nextPlanBlock.endTime} · {nextPlanBlock.category.replace('_', ' ')}
                </p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No plan block yet. Add one to give the day a clear shape.
              </p>
            )}
          </section>

          <button
            type="button"
            onClick={() => toggleManagePanel('task')}
            className={cn(
              'rounded-lg border bg-background/70 p-3 text-left transition-colors hover:border-primary/40 hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              activeManagePanel === 'task' && 'border-primary/40 bg-background'
            )}
            aria-expanded={activeManagePanel === 'task'}
            aria-controls="dashboard-task-manager"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListTodo className="size-4 text-blue-500" />
                <h3 className="text-sm font-semibold">Top Task</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {openTasks > 0 ? `${openTasks} open` : 'Clear'}
              </span>
            </div>

            {topTask ? (
              <div className="space-y-1">
                <p className="truncate text-sm font-medium">{topTask.title}</p>
                <p
                  className={cn(
                    'text-xs font-medium capitalize',
                    topTask.isOverdue ? 'text-red-600 dark:text-red-400' : priorityStyles[topTask.priority]
                  )}
                >
                  {topTask.isOverdue ? 'Overdue' : `${topTask.priority} priority`}
                </p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No due or overdue tasks. Keep the day clean.
              </p>
            )}
            <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Click to manage tasks
            </p>
          </button>

          <button
            type="button"
            onClick={() => toggleManagePanel('habit')}
            className={cn(
              'rounded-lg border bg-background/70 p-3 text-left transition-colors hover:border-primary/40 hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              activeManagePanel === 'habit' && 'border-primary/40 bg-background'
            )}
            aria-expanded={activeManagePanel === 'habit'}
            aria-controls="dashboard-habit-manager"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-orange-500" />
                <h3 className="text-sm font-semibold">Habit Chain</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {habits.length > 0 ? `${completedHabits}/${habits.length}` : 'None'}
              </span>
            </div>

            {habits.length > 0 ? (
              <div className="space-y-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${habitPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {nextHabit ? (
                    <>
                      Next: <span className="text-foreground">{nextHabit.emoji} {nextHabit.name}</span>
                    </>
                  ) : (
                    'All habits checked for today.'
                  )}
                </p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Add habits to make your daily chain visible here.
              </p>
            )}
            <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Click to manage habits
            </p>
          </button>

          <section className="rounded-lg border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Journal</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {completedJournalCount > 0 ? `${completedJournalCount} done` : 'Not started'}
              </span>
            </div>

            {completedJournalCount > 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Reflection logged. Add another if something important comes up.
              </p>
            ) : journals.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {journals.slice(0, 2).map((journal) => (
                  <Button key={journal.id} asChild variant="outline" size="sm" className="h-8">
                    <Link href={`/journal/new/${journal.id}`}>
                      <span className="mr-1.5">{journal.icon}</span>
                      {journal.name}
                    </Link>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                No active journal templates found.
              </p>
            )}
          </section>

          {activePlanBlocks > 1 && (
            <section className="rounded-lg border bg-background/70 p-3 sm:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-purple-500" />
                  <h3 className="text-sm font-semibold">Upcoming Plan</h3>
                </div>
                <span className="text-xs text-muted-foreground">{activePlanBlocks} left</span>
              </div>
              <ul className="space-y-1.5">
                {blocks.filter((block) => !block.isPast).slice(0, 3).map((block) => (
                  <li key={block.id} className="flex items-center gap-2 text-xs">
                    {block.isCurrent ? (
                      <CheckCircle2 className="size-3.5 text-primary" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="w-24 shrink-0 font-mono text-muted-foreground">
                      {block.startTime}-{block.endTime}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{block.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {activeManagePanel === 'task' && (
          <div id="dashboard-task-manager" className="rounded-2xl border bg-background/80 p-2">
            <TaskList
              key={`focus-tasks-${initialOpenPanel === 'task' ? 'open' : 'closed'}`}
              userId={userId}
              compact
              limit={8}
              onlyOpen
              initiallyOpen={initialOpenPanel === 'task'}
            />
          </div>
        )}

        {activeManagePanel === 'habit' && (
          <div id="dashboard-habit-manager" className="rounded-2xl border bg-background/80 p-2">
            <HabitDashboardWidget
              key={`focus-habits-${initialOpenPanel === 'habit' ? 'open' : 'closed'}`}
              userId={userId}
              initiallyOpen={initialOpenPanel === 'habit'}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

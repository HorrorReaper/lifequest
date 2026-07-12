'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, Circle, Flame, Focus, ListTodo, Minus, Plus, Sparkles, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { upsertDayPlan } from '@/lib/day-plans'
import type { DayPlanBlock, Goal } from '@/lib/types'
import type { Database } from '@/lib/supabase/database.types'
import { supabaseInsert, supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { toggleTask } from '@/lib/tasks'
import { useUserStore } from '@/lib/stores/user-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { TaskList } from '@/components/tasks/TaskList'
import { HabitDashboardWidget } from '@/components/dashboard/HabitDashboardWidget'
import { GoalsDashboardWidget } from '@/components/dashboard/GoalsDashboardWidget'
import { RoutinesManager } from '@/components/settings/RoutinesManager'

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
  goals: Goal[]
  completedJournalCount: number
  initialOpenPanel?: 'plan' | 'task' | 'habit' | 'goal' | 'routine' | null
}

type FocusSheetTab = 'today' | 'tasks' | 'habits' | 'routines' | 'plan' | 'goals'

const focusSheetTabs: { value: FocusSheetTab; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'habits', label: 'Habits' },
  { value: 'routines', label: 'Routines' },
  { value: 'plan', label: 'Plan' },
  { value: 'goals', label: 'Goals' },
]

interface HabitLogUpsertClient {
  from(table: 'habit_logs'): {
    upsert(
      value: {
        user_id: string
        habit_id: string
        log_date: string
        completed: boolean
        entry_id: string | null
      },
      options: { onConflict: string }
    ): PromiseLike<{ error: unknown }>
  }
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
  goals,
  completedJournalCount,
  initialOpenPanel = null,
}: DailyBriefingWidgetProps) {
  const supabase = createClient()
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)
  const [blocks, setBlocks] = useState(planBlocks)
  const [localHabits, setLocalHabits] = useState(habits)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [showAddPlan, setShowAddPlan] = useState(initialOpenPanel === 'plan')
  const [planTitle, setPlanTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [category, setCategory] = useState<DayPlanBlock['category']>('deep_work')
  const [savingPlan, setSavingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(initialOpenPanel !== null)
  const [sheetTab, setSheetTab] = useState<FocusSheetTab>(
    initialOpenPanel === 'task'
      ? 'tasks'
      : initialOpenPanel === 'habit'
        ? 'habits'
        : initialOpenPanel === 'routine'
          ? 'routines'
        : initialOpenPanel === 'plan'
          ? 'plan'
          : initialOpenPanel === 'goal'
            ? 'goals'
          : 'today'
  )
  const [quickActionId, setQuickActionId] = useState<string | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)

  useEffect(() => {
    setLocalHabits(habits)
  }, [habits])

  useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const completedHabits = localHabits.filter((habit) => habit.completed).length
  const openTasks = localTasks.length
  const activePlanBlocks = blocks.filter((block) => !block.isPast).length
  const totalItems = localHabits.length + openTasks + activePlanBlocks + Math.max(journals.length > 0 ? 1 : 0, 0)
  const doneItems = completedHabits + completedJournalCount + blocks.filter((block) => block.isPast).length
  const allClear = totalItems > 0 && doneItems >= totalItems
  const canSavePlan = planTitle.trim().length > 0 && startTime < endTime
  const currentBlock = blocks.find((block) => block.isCurrent)
  const nextPlanBlock = currentBlock ?? blocks.find((block) => !block.isPast) ?? null
  const nextHabit = localHabits.find((habit) => !habit.completed) ?? null
  const nextJournal = journals.find((journal) => !journal.completedToday) ?? journals[0] ?? null
  const topTask = [...localTasks].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
    const priorityRank = { high: 0, medium: 1, low: 2 }
    return priorityRank[a.priority] - priorityRank[b.priority]
  })[0] ?? null
  const habitPct = localHabits.length > 0 ? Math.round((completedHabits / localHabits.length) * 100) : 0
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

  function openSheet(tab: FocusSheetTab = 'today') {
    setSheetTab(tab)
    setSheetOpen(true)
  }

  async function handleQuickCompleteTask() {
    if (!topTask || quickActionId) return

    setQuickActionId(`task:${topTask.id}`)
    setQuickError(null)
    setLocalTasks((current) => current.filter((task) => task.id !== topTask.id))

    try {
      await toggleTask(supabase, topTask.id, true)

      const award = 5
      const { data: profileData } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', userId)
        .single()
      const profile = profileData as Pick<Database['public']['Tables']['profiles']['Row'], 'total_xp'> | null

      await supabaseInsert(supabase, 'xp_events', {
        user_id: userId,
        source_type: 'task',
        source_id: topTask.id,
        xp_amount: award,
        description: `Completed task: ${topTask.title}`,
      })

      if (profile) {
        await supabaseUpdateWhere(
          supabase,
          'profiles',
          { total_xp: profile.total_xp + award, updated_at: new Date().toISOString() },
          'id',
          userId
        )
        addXp(award, profile.total_xp)
      }

      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (error) {
      console.error('Failed to complete task from Today Focus:', error)
      setLocalTasks(tasks)
      setQuickError('Could not complete that task. Open the manager and try again.')
    } finally {
      setQuickActionId(null)
    }
  }

  async function handleQuickCheckHabit() {
    if (!nextHabit || quickActionId) return

    setQuickActionId(`habit:${nextHabit.id}`)
    setQuickError(null)
    setLocalHabits((current) =>
      current.map((habit) =>
        habit.id === nextHabit.id ? { ...habit, completed: true } : habit
      )
    )

    try {
      const { error } = await (supabase as unknown as HabitLogUpsertClient)
        .from('habit_logs')
        .upsert(
          {
            user_id: userId,
            habit_id: nextHabit.id,
            log_date: todayDate,
            completed: true,
            entry_id: null,
          },
          { onConflict: 'user_id,habit_id,log_date' }
        )

      if (error) throw error

      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (error) {
      console.error('Failed to check habit from Today Focus:', error)
      setLocalHabits(habits)
      setQuickError('Could not check that habit. Open the manager and try again.')
    } finally {
      setQuickActionId(null)
    }
  }

  return (
    <>
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
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            {completedJournalCount === 0 && nextJournal ? (
              <Button asChild size="lg" className="h-auto min-h-14 flex-1 rounded-xl px-4 py-3.5 text-[0.95rem] sm:min-h-12 sm:py-2.5">
                <Link href={`/journal/new/${nextJournal.id}`}>
                  <span className="mr-1.5 text-base">{nextJournal.icon}</span>
                  Start {nextJournal.name}
                  <ArrowRight className="ml-1.5 size-5" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" variant="secondary" className="h-auto min-h-14 flex-1 rounded-xl px-4 py-3.5 text-[0.95rem] sm:min-h-12 sm:py-2.5">
                <Link href="/journal">
                  <BookOpen className="mr-1.5 size-5" />
                  Add Reflection
                </Link>
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                setShowAddPlan(true)
                openSheet('plan')
              }}
              className="h-auto min-h-14 flex-1 rounded-xl px-4 py-3.5 text-[0.95rem] sm:min-h-12 sm:py-2.5"
            >
              <CalendarClock className="mr-1.5 size-5" />
              Plan Today
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => openSheet('today')}
              className="h-auto min-h-14 flex-1 rounded-xl px-4 py-3.5 text-[0.95rem] sm:min-h-12 sm:py-2.5"
            >
              <Focus className="mr-1.5 size-5" />
              Manage Today
            </Button>
          </div>
          {quickError && <p className="mt-3 text-xs text-destructive">{quickError}</p>}
        </div>

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

          <section className="rounded-lg border bg-background/70 p-3">
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
            <div className="mt-3 flex gap-2">
              {topTask && (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 flex-1 sm:h-8"
                  onClick={handleQuickCompleteTask}
                  disabled={quickActionId === `task:${topTask.id}`}
                >
                  <Check className="mr-1.5 size-3.5" />
                  {quickActionId === `task:${topTask.id}` ? 'Completing...' : 'Complete'}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 flex-1 sm:h-8"
                onClick={() => openSheet('tasks')}
              >
                Manage
              </Button>
            </div>
          </section>

          <section className="rounded-lg border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-orange-500" />
                <h3 className="text-sm font-semibold">Habit Chain</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {localHabits.length > 0 ? `${completedHabits}/${localHabits.length}` : 'None'}
              </span>
            </div>

            {localHabits.length > 0 ? (
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
            <div className="mt-3 flex gap-2">
              {nextHabit && (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 flex-1 sm:h-8"
                  onClick={handleQuickCheckHabit}
                  disabled={quickActionId === `habit:${nextHabit.id}`}
                >
                  <Check className="mr-1.5 size-3.5" />
                  {quickActionId === `habit:${nextHabit.id}` ? 'Checking...' : 'Check'}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 flex-1 sm:h-8"
                onClick={() => openSheet('habits')}
              >
                Manage
              </Button>
            </div>
          </section>

          <section
            role="link"
            tabIndex={0}
            aria-label="Open journal"
            onClick={() => router.push('/journal')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                router.push('/journal')
              }
            }}
            className="cursor-pointer rounded-lg border bg-background/70 p-3 transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
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
                  <Button key={journal.id} asChild variant="outline" size="sm" className="h-10 sm:h-8">
                    <Link href={`/journal/new/${journal.id}`} onClick={(event) => event.stopPropagation()}>
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

      </CardContent>
    </Card>
    <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
      <DialogContent className="bottom-0 top-auto max-h-[92svh] max-w-none translate-y-0 gap-0 overflow-hidden rounded-b-none rounded-t-3xl p-0 sm:bottom-auto sm:top-1/2 sm:max-h-[88svh] sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="text-xl">Today Focus</DialogTitle>
          <DialogDescription>
            Manage the next useful action without leaving the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4 pb-[calc(1rem+var(--safe-area-bottom))] sm:pb-4">
          <div
            role="tablist"
            aria-label="Today Focus sections"
            className="grid grid-cols-3 gap-1 rounded-2xl border bg-muted/35 p-1 sm:grid-cols-6"
          >
            {focusSheetTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={sheetTab === tab.value}
                onClick={() => setSheetTab(tab.value)}
                className={cn(
                  'h-11 rounded-xl px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-9',
                  sheetTab === tab.value && 'bg-background text-foreground shadow-sm'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {sheetTab === 'today' && (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Focus now
              </p>
              <div className="mt-3 space-y-2">
                {topTask ? (
                  <div className="flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center">
                    <ListTodo className="size-4 shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{topTask.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {topTask.isOverdue ? 'Overdue task' : `${topTask.priority} priority task`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={handleQuickCompleteTask}
                      disabled={quickActionId === `task:${topTask.id}`}
                    >
                      Complete
                    </Button>
                  </div>
                ) : null}

                {nextHabit ? (
                  <div className="flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center">
                    <Flame className="size-4 shrink-0 text-orange-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nextHabit.emoji} {nextHabit.name}</p>
                      <p className="text-xs text-muted-foreground">Next habit in the chain</p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={handleQuickCheckHabit}
                      disabled={quickActionId === `habit:${nextHabit.id}`}
                    >
                      Check
                    </Button>
                  </div>
                ) : null}

                {nextPlanBlock ? (
                  <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
                    <CalendarClock className="size-4 shrink-0 text-purple-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nextPlanBlock.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {nextPlanBlock.startTime}-{nextPlanBlock.endTime}
                      </p>
                    </div>
                  </div>
                ) : null}

                {!topTask && !nextHabit && !nextPlanBlock && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Nothing urgent is waiting. Add a task, habit, or plan block when you want a sharper next move.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-5">
              <Button variant="outline" className="justify-start sm:justify-center" onClick={() => setSheetTab('tasks')}>
                <ListTodo className="mr-1.5 size-4" />
                Manage Tasks
              </Button>
              <Button variant="outline" className="justify-start sm:justify-center" onClick={() => setSheetTab('habits')}>
                <Flame className="mr-1.5 size-4" />
                Manage Habits
              </Button>
              <Button variant="outline" className="justify-start sm:justify-center" onClick={() => setSheetTab('routines')}>
                <Sparkles className="mr-1.5 size-4" />
                Routines
              </Button>
              <Button
                variant="outline"
                className="justify-start sm:justify-center"
                onClick={() => {
                  setShowAddPlan(true)
                  setSheetTab('plan')
                }}
              >
                <CalendarClock className="mr-1.5 size-4" />
                Add Plan
              </Button>
              <Button
                variant="outline"
                className="justify-start sm:justify-center"
                onClick={() => setSheetTab('goals')}
              >
                <Target className="mr-1.5 size-4" />
                Goals
              </Button>
            </div>
          </div>
          )}

          {sheetTab === 'tasks' && (
            <TaskList
              key={`focus-sheet-tasks-${initialOpenPanel === 'task' ? 'open' : 'closed'}`}
              userId={userId}
              compact
              limit={12}
              onlyOpen
              initiallyOpen={initialOpenPanel === 'task'}
            />
          )}

          {sheetTab === 'habits' && (
            <HabitDashboardWidget
              key={`focus-sheet-habits-${initialOpenPanel === 'habit' ? 'open' : 'closed'}`}
              userId={userId}
              initiallyOpen={initialOpenPanel === 'habit'}
            />
          )}

          {sheetTab === 'routines' && (
            <RoutinesManager userId={userId} />
          )}

          {sheetTab === 'plan' && (
            <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Today&apos;s Plan</p>
                <p className="text-xs text-muted-foreground">
                  Shape the day with concrete time blocks.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={showAddPlan ? 'outline' : 'default'}
                onClick={() => setShowAddPlan((open) => !open)}
              >
                {showAddPlan ? <Minus className="mr-1.5 size-4" /> : <Plus className="mr-1.5 size-4" />}
                {showAddPlan ? 'Close' : 'Add Block'}
              </Button>
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
                    className="col-span-2 flex h-10 rounded-lg border border-input bg-background px-3 text-sm sm:col-span-1 sm:h-8 sm:px-2 sm:text-xs"
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
                    className="col-span-2 h-10 sm:col-span-1 sm:h-8"
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

            {blocks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No plan blocks yet. Add one to make the next part of the day obvious.
              </p>
            ) : (
              <ul className="space-y-2">
                {blocks.map((block) => (
                  <li key={block.id} className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm">
                    {block.isCurrent ? (
                      <CheckCircle2 className="size-4 text-primary" />
                    ) : block.isPast ? (
                      <Check className="size-4 text-muted-foreground" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                      {block.startTime}-{block.endTime}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{block.title}</span>
                  </li>
                ))}
              </ul>
            )}
            </div>
          )}

          {sheetTab === 'goals' && (
            <GoalsDashboardWidget
              key={`focus-sheet-goals-${initialOpenPanel === 'goal' ? 'open' : 'closed'}`}
              userId={userId}
              initialGoals={goals}
              initiallyOpen={initialOpenPanel === 'goal'}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}

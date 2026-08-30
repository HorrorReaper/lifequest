'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, Circle, Flame, ListTodo, Sparkles, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DayPlanMissionType, Goal } from '@/lib/types'
import type { Database } from '@/lib/supabase/database.types'
import { supabaseInsert, supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { toggleTask } from '@/lib/tasks'
import { useUserStore } from '@/lib/stores/user-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  missionType: DayPlanMissionType | null
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
  mainQuestTitle: string | null
  planCommitted: boolean
  goals: Goal[]
  goalsEnabled?: boolean
  completedJournalCount: number
  routinesEnabled?: boolean
  initialOpenPanel?: 'plan' | 'task' | 'habit' | 'goal' | 'routine' | null
}

type FocusSheetTab = 'tasks' | 'habits' | 'routines' | 'plan' | 'goals'

const focusSheetTabs: { value: FocusSheetTab; label: string }[] = [
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

export function DailyBriefingWidget({
  userId,
  todayDate,
  todayLabel,
  habits,
  tasks,
  journals,
  planBlocks,
  mainQuestTitle,
  planCommitted,
  goals,
  goalsEnabled = false,
  completedJournalCount,
  routinesEnabled = false,
  initialOpenPanel = null,
}: DailyBriefingWidgetProps) {
  const safeInitialOpenPanel =
    (initialOpenPanel === 'routine' && !routinesEnabled) ||
    (initialOpenPanel === 'goal' && !goalsEnabled)
      ? null
      : initialOpenPanel
  const supabase = createClient()
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)
  const [blocks] = useState(planBlocks)
  const [localHabits, setLocalHabits] = useState(habits)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [sheetOpen, setSheetOpen] = useState(safeInitialOpenPanel !== null)
  const [sheetTab, setSheetTab] = useState<FocusSheetTab>(
    safeInitialOpenPanel === 'task'
      ? 'tasks'
      : safeInitialOpenPanel === 'habit'
        ? 'habits'
        : safeInitialOpenPanel === 'routine'
          ? 'routines'
        : safeInitialOpenPanel === 'plan'
          ? 'plan'
          : safeInitialOpenPanel === 'goal'
            ? 'goals'
          : 'tasks'
  )
  const [quickActionId, setQuickActionId] = useState<string | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)
  const visibleFocusSheetTabs = focusSheetTabs.filter(
    (tab) =>
      (tab.value !== 'routines' || routinesEnabled) &&
      (tab.value !== 'goals' || goalsEnabled)
  )

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
  const focusCopy = mainQuestTitle
    ? `Your Main Quest is “${mainQuestTitle}”. Protect its next block before reacting to everything else.`
    : allClear
    ? 'Everything important is handled. Keep the day light or add a deliberate next block.'
    : completedJournalCount === 0
      ? 'Start with a quick journal entry, then move into the next concrete action.'
      : 'Journal is done. Keep momentum with the next plan block, task, or habit.'

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
              asChild
              size="lg"
              variant="outline"
              className="h-auto min-h-14 flex-1 rounded-xl px-4 py-3.5 text-[0.95rem] sm:min-h-12 sm:py-2.5"
            >
              <Link href="/plan">
                <CalendarClock className="mr-1.5 size-5" />
                {planCommitted ? 'Review Plan' : 'Plan Today'}
              </Link>
            </Button>
          </div>
          {quickError && <p className="mt-3 text-xs text-destructive">{quickError}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {mainQuestTitle && (
            <section className="rounded-lg border border-primary/25 bg-primary/5 p-3 sm:col-span-2">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Target className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Main Quest
                  </p>
                  <p className="mt-1 text-sm font-semibold">{mainQuestTitle}</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/plan">Review</Link>
                </Button>
              </div>
            </section>
          )}

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

          <section
            role="link"
            tabIndex={0}
            aria-label="Manage tasks"
            onClick={() => router.push('/tasks')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                router.push('/tasks')
              }
            }}
            className="cursor-pointer rounded-lg border bg-background/70 p-3 transition-colors hover:border-blue-500/35 hover:bg-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            <div className="mt-3 flex gap-2">
              {topTask && (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 flex-1 sm:h-8"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleQuickCompleteTask()
                  }}
                  disabled={quickActionId === `task:${topTask.id}`}
                >
                  <Check className="mr-1.5 size-3.5" />
                  {quickActionId === `task:${topTask.id}` ? 'Completing...' : 'Complete'}
                </Button>
              )}
              <Button asChild size="sm" variant="outline" className="h-10 flex-1 sm:h-8">
                <Link href="/tasks" onClick={(event) => event.stopPropagation()}>Manage</Link>
              </Button>
            </div>
          </section>

          <section
            role="link"
            tabIndex={0}
            aria-label={nextHabit ? `View analytics for ${nextHabit.name}` : 'Manage habits'}
            onClick={() => router.push(nextHabit ? `/habits/${nextHabit.id}` : '/habits')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                router.push(nextHabit ? `/habits/${nextHabit.id}` : '/habits')
              }
            }}
            className="cursor-pointer rounded-lg border bg-background/70 p-3 transition-colors hover:border-orange-500/35 hover:bg-orange-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
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
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleQuickCheckHabit()
                  }}
                  disabled={quickActionId === `habit:${nextHabit.id}`}
                >
                  <Check className="mr-1.5 size-3.5" />
                  {quickActionId === `habit:${nextHabit.id}` ? 'Checking...' : 'Check'}
                </Button>
              )}
              <Button asChild size="sm" variant="outline" className="h-10 flex-1 sm:h-8">
                <Link href="/habits" onClick={(event) => event.stopPropagation()}>Manage</Link>
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
          <DialogTitle className="text-xl">Manage your day</DialogTitle>
          <DialogDescription>
            Update tasks, habits, and today&apos;s plan without leaving the dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4 pb-[calc(1rem+var(--safe-area-bottom))] sm:pb-4">
          <div
            role="tablist"
            aria-label="Daily management sections"
            className={cn(
              'grid grid-cols-3 gap-1 rounded-2xl border bg-muted/35 p-1',
              routinesEnabled && goalsEnabled
                ? 'sm:grid-cols-5'
                : routinesEnabled || goalsEnabled
                  ? 'sm:grid-cols-4'
                  : 'sm:grid-cols-3'
            )}
          >
            {visibleFocusSheetTabs.map((tab) => (
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

          {sheetTab === 'tasks' && (
            <TaskList
              key={`focus-sheet-tasks-${initialOpenPanel === 'task' ? 'open' : 'closed'}`}
              userId={userId}
              today={todayDate}
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
              todayDate={todayDate}
            />
          )}

          {routinesEnabled && sheetTab === 'routines' && (
            <RoutinesManager userId={userId} />
          )}

          {sheetTab === 'plan' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Target className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {planCommitted ? 'Daily plan committed' : 'Guided daily planning'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Choose a Main Quest, cap the day at three outcomes, protect your anchors, and reality-check the timeline.
                    </p>
                  </div>
                </div>
                {mainQuestTitle && (
                  <div className="mt-4 rounded-xl border bg-background/75 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Main Quest
                    </p>
                    <p className="mt-1 text-sm font-medium">{mainQuestTitle}</p>
                  </div>
                )}
                <Button asChild className="mt-4 w-full">
                  <Link href="/plan">
                    <CalendarClock className="mr-1.5 size-4" />
                    {planCommitted ? 'Review Today’s Plan' : 'Start Planning Ritual'}
                  </Link>
                </Button>
              </div>

            {blocks.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                No timeline yet. The planning ritual will build the first draft from your chosen outcomes.
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

          {goalsEnabled && sheetTab === 'goals' && (
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

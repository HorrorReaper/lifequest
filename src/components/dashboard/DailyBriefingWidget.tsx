'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, CalendarClock, Check, CheckCircle2, Circle, Sparkles, Target } from 'lucide-react'
import type { DayPlanMissionType, Goal } from '@/lib/types'
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
  const router = useRouter()
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
  // Deliberately says nothing about journaling any more: that is the
  // JournalNudge section's job, and it sits directly above this card.
  // Nor about the timeline: TodayPlanSection owns that, higher up the page.
  const focusCopy = mainQuestTitle
    ? `Your Main Quest is “${mainQuestTitle}”. Protect its next block before reacting to everything else.`
    : allClear
      ? 'Everything important is handled. Keep the day light or add a deliberate next block.'
      : 'The journals, tasks, and habits that make up today.'

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
        <p className="text-sm leading-relaxed text-muted-foreground">{focusCopy}</p>

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
            className="cursor-pointer rounded-lg border bg-background/70 p-3 transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:col-span-2"
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

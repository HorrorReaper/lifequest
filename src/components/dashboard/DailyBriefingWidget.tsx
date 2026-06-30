'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookOpen, CalendarClock, CheckCircle2, Circle, Flame, ListTodo, Minus, Plus, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { upsertDayPlan } from '@/lib/day-plans'
import type { DayPlanBlock } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
}: DailyBriefingWidgetProps) {
  const supabase = createClient()
  const router = useRouter()
  const [blocks, setBlocks] = useState(planBlocks)
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [planTitle, setPlanTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [category, setCategory] = useState<DayPlanBlock['category']>('deep_work')
  const [savingPlan, setSavingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  const completedHabits = habits.filter((habit) => habit.completed).length
  const openTasks = tasks.length
  const activePlanBlocks = blocks.filter((block) => !block.isPast).length
  const totalItems = habits.length + openTasks + activePlanBlocks + Math.max(journals.length > 0 ? 1 : 0, 0)
  const doneItems = completedHabits + completedJournalCount + blocks.filter((block) => block.isPast).length
  const allClear = totalItems > 0 && doneItems >= totalItems
  const canSavePlan = planTitle.trim().length > 0 && startTime < endTime

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

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-start gap-3 text-lg">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            Daily Briefing
            <span className="block text-xs font-normal text-muted-foreground">
              {todayLabel}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {allClear
            ? 'Everything important is handled for today. Strong close.'
            : 'Here is your focus for today: journal, clear the important tasks, and keep your habit chain alive.'}
        </p>

        <div className="grid gap-3">
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
              <p className="text-xs text-muted-foreground">
                You already completed a journal entry today. Add another reflection if something important comes up.
              </p>
            ) : journals.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Recommended starting points:
                </p>
                <div className="flex flex-wrap gap-2">
                  {journals.slice(0, 3).map((journal) => (
                    <Button key={journal.id} asChild variant="outline" size="sm" className="h-8">
                      <Link href={`/journal/new/${journal.id}`}>
                        <span className="mr-1.5">{journal.icon}</span>
                        {journal.name}
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No active journal templates found.
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-purple-500" />
                <h3 className="text-sm font-semibold">Daily Plan</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {blocks.length > 0 ? `${activePlanBlocks} left` : 'No plan'}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={showAddPlan ? 'outline' : 'default'}
                  onClick={() => setShowAddPlan((open) => !open)}
                  className="h-7 px-2 text-xs"
                >
                  {showAddPlan ? (
                    <Minus className="mr-1 size-3.5" />
                  ) : (
                    <Plus className="mr-1 size-3.5" />
                  )}
                  {showAddPlan ? 'Close' : 'Add'}
                </Button>
              </div>
            </div>

            {showAddPlan && (
              <form onSubmit={handleAddPlanBlock} className="mb-3 space-y-2 rounded-lg border bg-muted/30 p-3">
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

            {blocks.length > 0 ? (
              <ul className="space-y-1.5">
                {blocks.slice(0, 4).map((block) => (
                  <li key={block.id} className="flex items-center gap-2 text-xs">
                    {block.isPast ? (
                      <CheckCircle2 className="size-3.5 text-green-500" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="w-24 shrink-0 font-mono text-muted-foreground">
                      {block.startTime}-{block.endTime}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate', block.isPast && 'text-muted-foreground line-through')}>
                      {block.title}
                    </span>
                    {block.isCurrent ? (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                        Now
                      </span>
                    ) : (
                      <span className="shrink-0 capitalize text-muted-foreground">
                        {block.category.replace('_', ' ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No plan for today. Add a time block to give the day a clear shape.
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-orange-500" />
                <h3 className="text-sm font-semibold">Habits</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {habits.length > 0 ? `${completedHabits}/${habits.length} done` : 'None set'}
              </span>
            </div>

            {habits.length > 0 ? (
              <ul className="space-y-1.5">
                {habits.slice(0, 4).map((habit) => (
                  <li key={habit.id} className="flex items-center gap-2 text-xs">
                    {habit.completed ? (
                      <CheckCircle2 className="size-3.5 text-green-500" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground" />
                    )}
                    <span>{habit.emoji}</span>
                    <span className={cn(habit.completed && 'text-muted-foreground line-through')}>
                      {habit.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add habits in Settings to include them in your daily briefing.
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListTodo className="size-4 text-blue-500" />
                <h3 className="text-sm font-semibold">Tasks</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {openTasks > 0 ? `${openTasks} due` : 'Clear'}
              </span>
            </div>

            {tasks.length > 0 ? (
              <ul className="space-y-1.5">
                {tasks.slice(0, 4).map((task) => (
                  <li key={task.id} className="flex items-center gap-2 text-xs">
                    <Circle className="size-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <span
                      className={cn(
                        'shrink-0 font-medium capitalize',
                        task.isOverdue ? 'text-red-600 dark:text-red-400' : priorityStyles[task.priority]
                      )}
                    >
                      {task.isOverdue ? 'Overdue' : task.priority}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No due or overdue tasks. Keep the day clean.
              </p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  )
}

import Link from 'next/link'
import { BookOpen, CalendarClock, CheckCircle2, Circle, Flame, ListTodo, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

export function DailyBriefingWidget({
  todayLabel,
  habits,
  tasks,
  journals,
  planBlocks,
  completedJournalCount,
}: DailyBriefingWidgetProps) {
  const completedHabits = habits.filter((habit) => habit.completed).length
  const openTasks = tasks.length
  const activePlanBlocks = planBlocks.filter((block) => !block.isPast).length
  const totalItems = habits.length + openTasks + activePlanBlocks + Math.max(journals.length > 0 ? 1 : 0, 0)
  const doneItems = completedHabits + completedJournalCount + planBlocks.filter((block) => block.isPast).length
  const allClear = totalItems > 0 && doneItems >= totalItems

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
              <span className="text-xs text-muted-foreground">
                {planBlocks.length > 0 ? `${activePlanBlocks} left` : 'No plan'}
              </span>
            </div>

            {planBlocks.length > 0 ? (
              <ul className="space-y-1.5">
                {planBlocks.slice(0, 4).map((block) => (
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
                No plan for today. Use the Day Planner field in a journal entry to map your day.
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

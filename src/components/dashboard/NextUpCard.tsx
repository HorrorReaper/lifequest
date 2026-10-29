'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  ListChecks,
  Loader2,
  PenLine,
  Plus,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { completeTaskWithReward } from '@/lib/tasks'
import { useUserStore } from '@/lib/stores/user-store'
import {
  durationFigure,
  nextUpFor,
  type PlannedReflection,
  type PlanStatusBlock,
} from '@/lib/dashboard-plan'
import { describeTaskDue } from '@/lib/today-plan'
import { Button } from '@/components/ui/button'
import { ProgressRing } from '@/components/ui/progress-ring'
import { cn } from '@/lib/utils'

interface NextUpHabit {
  id: string
  name: string
  completed: boolean
}

interface NextUpCardProps {
  userId: string
  blocks: PlanStatusBlock[]
  /** Minutes past midnight in the profile timezone, measured on the server. */
  nowMinutes: number
  /** Open tasks due today or earlier, or with no due date. */
  openTaskCount: number
  /** Open tasks due today or earlier; overdue ones included. */
  dueTodayCount?: number
  overdueCount?: number
  /** The first of those, named on the card. */
  firstDueTitle?: string | null
  /** Today's habits, done or not. */
  habits: NextUpHabit[]
  /** Reflections chosen for today in the planner. */
  reflections?: PlannedReflection[]
  /** The profile's date key; due dates are described against it. */
  today: string
  plannerHref?: string
}

const TICK_MS = 30_000

type Tone = 'primary' | 'journal'

/** Reflections read blue so they are not mistaken for a task at a glance. */
const TONE = {
  primary: { text: 'text-primary', chip: 'bg-primary/10 text-primary', icon: 'bg-primary/10 text-primary' },
  journal: {
    text: 'text-blue-700 dark:text-blue-300',
    chip: 'bg-blue-500/12 text-blue-800 dark:text-blue-200',
    icon: 'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  },
} as const

/** The filled button of a reflection, in the reflection's blue. */
const JOURNAL_BUTTON =
  'bg-blue-700 text-white hover:bg-blue-700/90 dark:bg-blue-400 dark:text-blue-950 dark:hover:bg-blue-400/90'

const DUE_CHIP = 'bg-amber-500/15 text-amber-900 dark:text-amber-200'

interface Chip {
  label: string
  className: string
}

interface Action {
  label: string
  icon?: LucideIcon
  href?: string
  onClick?: () => void
  busy?: boolean
}

/**
 * The first thing on the dashboard after the greeting: one concrete next
 * step, with the action to take it.
 *
 * Two layouts. A time block running now or coming up leads with a large
 * figure -- the minutes left or to go -- and one full-width action. Anything
 * counted (habits, planned tasks, reflections) or not yet planned leads with
 * a ring or an icon beside the title. The wording follows `nextUpFor`, which
 * keeps clock time and completion apart: a block that is over says so, and
 * a task in it stays "open" until someone marks it done.
 */
export function NextUpCard({
  userId,
  blocks,
  nowMinutes,
  openTaskCount,
  dueTodayCount = 0,
  overdueCount = 0,
  firstDueTitle = null,
  habits,
  reflections = [],
  today,
  plannerHref = '/plan',
}: NextUpCardProps) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const addXp = useUserStore((state) => state.addXp)
  const [minutesElapsed, setMinutesElapsed] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)

  // Advanced from the server's clock reading rather than the device's, for
  // the same reason as TodayPlanSection: the profile timezone decides.
  useEffect(() => {
    const mountedAt = Date.now()
    const id = setInterval(() => {
      setMinutesElapsed(Math.floor((Date.now() - mountedAt) / 60_000))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const effectiveBlocks = blocks.map((block) =>
    block.taskId && doneTaskIds.has(block.taskId) ? { ...block, taskCompleted: true } : block
  )
  const openHabits = habits.filter((habit) => !habit.completed)
  const next = nextUpFor({
    blocks: effectiveBlocks,
    nowMinutes: nowMinutes + minutesElapsed,
    openTaskCount,
    openHabits: openHabits.length,
    dueTodayCount,
    overdueCount,
    reflections,
  })

  async function markDone(block: PlanStatusBlock) {
    if (!block.taskId || lock.current) return
    lock.current = true
    setCompleting(true)
    setError(null)
    try {
      const result = await completeTaskWithReward(supabase, userId, {
        id: block.taskId,
        title: block.title,
      })
      if (result.awarded) addXp(5, result.previousTotal)
      setDoneTaskIds((current) => new Set(current).add(block.taskId as string))
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch {
      setError('That did not save. Check your connection and try again.')
    } finally {
      lock.current = false
      setCompleting(false)
    }
  }

  const markDoneAction = (block: PlanStatusBlock): Action => ({
    label: completing ? 'Saving…' : 'Mark task done',
    icon: completing ? Loader2 : Check,
    onClick: () => void markDone(block),
    busy: completing,
  })
  const editPlan: Action = { label: 'Edit plan', href: plannerHref }

  /** What a block is, in a few words, for the line under its title. */
  function blockDetails(block: PlanStatusBlock): string[] {
    const due =
      block.taskId && block.taskCompleted === false && block.taskDueDate
        ? describeTaskDue(block.taskDueDate, today)
        : null
    return [
      block.taskCompleted ? 'Task done' : null,
      block.priorityLabel ?? null,
      due,
      block.source === 'journal' ? 'Reflection' : block.source === 'habit' ? 'Habit' : null,
      `${block.startTime}–${block.endTime}`,
    ].filter((item): item is string => Boolean(item))
  }

  let card: ReactNode
  switch (next.kind) {
    case 'first-task':
      card = (
        <RingLayout
          icon={Plus}
          eyebrow="Next up"
          title="Add your first task"
          detail="One small, concrete thing you want to get done."
          primary={{ label: 'Add task', icon: Plus, href: '/tasks?new=1' }}
        />
      )
      break
    case 'plan-day':
      card = (
        <RingLayout
          icon={CalendarClock}
          eyebrow="Next up"
          title="Plan your day"
          detail="Pick a main priority and give it a time."
          primary={{ label: 'Plan my day', icon: CalendarClock, href: plannerHref }}
        />
      )
      break
    case 'tasks-due':
      card = (
        <RingLayout
          icon={ListChecks}
          eyebrow="Next up · nothing planned yet"
          title={`${next.dueToday} ${next.dueToday === 1 ? 'task' : 'tasks'} due today`}
          chips={[
            next.overdue > 0 ? { label: `${next.overdue} overdue`, className: DUE_CHIP } : null,
            firstDueTitle ? { label: firstDueTitle, className: TONE.primary.chip } : null,
          ]}
          primary={{ label: 'Plan my day', icon: CalendarClock, href: plannerHref }}
        />
      )
      break
    case 'current': {
      const { block } = next
      const figure = durationFigure(next.minutesLeft)
      const openTask = block.taskId && block.taskCompleted === false
      const journal = block.source === 'journal' && block.templateId
      card = (
        <FigureLayout
          tone={block.source === 'journal' ? 'journal' : 'primary'}
          eyebrow={`Now · until ${block.endTime}`}
          figure={figure.value}
          unit={`${figure.unit} left`}
          side={
            <ProgressRing
              size={44}
              strokeWidth={5}
              value={1 - next.minutesLeft / Math.max(1, next.durationMinutes)}
              className={block.source === 'journal' ? TONE.journal.text : undefined}
            />
          }
          title={block.title}
          details={blockDetails(block)}
          primary={
            openTask
              ? markDoneAction(block)
              : journal
                ? { label: 'Write now', icon: PenLine, href: `/journal/new/${block.templateId}` }
                : block.source === 'habit'
                  ? { label: 'Check in', icon: Check, href: '#habits' }
                  : { ...editPlan, icon: CalendarClock }
          }
          secondary={openTask || journal || block.source === 'habit' ? editPlan : null}
        />
      )
      break
    }
    case 'next': {
      const { block } = next
      const figure = durationFigure(next.minutesUntil)
      const openTask = block.taskId && block.taskCompleted === false
      const journal = block.source === 'journal' && block.templateId
      const SideIcon = journal ? BookOpen : openTask ? ListChecks : CalendarClock
      card = (
        <FigureLayout
          tone={journal ? 'journal' : 'primary'}
          eyebrow={`Next at ${block.startTime}`}
          figure={figure.value}
          unit={`${figure.unit} to go`}
          side={<IconBadge icon={SideIcon} tone={journal ? 'journal' : 'primary'} size="sm" />}
          title={block.title}
          details={blockDetails(block)}
          // It is not its time yet, so the action is offered, not pressed:
          // the outline button reads as "if you like".
          quiet
          primary={
            openTask
              ? markDoneAction(block)
              : journal
                ? { label: 'Start early', icon: PenLine, href: `/journal/new/${block.templateId}` }
                : { ...editPlan, icon: CalendarClock }
          }
          secondary={openTask || journal ? editPlan : null}
        />
      )
      break
    }
    case 'open-after-plan': {
      const { block } = next
      const due = block.taskDueDate ? describeTaskDue(block.taskDueDate, today) : null
      card = (
        <RingLayout
          ring={{
            value: next.plannedTasks > 0 ? next.plannedDone / next.plannedTasks : 0,
            label: `${next.plannedDone}/${next.plannedTasks}`,
            spoken: `${next.plannedDone} of ${next.plannedTasks} planned tasks done.`,
          }}
          eyebrow="Planned today, still open"
          title={block.title}
          chips={[
            due ? { label: due, className: DUE_CHIP } : null,
            next.moreOpen > 0
              ? { label: `+${next.moreOpen} more open`, className: TONE.primary.chip }
              : null,
          ]}
          primary={markDoneAction(block)}
          secondary={{ label: 'Replan', icon: CalendarClock, href: plannerHref }}
        />
      )
      break
    }
    case 'plan-finished': {
      if (next.openHabits > 0) {
        const done = habits.length - openHabits.length
        const shown = openHabits.slice(0, 2)
        card = (
          <RingLayout
            ring={{
              value: habits.length > 0 ? done / habits.length : 0,
              label: `${done}/${habits.length}`,
              spoken: `${done} of ${habits.length} habits done today.`,
            }}
            eyebrow="No more time blocks today"
            title={`${next.openHabits} ${next.openHabits === 1 ? 'habit' : 'habits'} still open`}
            chips={[
              ...shown.map((habit) => ({ label: habit.name, className: TONE.primary.chip })),
              openHabits.length > shown.length
                ? {
                    label: `+${openHabits.length - shown.length} more`,
                    className: 'text-muted-foreground',
                  }
                : null,
            ]}
            primary={{ label: 'Check in', icon: ArrowRight, href: '#habits' }}
          />
        )
      } else {
        card = (
          <RingLayout
            icon={Check}
            eyebrow="No more time blocks today"
            title="Your planned blocks are behind you"
            detail="Add a block if there is more to do, or take a minute to reflect."
            primary={{ label: 'Edit plan', icon: CalendarClock, href: plannerHref }}
          />
        )
      }
      break
    }
    case 'journal-open':
      card = (
        <RingLayout
          tone="journal"
          ring={{
            value: next.planned > 0 ? next.written / next.planned : 0,
            label: `${next.written}/${next.planned}`,
            spoken: `${next.written} of ${next.planned} reflections written today.`,
          }}
          eyebrow="Reflection still open"
          title={next.reflection.title}
          chips={[
            next.planned - next.written > 1
              ? {
                  label: `+${next.planned - next.written - 1} more to write`,
                  className: TONE.journal.chip,
                }
              : null,
          ]}
          primary={{
            label: 'Write now',
            icon: PenLine,
            href: `/journal/new/${next.reflection.templateId}`,
          }}
        />
      )
      break
    case 'journal-done':
      card = (
        <RingLayout
          icon={Check}
          eyebrow="Journal done for today"
          title={
            next.written === 1
              ? 'Your reflection is written'
              : `${next.written} of ${next.written} reflections written`
          }
          primary={{ label: 'Open journal', icon: BookOpen, href: '/journal' }}
          quiet
        />
      )
      break
  }

  return (
    <section
      aria-labelledby="next-up-title"
      data-kind={next.kind}
      className="rounded-2xl border border-primary/25 bg-card p-5 shadow-sm"
    >
      {card}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

function IconBadge({
  icon: Icon,
  tone,
  size,
}: {
  icon: LucideIcon
  tone: Tone
  size: 'sm' | 'md'
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        size === 'md' ? 'size-14' : 'size-11',
        TONE[tone].icon
      )}
    >
      <Icon className={size === 'md' ? 'size-6' : 'size-5'} />
    </span>
  )
}

function ActionButton({
  action,
  variant,
  className,
}: {
  action: Action
  variant: 'default' | 'outline' | 'ghost'
  className?: string
}) {
  const Icon = action.icon
  const content = (
    <>
      {Icon && <Icon className={cn('size-4', action.busy && 'animate-spin')} />}
      {action.label}
    </>
  )
  if (action.href) {
    return (
      <Button asChild size="lg" variant={variant} className={cn('h-12 px-5', className)}>
        <Link href={action.href}>{content}</Link>
      </Button>
    )
  }
  return (
    <Button
      type="button"
      size="lg"
      variant={variant}
      disabled={action.busy}
      onClick={action.onClick}
      className={cn('h-12 px-5', className)}
    >
      {content}
    </Button>
  )
}

/**
 * B1: a ring (or an icon) beside the title, chips under it, then the
 * actions. For what is counted -- habits, planned tasks, reflections -- and
 * for asking for a plan.
 */
function RingLayout({
  tone = 'primary',
  ring,
  icon,
  eyebrow,
  title,
  detail,
  chips = [],
  primary,
  secondary,
  quiet = false,
}: {
  tone?: Tone
  ring?: { value: number; label: string; spoken: string }
  icon?: LucideIcon
  eyebrow: string
  title: string
  detail?: string
  chips?: (Chip | null)[]
  primary: Action
  secondary?: Action | null
  quiet?: boolean
}) {
  const shownChips = chips.filter((chip): chip is Chip => chip !== null)
  return (
    <div className="flex items-start gap-4">
      {ring ? (
        <ProgressRing
          value={ring.value}
          size={56}
          className={tone === 'journal' ? TONE.journal.text : undefined}
        >
          {ring.label}
        </ProgressRing>
      ) : icon ? (
        <IconBadge icon={icon} tone={tone} size="md" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', TONE[tone].text)}>{eyebrow}</p>
        <h2 id="next-up-title" className="mt-0.5 text-xl leading-snug font-semibold break-words">
          {title}
        </h2>
        {ring && <p className="sr-only">{ring.spoken}</p>}
        {detail && <p className="mt-1 text-base text-muted-foreground">{detail}</p>}
        {shownChips.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {shownChips.map((chip, index) => (
              <li
                key={`${index}-${chip.label}`}
                className={cn(
                  'max-w-full truncate rounded-full px-2.5 py-1 text-sm',
                  chip.className
                )}
              >
                {chip.label}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton
            action={primary}
            variant={quiet ? 'outline' : 'default'}
            className={!quiet && tone === 'journal' ? JOURNAL_BUTTON : undefined}
          />
          {secondary && <ActionButton action={secondary} variant="outline" />}
        </div>
      </div>
    </div>
  )
}

/**
 * B2: the time first, as a large figure ("45 min left", "40 min to go"),
 * the block under it, and one full-width action. For a block running now or
 * coming up next.
 */
function FigureLayout({
  tone,
  eyebrow,
  figure,
  unit,
  side,
  title,
  details,
  primary,
  secondary,
  quiet = false,
}: {
  tone: Tone
  eyebrow: string
  figure: string
  unit: string
  side: ReactNode
  title: string
  details: string[]
  primary: Action
  secondary: Action | null
  quiet?: boolean
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-sm font-medium', TONE[tone].text)}>{eyebrow}</p>
          <p className="mt-1 text-4xl leading-none font-semibold tabular-nums">
            {figure}
            <span className="ml-1.5 text-base font-normal text-muted-foreground">{unit}</span>
          </p>
        </div>
        {side}
      </div>
      <h2 id="next-up-title" className="mt-3 text-lg leading-snug font-semibold break-words">
        {title}
      </h2>
      {details.length > 0 && (
        <p className="mt-0.5 text-sm text-muted-foreground">{details.join(' · ')}</p>
      )}
      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
        <ActionButton
          action={primary}
          variant={quiet ? 'outline' : 'default'}
          className={cn(
            'w-full sm:w-auto sm:min-w-48',
            !quiet && tone === 'journal' && JOURNAL_BUTTON
          )}
        />
        {secondary && <ActionButton action={secondary} variant="ghost" />}
      </div>
    </div>
  )
}

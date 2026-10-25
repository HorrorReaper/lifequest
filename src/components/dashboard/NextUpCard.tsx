'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarClock, Check, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { completeTaskWithReward } from '@/lib/tasks'
import { useUserStore } from '@/lib/stores/user-store'
import {
  formatRelativeMinutes,
  nextUpFor,
  type PlanStatusBlock,
} from '@/lib/dashboard-plan'
import { Button } from '@/components/ui/button'

interface NextUpCardProps {
  userId: string
  blocks: PlanStatusBlock[]
  /** Minutes past midnight in the profile timezone, measured on the server. */
  nowMinutes: number
  /** Open tasks due today or earlier, or with no due date. */
  openTaskCount: number
  openHabits: number
  plannerHref?: string
}

const TICK_MS = 30_000

/**
 * The first thing on the dashboard after the greeting: one concrete next
 * step, with the action to take it.
 *
 * The wording follows `nextUpFor`, which keeps clock time and completion
 * apart -- a block that is over says so, and a task in it stays "open" until
 * someone marks it done.
 */
export function NextUpCard({
  userId,
  blocks,
  nowMinutes,
  openTaskCount,
  openHabits,
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
  const next = nextUpFor({
    blocks: effectiveBlocks,
    nowMinutes: nowMinutes + minutesElapsed,
    openTaskCount,
    openHabits,
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

  const blockWithOpenTask =
    (next.kind === 'current' || next.kind === 'next' || next.kind === 'open-after-plan') &&
    next.block.taskId &&
    next.block.taskCompleted === false
      ? next.block
      : null

  let eyebrow: string
  let title: string
  let detail: string | null = null
  let link: { href: string; label: string; icon: typeof Plus } | null = null

  switch (next.kind) {
    case 'first-task':
      eyebrow = 'Next up'
      title = 'Add your first task'
      detail = 'One small, concrete thing you want to get done.'
      link = { href: '/tasks?new=1', label: 'Add task', icon: Plus }
      break
    case 'plan-day':
      eyebrow = 'Next up'
      title = 'Plan your day'
      detail = 'Pick a main priority and give it a time.'
      link = { href: plannerHref, label: 'Plan my day', icon: CalendarClock }
      break
    case 'current':
      eyebrow = `Now · until ${next.block.endTime}`
      title = next.block.title
      detail = `${next.block.taskCompleted ? 'Task done. ' : ''}${formatRelativeMinutes(next.minutesLeft)} left in this block.`
      link = { href: plannerHref, label: 'Edit plan', icon: CalendarClock }
      break
    case 'next':
      eyebrow = `Next at ${next.block.startTime} · in ${formatRelativeMinutes(next.minutesUntil)}`
      title = next.block.title
      detail = `${next.block.startTime} – ${next.block.endTime}`
      link = { href: plannerHref, label: 'Edit plan', icon: CalendarClock }
      break
    case 'open-after-plan':
      eyebrow = 'No more time blocks today'
      title = next.block.title
      detail =
        next.moreOpen > 0
          ? `Still open, with ${next.moreOpen} more planned ${next.moreOpen === 1 ? 'task' : 'tasks'}.`
          : 'Planned for today and still open.'
      link = { href: plannerHref, label: 'Replan', icon: CalendarClock }
      break
    case 'plan-finished':
      eyebrow = 'No more time blocks today'
      title =
        next.openHabits > 0
          ? `${next.openHabits} ${next.openHabits === 1 ? 'habit' : 'habits'} still open today`
          : 'Your planned blocks are behind you'
      detail =
        next.openHabits > 0
          ? 'A quick check-in keeps your streaks going.'
          : 'Add a block if there is more to do, or take a minute to reflect.'
      link =
        next.openHabits > 0
          ? { href: '#habits', label: 'Go to habits', icon: ArrowRight }
          : { href: plannerHref, label: 'Edit plan', icon: CalendarClock }
      break
  }

  const LinkIcon = link?.icon

  return (
    <section
      aria-labelledby="next-up-title"
      className="rounded-2xl border border-primary/25 bg-card p-5 shadow-sm"
    >
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 id="next-up-title" className="mt-1 text-xl leading-snug font-semibold break-words">
        {title}
      </h2>
      {detail && <p className="mt-1 text-base text-muted-foreground">{detail}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {blockWithOpenTask && (
          <Button
            type="button"
            size="lg"
            className="h-12 px-5"
            disabled={completing}
            onClick={() => void markDone(blockWithOpenTask)}
          >
            {completing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {completing ? 'Saving…' : 'Mark task done'}
          </Button>
        )}
        {link && LinkIcon && (
          <Button
            asChild
            size="lg"
            variant={blockWithOpenTask ? 'outline' : 'default'}
            className="h-12 px-5"
          >
            <Link href={link.href}>
              <LinkIcon className="size-4" />
              {link.label}
            </Link>
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

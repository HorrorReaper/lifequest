import Link from 'next/link'
import { ArrowRight, CalendarDays, Coins, Lock, Sparkles, Zap } from 'lucide-react'
import type { ChallengeProgram } from '@/lib/challenge-programs'
import type { ChallengeView } from '@/lib/challenges'
import { isAutomaticRule } from '@/lib/challenge-rules'
import { ChallengeCover } from '@/components/challenges/ChallengeCover'
import { ChallengeProgressBar } from '@/components/challenges/ChallengeProgressBar'
import { cn } from '@/lib/utils'

/** One challenge in the /challenges list: cover, status, progress and rewards. */
export function ChallengeCard({ program, view }: { program: ChallengeProgram; view: ChallengeView }) {
  const { template } = program
  const autoDays = program.days.filter((day) => isAutomaticRule(day.completion_type)).length

  return (
    <Link
      href={`/challenges/${template.id}`}
      className={cn(
        'block overflow-hidden rounded-[1.5rem] border bg-card transition-colors hover:bg-muted/40',
        view.status === 'active' && 'border-primary/40'
      )}
    >
      <ChallengeCover src={template.cover_image_url} alt="" className="h-36 w-full" />
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <ChallengeStatusBadge status={view.status} doneToday={view.doneToday} />
          {template.is_personal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
              <Lock className="size-3" />
              Personal
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
            <CalendarDays className="size-3" />
            {template.duration_days} days
          </span>
          {autoDays > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
              <Sparkles className="size-3" />
              {autoDays} auto-detected
            </span>
          )}
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{template.title}</h2>
            {(template.tagline || template.description) && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.tagline || template.description}</p>
            )}
          </div>
          <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </div>
        {view.status === 'active' && view.currentDay && (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">{view.doneToday ? 'Tomorrow' : `Day ${view.currentDayNumber}`}:</span>{' '}
            {view.currentDay.title}
          </p>
        )}
        {view.status !== 'not_started' && (
          <ChallengeProgressBar className="mt-4" completed={view.completedDays} total={view.totalDays} />
        )}
        <div className="mt-4 flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Zap className="size-3.5" />
            {template.xp_reward} XP
          </span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Coins className="size-3.5" />
            {template.coin_reward}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function ChallengeStatusBadge({ status, doneToday }: { status: ChallengeView['status']; doneToday: boolean }) {
  const label =
    status === 'active'
      ? doneToday
        ? 'Done for today'
        : 'In progress'
      : status === 'completed'
        ? 'Completed'
        : status === 'ended'
          ? 'Stopped'
          : 'New'
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
        status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}

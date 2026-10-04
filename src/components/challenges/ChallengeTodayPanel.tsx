'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2, Play, RefreshCw, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import {
  completeChallengeProgramDay,
  restartChallengeProgram,
  startChallengeProgram,
  syncChallengeProgress,
  type ChallengeProgram,
} from '@/lib/challenge-programs'
import { formatRuleProgress, getChallengeRule, resolveDayAction, withChallengeReturn } from '@/lib/challenge-rules'
import type { ChallengeView } from '@/lib/challenges'
import { useUserStore } from '@/lib/stores/user-store'
import { cn } from '@/lib/utils'
import { ChallengeCover, challengeDayIcon } from '@/components/challenges/ChallengeCover'

/**
 * The "what do I do today" block of a challenge, with its actions.
 *
 * Every action ends in router.refresh(): the server page re-runs the sync and
 * re-reads the program, so this component never has to mirror the RPCs'
 * bookkeeping in local state.
 */
export function ChallengeTodayPanel({
  program,
  view,
  compact = false,
}: {
  program: ChallengeProgram
  view: ChallengeView
  /** Dashboard variant: shorter copy, links to the detail page. */
  compact?: boolean
}) {
  const router = useRouter()
  const addXp = useUserStore((s) => s.addXp)
  const setCoins = useUserStore((s) => s.setCoins)
  const [note, setNote] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, startRefresh] = useTransition()
  const { template } = program
  const day = view.currentDay
  const busy = working !== null || refreshing

  async function run(label: string, action: () => Promise<string | null>) {
    setWorking(label)
    setError(null)
    setMessage(null)
    try {
      const nextMessage = await action()
      setMessage(nextMessage)
      startRefresh(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this challenge.')
    } finally {
      setWorking(null)
    }
  }

  const start = () =>
    run('start', async () => {
      await startChallengeProgram(createClient(), template.id)
      if (compact) router.push(`/challenges/${template.id}`)
      return 'Challenge started. Day 1 is waiting for you.'
    })

  const restart = () =>
    run('restart', async () => {
      await restartChallengeProgram(createClient(), template.id)
      return 'Fresh start. Day 1 is waiting for you.'
    })

  const completeManual = () =>
    run('complete', async () => {
      if (!program.enrollment) return null
      const result = await completeChallengeProgramDay(createClient(), program.enrollment.id, note)
      setNote('')
      if (result.challenge_completed) {
        addXp(template.xp_reward, result.total_xp - template.xp_reward)
        setCoins(result.coins)
        return `Challenge complete! +${template.xp_reward} XP, +${template.coin_reward} coins.`
      }
      return `Day ${result.completed_day} done.`
    })

  const checkProgress = () =>
    run('check', async () => {
      const rows = await syncChallengeProgress(createClient())
      const row = rows.find((item) => item.enrollment_id === program.enrollment?.id)
      if (row?.completed_now) {
        return row.challenge_completed
          ? `Challenge complete! +${template.xp_reward} XP, +${template.coin_reward} coins.`
          : `Day ${row.day_number} detected and completed.`
      }
      return row ? `Not yet: ${formatRuleProgress(row.completion_type, row.progress, row.target)}.` : null
    })

  const detailHref = `/challenges/${template.id}`
  const feedback = (
    <>
      {message && <p className="mt-3 text-xs text-primary">{message}</p>}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </>
  )

  if (view.status === 'not_started' || view.status === 'ended') {
    return (
      <div className="rounded-2xl bg-muted/40 p-4">
        <p className="text-sm font-medium">
          {view.status === 'ended' ? 'You stopped this challenge earlier.' : `${template.duration_days} days, one action a day.`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {template.schedule_mode === 'strict'
            ? 'Strict: every calendar day counts, a missed day means starting over.'
            : 'At your pace: a new day unlocks each day once the last one is done. Missed days simply wait.'}
        </p>
        <Button className="mt-4" onClick={view.status === 'ended' ? restart : start} disabled={busy}>
          {working ? <Loader2 className="animate-spin" /> : <Play />}
          {view.status === 'ended' ? 'Start again' : 'Start challenge'}
        </Button>
        {feedback}
      </div>
    )
  }

  if (view.status === 'completed') {
    return (
      <div className="rounded-2xl bg-primary/10 p-4 text-primary">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-background">
            <Trophy className="size-5" />
          </span>
          <div>
            <p className="font-medium">Challenge complete</p>
            <p className="text-xs opacity-80">All {template.duration_days} days done. That was the work, well done.</p>
          </div>
        </div>
        {!compact && (
          <Button variant="outline" size="sm" className="mt-4" onClick={restart} disabled={busy}>
            <RotateCcw />
            Do it again
          </Button>
        )}
        {feedback}
      </div>
    )
  }

  if (view.strictMissed) {
    return (
      <div className="rounded-2xl bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">A calendar day was missed.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This challenge is strict. Restart to begin a new streak; your previous attempt is kept.
        </p>
        <Button className="mt-4" variant="outline" onClick={restart} disabled={busy}>
          <RotateCcw />
          Restart challenge
        </Button>
        {feedback}
      </div>
    )
  }

  if (!day) return null

  if (view.doneToday) {
    return (
      <div className="rounded-2xl bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Check className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {view.justCompleted ? `Day ${view.completedDays} detected and completed.` : `Day ${view.completedDays} is done.`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tomorrow, day {day.day_number}: <span className="font-medium text-foreground">{day.title}</span>
            </p>
          </div>
        </div>
        {compact && <DetailLink href={detailHref} />}
        {feedback}
      </div>
    )
  }

  const action = resolveDayAction(day)
  const rule = getChallengeRule(day.completion_type)

  return (
    <div className="overflow-hidden rounded-2xl bg-muted/40">
      <ChallengeCover
        src={day.image_url}
        alt=""
        icon={challengeDayIcon(day.completion_type)}
        label={`Day ${day.day_number}`}
        className={compact ? 'h-24 w-full' : 'h-36 w-full sm:h-44'}
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background font-mono text-xs">
            {String(day.day_number).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today · Day {day.day_number} of {template.duration_days}
            </p>
            <h3 className="mt-1 font-semibold">{day.title}</h3>
            <p
              className={cn(
                'mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground',
                compact && 'line-clamp-3'
              )}
            >
              {day.instructions}
            </p>
          </div>
        </div>

        {rule.id === 'reflection' && day.reflection_prompt && (
          <blockquote className="mt-4 border-l-2 border-primary pl-3 text-sm font-medium">{day.reflection_prompt}</blockquote>
        )}

        {view.automatic && (
          <div className="mt-4 rounded-xl bg-background p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="size-3.5 text-primary" />
                Detected automatically
              </span>
              <span className="font-mono text-muted-foreground">
                {formatRuleProgress(rule.id, view.ruleProgress, view.ruleTarget)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.round((view.ruleProgress / Math.max(1, view.ruleTarget)) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {!view.automatic && !compact && day.reflection_prompt && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">{day.reflection_prompt}</p>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional reflection note" />
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {action && (
            <Button asChild variant={view.automatic ? 'default' : 'outline'}>
              <Link href={withChallengeReturn(action.href, template.id)}>
                {action.label}
                <ArrowRight />
              </Link>
            </Button>
          )}
          {view.automatic ? (
            <Button variant="outline" onClick={checkProgress} disabled={busy}>
              {working === 'check' || refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Check progress
            </Button>
          ) : (
            <Button onClick={completeManual} disabled={busy}>
              {working === 'complete' ? <Loader2 className="animate-spin" /> : <Check />}
              Mark day as done
            </Button>
          )}
          {compact && <DetailLink href={detailHref} inline />}
        </div>
        {feedback}
      </div>
    </div>
  )
}

function DetailLink({ href, inline = false }: { href: string; inline?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground',
        inline ? 'ml-auto self-center' : 'mt-3'
      )}
    >
      All days <ArrowRight className="size-3" />
    </Link>
  )
}

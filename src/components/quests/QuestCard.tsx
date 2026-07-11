'use client'

import { useState } from 'react'
import { CalendarCheck, Coins, Zap, CheckCircle, Lock, Trophy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DefaultQuestWithStatus, CustomQuest, QuestDifficulty } from '@/lib/quests'

const DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

const DIFFICULTY_CLASSES: Record<QuestDifficulty, string> = {
  easy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  hard: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

interface SystemQuestCardProps {
  quest: DefaultQuestWithStatus
  onClaim: (quest: DefaultQuestWithStatus) => Promise<void>
}

export function SystemQuestCard({ quest, onClaim }: SystemQuestCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClaim() {
    setLoading(true)
    setError(null)
    try {
      await onClaim(quest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim this reward.')
    } finally {
      setLoading(false)
    }
  }

  const claimed = quest.status === 'claimed'
  const claimable = quest.status === 'claimable'
  const locked = quest.status === 'locked'

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all',
        claimable && 'border-primary/40 bg-primary/5',
        claimed && 'border-border/40 opacity-60',
        locked && 'border-border/30 opacity-50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
              claimable && 'bg-primary/10 text-primary',
              claimed && 'bg-muted text-muted-foreground',
              locked && 'bg-muted text-muted-foreground'
            )}
          >
            {claimed ? (
              <CheckCircle className="size-4" />
            ) : locked ? (
              <Lock className="size-4" />
            ) : (
              <Trophy className="size-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{quest.title}</p>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                  DIFFICULTY_CLASSES[quest.difficulty]
                )}
              >
                {DIFFICULTY_LABELS[quest.difficulty]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{quest.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <Zap className="size-3" />
            {quest.xp}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
            <Coins className="size-3" />
            {quest.coins}
          </span>
        </div>
      </div>

      {claimable && (
        <Button size="sm" className="w-full" onClick={handleClaim} disabled={loading}>
          {loading ? 'Claiming...' : 'Claim Reward'}
        </Button>
      )}

      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}

      {claimed && (
        <p className="text-[10px] text-muted-foreground text-center">
          Claimed{quest.completedAt ? ` on ${new Date(quest.completedAt).toLocaleDateString()}` : ''}
        </p>
      )}
    </div>
  )
}

interface CustomQuestCardProps {
  quest: CustomQuest
  onComplete: (quest: CustomQuest) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onCheckIn?: (quest: CustomQuest) => Promise<void>
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function getChallengeProgress(quest: CustomQuest) {
  if (quest.quest_type !== 'daily_challenge' || !quest.challenge_days || !quest.challenge_start_date) {
    return null
  }

  const today = dateKey(new Date())
  const endDate = addDays(quest.challenge_start_date, quest.challenge_days - 1)
  const logDates = new Set(
    (quest.daily_logs ?? [])
      .map((log) => log.log_date)
      .filter((logDate) => logDate >= quest.challenge_start_date! && logDate <= endDate)
  )
  const completedDays = logDates.size

  return {
    today,
    endDate,
    completedDays,
    percent: Math.min(100, Math.round((completedDays / quest.challenge_days) * 100)),
    checkedToday: logDates.has(today),
    insideWindow: today >= quest.challenge_start_date && today <= endDate,
    ready: completedDays >= quest.challenge_days,
  }
}

export function CustomQuestCard({ quest, onComplete, onDelete, onCheckIn }: CustomQuestCardProps) {
  const [loading, setLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const progress = getChallengeProgress(quest)
  const isChallenge = quest.quest_type === 'daily_challenge'

  async function handleComplete() {
    setLoading(true)
    setError(null)
    try {
      await onComplete(quest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete this quest.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckIn() {
    if (!onCheckIn) return
    setCheckingIn(true)
    setError(null)
    try {
      await onCheckIn(quest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check in for this challenge.')
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(quest.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this quest.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all',
        quest.is_completed ? 'border-border/40 opacity-60' : 'border-border/60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {quest.is_completed && <CheckCircle className="size-4 text-green-500 shrink-0" />}
            <p className={cn('font-semibold text-sm', quest.is_completed && 'line-through text-muted-foreground')}>
              {quest.title}
            </p>
            {isChallenge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <CalendarCheck className="size-3" />
                {quest.challenge_days ?? 30} day challenge
              </span>
            )}
          </div>
          {quest.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{quest.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
            <Zap className="size-3" />
            {quest.xp_reward}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
            <Coins className="size-3" />
            {quest.coin_reward}
          </span>
        </div>
      </div>

      {progress && (
        <div className="space-y-3 rounded-lg bg-muted/45 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Daily task</p>
              <p className="mt-0.5 text-sm font-medium">{quest.challenge_task}</p>
            </div>
            <p className="shrink-0 font-mono text-xs text-muted-foreground">
              {progress.completedDays}/{quest.challenge_days}
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {progress.checkedToday
              ? 'Today is checked in.'
              : progress.insideWindow
                ? `Challenge window ends ${new Date(`${progress.endDate}T12:00:00`).toLocaleDateString()}.`
                : `Challenge window: ${new Date(`${quest.challenge_start_date}T12:00:00`).toLocaleDateString()} - ${new Date(`${progress.endDate}T12:00:00`).toLocaleDateString()}.`}
          </p>
        </div>
      )}

      {!quest.is_completed && (
        <div className="flex gap-2">
          {progress ? (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleCheckIn} disabled={checkingIn || progress.checkedToday || !progress.insideWindow || !onCheckIn}>
                {checkingIn ? 'Checking in...' : progress.checkedToday ? 'Done today' : 'Check in today'}
              </Button>
              <Button size="sm" className="flex-1" onClick={handleComplete} disabled={loading || !progress.ready}>
                {loading ? 'Completing...' : 'Complete challenge'}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" onClick={handleComplete} disabled={loading}>
              {loading ? 'Completing...' : 'Mark Complete'}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting} aria-label="Delete quest">
            {deleting ? '...' : <Trash2 className="size-4" />}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}

      {quest.is_completed && quest.completed_at && (
        <p className="text-[10px] text-muted-foreground text-center">
          Completed on {new Date(quest.completed_at).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

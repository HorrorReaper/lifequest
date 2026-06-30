'use client'

import { useState } from 'react'
import { Coins, Zap, CheckCircle, Lock, Trophy } from 'lucide-react'
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
}

export function CustomQuestCard({ quest, onComplete, onDelete }: CustomQuestCardProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      {!quest.is_completed && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleComplete} disabled={loading}>
            {loading ? 'Completing...' : 'Mark Complete'}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? '...' : 'Delete'}
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

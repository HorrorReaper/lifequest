'use client'

import { useState } from 'react'
import { Coins, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatTaskDate } from '@/lib/task-manager'
import {
  betPayout,
  clampStake,
  MAX_BET_STAKE,
  MIN_BET_STAKE,
} from '@/lib/task-bets'
import type { ManagedTask } from '@/lib/tasks'
import { cn } from '@/lib/utils'

const QUICK_STAKES = [5, 10, 20]

interface TaskBetDialogProps {
  /** The task to bet on; null keeps the dialog closed. */
  task: ManagedTask | null
  /** The user's coin balance. */
  balance: number
  todayKey: string
  placing: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (stake: number) => void
}

/**
 * Stakes coins that a task gets done by its due date
 * (docs/features/planning-tasks-habits.md#task-bets). Opened from a task's
 * "Bet" action; the bet itself is placed by the caller.
 */
export function TaskBetDialog(props: TaskBetDialogProps) {
  const { task, placing, onCancel } = props
  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && !placing && onCancel()}>
      <DialogContent className="max-w-md">
        {/* Mounted per opening, so each bet starts from the default stake. */}
        {task && <BetForm key={task.id} {...props} task={task} />}
      </DialogContent>
    </Dialog>
  )
}

function BetForm({
  task,
  balance,
  todayKey,
  placing,
  error,
  onCancel,
  onConfirm,
}: TaskBetDialogProps & { task: ManagedTask }) {
  const [stake, setStake] = useState(() => clampStake(Math.min(10, Math.max(balance, MIN_BET_STAKE))))
  const affordable = stake <= balance
  const due = task.due_date === todayKey ? 'the end of today' : `the end of ${formatTaskDate(task.due_date!)}`

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (affordable && !placing) onConfirm(stake)
      }}
    >
      <DialogHeader>
        <span className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Coins className="size-5" aria-hidden="true" />
        </span>
        <DialogTitle>Bet on this task</DialogTitle>
        <DialogDescription>
          Finish <span className="font-medium text-foreground">{task.title}</span> by {due} and win
          twice your stake.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Your stake</legend>
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 sm:size-11"
            aria-label="One coin less"
            onClick={() => setStake((current) => clampStake(current - 1))}
            disabled={stake <= MIN_BET_STAKE || placing}
          >
            <Minus className="size-4" />
          </Button>
          <output
            aria-live="polite"
            aria-label="Stake"
            className="flex flex-1 items-center justify-center gap-2 text-3xl font-bold tabular-nums"
          >
            <Coins className="size-6 text-amber-600 dark:text-amber-300" aria-hidden="true" />
            {stake}
          </output>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 sm:size-11"
            aria-label="One coin more"
            onClick={() => setStake((current) => clampStake(current + 1))}
            disabled={stake >= MAX_BET_STAKE || placing}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_STAKES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={stake === value}
              onClick={() => setStake(value)}
              disabled={placing}
              className={cn(
                'min-h-11 rounded-xl border text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                stake === value ? 'border-primary bg-primary/10 text-primary' : 'hover:border-primary/40'
              )}
            >
              {value} coins
            </button>
          ))}
        </div>
      </fieldset>

      <dl className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/30 p-4 text-sm">
        <div>
          <dt className="text-muted-foreground">If done in time</dt>
          <dd className="mt-0.5 text-base font-semibold text-emerald-700 dark:text-emerald-300">
            +{betPayout(stake)} coins
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Your coins</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums">{balance}</dd>
        </div>
        <p className="col-span-2 text-muted-foreground">
          If it is not done by then, or the task is deleted, the stake is gone. The due date is
          locked while the bet runs.
        </p>
      </dl>

      {(error || !affordable) && (
        <p role="alert" className="text-sm text-destructive">
          {error ?? 'Not enough coins for this bet.'}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={placing}>
          Not now
        </Button>
        <Button type="submit" disabled={!affordable || placing}>
          {placing ? 'Placing…' : `Bet ${stake} ${stake === 1 ? 'coin' : 'coins'}`}
        </Button>
      </DialogFooter>
    </form>
  )
}

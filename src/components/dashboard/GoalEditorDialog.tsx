'use client'

import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { GOAL_CATEGORIES } from '@/lib/goals'
import type { GoalCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface GoalEditorValue {
  title: string
  why: string
  category: GoalCategory
  /** YYYY-MM-DD, or empty for no target date. */
  targetDate: string
}

interface GoalEditorDialogProps {
  open: boolean
  busy?: boolean
  error?: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (value: GoalEditorValue) => void | Promise<void>
}

/**
 * Creating a goal, in a dialog rather than a form that unfolds inside the
 * goals section. Same sheet-on-mobile, centred-on-desktop shape as
 * HabitEditorDialog.
 */
export function GoalEditorDialog({ open, busy = false, error, onOpenChange, onSubmit }: GoalEditorDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="bottom-0 left-0 top-auto max-h-[calc(100svh-var(--safe-area-bottom))] max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-b-none rounded-t-3xl p-5 pb-[calc(1.25rem+var(--safe-area-bottom))] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90svh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">Add a goal</DialogTitle>
          <DialogDescription>
            One meaningful direction, so your quests and habits have a reason behind them.
          </DialogDescription>
        </DialogHeader>

        {/* Mounted only while open, so every opening starts from an empty form. */}
        {open && (
          <GoalEditorForm busy={busy} error={error} onCancel={() => onOpenChange(false)} onSubmit={onSubmit} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function GoalEditorForm({
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  error?: string | null
  onCancel: () => void
  onSubmit: (value: GoalEditorValue) => void | Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [category, setCategory] = useState<GoalCategory>('personal')
  const [targetDate, setTargetDate] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || busy) return
    void onSubmit({ title: title.trim(), why, category, targetDate })
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="space-y-2">
        <Label htmlFor="goal-title">Goal</Label>
        <Input
          id="goal-title"
          placeholder="What goal should motivate you?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
          maxLength={120}
          autoFocus
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal-why">Why it matters (optional)</Label>
        <Input
          id="goal-why"
          placeholder="Why does this matter?"
          value={why}
          onChange={(event) => setWhy(event.target.value)}
          disabled={busy}
          maxLength={500}
          className="h-11"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="goal-category">Category</Label>
          <select
            id="goal-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as GoalCategory)}
            disabled={busy}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {Object.entries(GOAL_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal-target-date">Target date (optional)</Label>
          <Input
            id="goal-target-date"
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            disabled={busy}
            className="h-11"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter className="sticky bottom-0 mt-auto bg-popover">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !title.trim()}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? 'Saving…' : 'Add goal'}
        </Button>
      </DialogFooter>
    </form>
  )
}

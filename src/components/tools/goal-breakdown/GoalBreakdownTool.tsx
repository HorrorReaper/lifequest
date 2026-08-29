'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import {
  createToolEntry,
  deleteToolEntry,
  fetchToolEntries,
  updateToolEntry,
  type ToolEntry,
} from '@/lib/tools/storage'
import type { ToolProps } from '@/lib/tools/registry'
import { GoalCard } from './GoalCard'
import {
  createGoal,
  GOAL_BREAKDOWN_TOOL_ID,
  toggleAction,
  toGoalBreakdowns,
  type GoalBreakdownPayload,
} from './goal-breakdown'

export function GoalBreakdownTool({ userId, initialEntries, onUsed }: ToolProps) {
  const supabase = useMemo(() => createClient(), [])
  const [goals, setGoals] = useState(() => toGoalBreakdowns(initialEntries))
  // Local edits, keyed by row id. Presence here means the goal is unsaved;
  // saving removes the entry rather than tracking a separate dirty flag.
  const [drafts, setDrafts] = useState<Record<string, GoalBreakdownPayload>>({})
  const [title, setTitle] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function workingCopy(entry: ToolEntry<GoalBreakdownPayload>) {
    return drafts[entry.id] ?? entry.payload
  }

  async function refresh() {
    const entries = await fetchToolEntries(supabase, userId, GOAL_BREAKDOWN_TOOL_ID)
    setGoals(toGoalBreakdowns(entries))
  }

  async function addGoal() {
    const trimmed = title.trim()
    if (!trimmed || creating) return

    setCreating(true)
    setError(null)

    try {
      await createToolEntry<GoalBreakdownPayload>(
        supabase,
        userId,
        GOAL_BREAKDOWN_TOOL_ID,
        createGoal(trimmed, '')
      )
      await refresh()
      setTitle('')
      onUsed?.()
    } catch {
      setError('That goal could not be saved. Please try again.')
    }

    setCreating(false)
  }

  /** Persists a working copy and clears its unsaved state on success. */
  async function persist(entryId: string, payload: GoalBreakdownPayload) {
    setBusyId(entryId)
    setError(null)

    try {
      await updateToolEntry<GoalBreakdownPayload>(supabase, entryId, payload)
      setGoals((current) =>
        current.map((entry) => (entry.id === entryId ? { ...entry, payload } : entry))
      )
      setDrafts((current) => {
        const next = { ...current }
        delete next[entryId]
        return next
      })
      onUsed?.()
    } catch {
      // The draft is deliberately kept: a dropped connection must not throw
      // away a breakdown the user just wrote.
      setError('That goal could not be saved. Your changes are still here — try again.')
    }

    setBusyId(null)
  }

  async function removeGoal(entryId: string) {
    setBusyId(entryId)
    setError(null)

    try {
      await deleteToolEntry(supabase, entryId)
      await refresh()
    } catch {
      setError('That goal could not be deleted. Please try again.')
    }

    setBusyId(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Input
          aria-label="New goal"
          placeholder="Name a goal that matters…"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void addGoal()
            }
          }}
          className="min-w-0 flex-1"
        />
        <Button type="button" onClick={() => void addGoal()} disabled={!title.trim() || creating}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add goal
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-5 py-9 text-center">
          <Target className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No goals yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with where you want to end up. The breakdown comes after.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((entry) => (
            <GoalCard
              key={entry.id}
              goal={workingCopy(entry)}
              dirty={Boolean(drafts[entry.id])}
              saving={busyId === entry.id}
              onEdit={(next) => setDrafts((current) => ({ ...current, [entry.id]: next }))}
              onToggleAction={(subGoalId, actionId) => {
                // Ticking writes the whole working copy, pending text edits
                // included: saving only the tick would leave the stored row
                // disagreeing with what is on screen.
                void persist(entry.id, toggleAction(workingCopy(entry), subGoalId, actionId))
              }}
              onSave={() => void persist(entry.id, workingCopy(entry))}
              onDelete={() => void removeGoal(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

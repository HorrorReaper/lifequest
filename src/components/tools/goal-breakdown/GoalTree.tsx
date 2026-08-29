'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  addAction,
  addSubGoal,
  removeAction,
  removeSubGoal,
  subGoalProgress,
  updateAction,
  updateSubGoal,
  type GoalBreakdownPayload,
} from './goal-breakdown'

export interface GoalTreeProps {
  goal: GoalBreakdownPayload
  /** Structural and text changes; the parent treats these as unsaved. */
  onEdit: (goal: GoalBreakdownPayload) => void
  /** Kept separate from onEdit because ticking an action saves immediately. */
  onToggle: (subGoalId: string, actionId: string) => void
}

export function GoalTree({ goal, onEdit, onToggle }: GoalTreeProps) {
  const [subGoalDraft, setSubGoalDraft] = useState('')
  const [actionDrafts, setActionDrafts] = useState<Record<string, string>>({})

  function submitSubGoal() {
    const title = subGoalDraft.trim()
    if (!title) return
    onEdit(addSubGoal(goal, title))
    setSubGoalDraft('')
  }

  function submitAction(subGoalId: string) {
    const title = (actionDrafts[subGoalId] ?? '').trim()
    if (!title) return
    onEdit(addAction(goal, subGoalId, title))
    setActionDrafts((drafts) => ({ ...drafts, [subGoalId]: '' }))
  }

  return (
    <div className="space-y-4">
      {goal.subGoals.length === 0 && (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          What has to be true for this goal to happen? Name the first milestone below.
        </p>
      )}

      {goal.subGoals.map((subGoal) => {
        const progress = subGoalProgress(subGoal)

        return (
          <section key={subGoal.id} className="rounded-xl border bg-background p-3">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Sub-goal ${subGoal.title}`}
                value={subGoal.title}
                onChange={(event) =>
                  onEdit(updateSubGoal(goal, subGoal.id, { title: event.target.value }))
                }
                className="h-9 min-w-0 flex-1 font-medium"
              />
              <span
                data-testid="subgoal-progress"
                className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
              >
                {progress.done}/{progress.total}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove sub-goal ${subGoal.title}`}
                onClick={() => onEdit(removeSubGoal(goal, subGoal.id))}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor={`date-${subGoal.id}`}>
                By
              </label>
              <input
                id={`date-${subGoal.id}`}
                type="date"
                value={subGoal.targetDate ?? ''}
                onChange={(event) =>
                  onEdit(updateSubGoal(goal, subGoal.id, { targetDate: event.target.value || null }))
                }
                className="rounded-lg border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <ul className="mt-3 space-y-1.5">
              {subGoal.actions.map((action) => (
                <li key={action.id} className="flex items-center gap-2">
                  <Checkbox
                    aria-label={action.title}
                    checked={action.done}
                    onCheckedChange={() => onToggle(subGoal.id, action.id)}
                  />
                  <Input
                    aria-label={`Action ${action.title}`}
                    value={action.title}
                    onChange={(event) =>
                      onEdit(
                        updateAction(goal, subGoal.id, action.id, { title: event.target.value })
                      )
                    }
                    className="h-8 min-w-0 flex-1 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove action ${action.title}`}
                    onClick={() => onEdit(removeAction(goal, subGoal.id, action.id))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-center gap-2">
              <Input
                aria-label={`New action under ${subGoal.title}`}
                placeholder="Next concrete action…"
                value={actionDrafts[subGoal.id] ?? ''}
                onChange={(event) =>
                  setActionDrafts((drafts) => ({ ...drafts, [subGoal.id]: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    submitAction(subGoal.id)
                  }
                }}
                className="h-8 min-w-0 flex-1 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Add action under ${subGoal.title}`}
                onClick={() => submitAction(subGoal.id)}
                disabled={!(actionDrafts[subGoal.id] ?? '').trim()}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </section>
        )
      })}

      <div className="flex items-center gap-2">
        <Input
          aria-label="New sub-goal"
          placeholder="Add a sub-goal…"
          value={subGoalDraft}
          onChange={(event) => setSubGoalDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submitSubGoal()
            }
          }}
          className="h-9 min-w-0 flex-1"
        />
        <Button type="button" onClick={submitSubGoal} disabled={!subGoalDraft.trim()}>
          <Plus className="size-4" />
          Add sub-goal
        </Button>
      </div>
    </div>
  )
}

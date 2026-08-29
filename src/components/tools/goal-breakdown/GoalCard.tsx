'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GoalTree } from './GoalTree'
import { goalProgress, type GoalBreakdownPayload } from './goal-breakdown'

export interface GoalCardProps {
  goal: GoalBreakdownPayload
  dirty: boolean
  saving: boolean
  defaultExpanded?: boolean
  onEdit: (goal: GoalBreakdownPayload) => void
  onToggleAction: (subGoalId: string, actionId: string) => void
  onSave: () => void
  onDelete: () => void
}

export function GoalCard({
  goal,
  dirty,
  saving,
  defaultExpanded = false,
  onEdit,
  onToggleAction,
  onSave,
  onDelete,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const progress = goalProgress(goal)

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Open'} ${goal.title}`}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            aria-label={`Goal ${goal.title}`}
            value={goal.title}
            onChange={(event) => onEdit({ ...goal, title: event.target.value })}
            className="h-10 text-base font-semibold"
          />
          <div
            data-testid="goal-progress"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            {progress.total === 0 ? (
              <span>Not started — no actions yet</span>
            ) : (
              <>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${progress.share * 100}%` }}
                  />
                </span>
                <span className="font-mono tabular-nums">
                  {progress.done}/{progress.total} actions done
                </span>
              </>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Delete ${goal.title}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor={`why-${goal.title}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Why this matters
            </label>
            <Textarea
              id={`why-${goal.title}`}
              aria-label={`Why ${goal.title} matters`}
              value={goal.why}
              onChange={(event) => onEdit({ ...goal, why: event.target.value })}
              placeholder="The reason you will still care about this in a year…"
              className="min-h-16 text-sm"
            />
          </div>

          <GoalTree goal={goal} onEdit={onEdit} onToggle={onToggleAction} />

          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className={cn('text-xs', dirty ? 'text-amber-600' : 'text-muted-foreground')}>
              {dirty ? 'Unsaved changes' : 'Everything saved'}
            </span>
            <Button type="button" onClick={onSave} disabled={!dirty || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save goal
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, CheckCircle2, Loader2, Plus, Sparkles, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createGoal, GOAL_CATEGORIES, updateGoalStatus } from '@/lib/goals'
import { createCustomQuest } from '@/lib/quests'
import type { Goal, GoalCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { GoalEditorDialog, type GoalEditorValue } from '@/components/dashboard/GoalEditorDialog'
import { SectionAddButton } from '@/components/dashboard/SectionAddButton'
import { cn } from '@/lib/utils'

interface GoalsDashboardWidgetProps {
  userId: string
  initialGoals: Goal[]
  initiallyOpen?: boolean
  /**
   * Whether to offer AI quest suggestions. The route behind it calls a paid
   * model and answers non-admins with a 403, so the button is only shown to
   * the people it works for.
   */
  canSuggestQuests?: boolean
}

interface QuestSuggestion {
  title: string
  description: string
  xp_reward: number
  coin_reward: number
}

const categoryStyles: Record<GoalCategory, string> = {
  personal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  health: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  career: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  relationships: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  learning: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  finance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

function formatTargetDate(date: string | null) {
  if (!date) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export function GoalsDashboardWidget({
  userId,
  initialGoals,
  initiallyOpen = false,
  canSuggestQuests = false,
}: GoalsDashboardWidgetProps) {
  const supabase = createClient()
  const router = useRouter()

  const [goals, setGoals] = useState(initialGoals)
  // initiallyOpen comes from GOAL_FORM_HREF (e.g. a challenge's goals day).
  const [dialogOpen, setDialogOpen] = useState(initiallyOpen)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [generatingGoalId, setGeneratingGoalId] = useState<string | null>(null)
  const [addingSuggestionKey, setAddingSuggestionKey] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, QuestSuggestion[]>>({})
  const [error, setError] = useState<string | null>(null)

  function openDialog() {
    setCreateError(null)
    setDialogOpen(true)
  }

  async function handleCreate(value: GoalEditorValue) {
    setCreating(true)
    setCreateError(null)

    try {
      const goal = await createGoal(supabase, userId, {
        title: value.title,
        why: value.why,
        category: value.category,
        target_date: value.targetDate || null,
      })
      setGoals((current) => [goal, ...current])
      setDialogOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to create goal:', err)
      setCreateError('Could not create this goal. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleStatus(goal: Goal, status: 'completed' | 'archived') {
    setUpdatingId(goal.id)
    setError(null)

    setGoals((current) => current.filter((item) => item.id !== goal.id))

    try {
      await updateGoalStatus(supabase, goal.id, status)
      router.refresh()
    } catch (err) {
      console.error('Failed to update goal:', err)
      setGoals((current) => [goal, ...current])
      setError('Could not update this goal. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleGenerateQuests(goal: Goal) {
    setGeneratingGoalId(goal.id)
    setError(null)

    try {
      const response = await fetch(`/api/goals/${goal.id}/quest-suggestions`, {
        method: 'POST',
      })
      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not generate quests.')
      }

      setSuggestions((current) => ({
        ...current,
        [goal.id]: body.quests ?? [],
      }))
    } catch (err) {
      console.error('Failed to generate quests:', err)
      setError(err instanceof Error ? err.message : 'Could not generate quests. Please try again.')
    } finally {
      setGeneratingGoalId(null)
    }
  }

  async function handleAddQuest(goalId: string, suggestion: QuestSuggestion, index: number) {
    const key = `${goalId}-${index}`
    setAddingSuggestionKey(key)
    setError(null)

    try {
      await createCustomQuest(supabase, userId, {
        title: suggestion.title,
        description: suggestion.description,
        xp_reward: suggestion.xp_reward,
        coin_reward: suggestion.coin_reward,
      })
      setSuggestions((current) => ({
        ...current,
        [goalId]: (current[goalId] ?? []).filter((_, itemIndex) => itemIndex !== index),
      }))
      router.refresh()
    } catch (err) {
      console.error('Failed to add quest:', err)
      setError('Could not add this quest. Please try again.')
    } finally {
      setAddingSuggestionKey(null)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Your Goals</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Empty, the "Add Goal" button below is the way in. */}
          {goals.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">
                {goals.length} active
              </span>
              <SectionAddButton label="Add goal" onClick={openDialog} />
            </>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm font-medium">No active goals yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add one meaningful direction so your quests and habits have a reason behind them.
          </p>
          <Button className="mt-3" size="sm" variant="outline" onClick={openDialog}>
            <Plus className="mr-1.5 size-4" />
            Add Goal
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {goals.map((goal) => {
            const target = formatTargetDate(goal.target_date)
            const busy = updatingId === goal.id
            const generated = suggestions[goal.id] ?? []
            const generating = generatingGoalId === goal.id

            return (
              <li key={goal.id} className="rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Target className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{goal.title}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', categoryStyles[goal.category])}>
                        {GOAL_CATEGORIES[goal.category]}
                      </span>
                      {target && (
                        <span className="text-[10px] text-muted-foreground">
                          Target {target}
                        </span>
                      )}
                    </div>
                    {goal.why && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {goal.why}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 sm:pl-11">
                  {canSuggestQuests && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateQuests(goal)}
                      disabled={generating || busy}
                      className="h-10 text-xs sm:h-7"
                    >
                      {generating ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 size-3.5" />
                      )}
                      {generated.length > 0 ? 'Regenerate quests' : 'Generate quests'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatus(goal, 'completed')}
                    disabled={busy}
                    className="h-10 text-xs sm:h-7"
                  >
                    <CheckCircle2 className="mr-1 size-3.5" />
                    Complete
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStatus(goal, 'archived')}
                    disabled={busy}
                    className="h-10 text-xs sm:h-7"
                  >
                    <Archive className="mr-1 size-3.5" />
                    Archive
                  </Button>
                </div>
                {generated.length > 0 && (
                  <div className="mt-3 space-y-2 sm:pl-11">
                    <p className="text-xs font-medium text-muted-foreground">
                      Suggested quests
                    </p>
                    {generated.map((suggestion, index) => {
                      const key = `${goal.id}-${index}`
                      const adding = addingSuggestionKey === key

                      return (
                        <div key={key} className="rounded-lg border bg-muted/30 p-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{suggestion.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {suggestion.description}
                              </p>
                              <p className="mt-2 text-[10px] font-medium text-primary">
                                +{suggestion.xp_reward} XP - {suggestion.coin_reward} coins
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAddQuest(goal.id, suggestion, index)}
                              disabled={adding}
                              className="h-10 shrink-0 text-xs sm:h-7"
                            >
                              {adding ? 'Adding...' : 'Add'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <GoalEditorDialog
        open={dialogOpen}
        busy={creating}
        error={createError}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />
    </div>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, CheckCircle2, Loader2, Minus, Plus, Sparkles, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createGoal, GOAL_CATEGORIES, updateGoalStatus } from '@/lib/goals'
import { createCustomQuest } from '@/lib/quests'
import type { Goal, GoalCategory } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface GoalsDashboardWidgetProps {
  userId: string
  initialGoals: Goal[]
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

export function GoalsDashboardWidget({ userId, initialGoals }: GoalsDashboardWidgetProps) {
  const supabase = createClient()
  const router = useRouter()

  const [goals, setGoals] = useState(initialGoals)
  const [showAddForm, setShowAddForm] = useState(false)
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [category, setCategory] = useState<GoalCategory>('personal')
  const [targetDate, setTargetDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [generatingGoalId, setGeneratingGoalId] = useState<string | null>(null)
  const [addingSuggestionKey, setAddingSuggestionKey] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Record<string, QuestSuggestion[]>>({})
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    setCreating(true)
    setError(null)

    try {
      const goal = await createGoal(supabase, userId, {
        title: trimmedTitle,
        why,
        category,
        target_date: targetDate || null,
      })
      setGoals((current) => [goal, ...current])
      setTitle('')
      setWhy('')
      setCategory('personal')
      setTargetDate('')
      setShowAddForm(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to create goal:', err)
      setError('Could not create this goal. Please try again.')
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
          {goals.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {goals.length} active
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant={showAddForm ? 'outline' : 'default'}
            onClick={() => setShowAddForm((open) => !open)}
          >
            {showAddForm ? (
              <Minus className="mr-1 size-4" />
            ) : (
              <Plus className="mr-1 size-4" />
            )}
            {showAddForm ? 'Close' : 'Add'}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Input
            placeholder="What goal should motivate you?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={creating}
            maxLength={120}
            autoFocus
          />
          <Input
            placeholder="Why does this matter?"
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            disabled={creating}
            maxLength={500}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as GoalCategory)}
              disabled={creating}
              className="flex h-8 rounded-lg border border-input bg-background px-2 text-xs"
              aria-label="Goal category"
            >
              {Object.entries(GOAL_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              disabled={creating}
              className="h-8 text-xs"
              aria-label="Target date"
            />
            <Button
              type="submit"
              size="sm"
              disabled={creating || !title.trim()}
              className="col-span-2 h-8 sm:col-span-1"
            >
              {creating ? 'Adding...' : 'Save'}
            </Button>
          </div>
        </form>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm font-medium">No active goals yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add one meaningful direction so your quests and habits have a reason behind them.
          </p>
          {!showAddForm && (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-1.5 size-4" />
              Add Goal
            </Button>
          )}
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
                <div className="mt-3 flex flex-wrap gap-2 pl-11">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => handleGenerateQuests(goal)}
                    disabled={generating || busy}
                    className="h-7 text-xs"
                  >
                    {generating ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 size-3.5" />
                    )}
                    {generated.length > 0 ? 'Regenerate quests' : 'Generate quests'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatus(goal, 'completed')}
                    disabled={busy}
                    className="h-7 text-xs"
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
                    className="h-7 text-xs"
                  >
                    <Archive className="mr-1 size-3.5" />
                    Archive
                  </Button>
                </div>
                {generated.length > 0 && (
                  <div className="mt-3 space-y-2 pl-11">
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
                              className="h-7 shrink-0 text-xs"
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
    </div>
  )
}

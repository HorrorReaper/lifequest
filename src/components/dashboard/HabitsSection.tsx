'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Flame, Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createHabit, setHabitLogCompletion } from '@/lib/habits'
import { applyHabitCheckInReward } from '@/lib/habit-check-in'
import { useUserStore } from '@/lib/stores/user-store'
import type { DashboardHabit } from '@/lib/dashboard-habits'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  HabitEditorDialog,
  type HabitEditorValue,
} from '@/components/habits/HabitEditorDialog'

interface HabitsSectionProps {
  userId: string
  today: string
  habits: DashboardHabit[]
}

const HABITS_PREVIEW_COUNT = 5

/**
 * Every habit, checkable in place.
 *
 * Fed entirely by server props and holding only optimistic state, so the home
 * screen never shows a loading spinner where the day's habits should be.
 */
export function HabitsSection({ userId, today, habits }: HabitsSectionProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)
  const setCoins = useUserStore((state) => state.setCoins)

  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(habits.filter((habit) => habit.completed).map((habit) => habit.id))
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function handleCreate(value: HabitEditorValue) {
    setEditorSaving(true)
    setEditorError(null)
    try {
      await createHabit(supabase, userId, { ...value, sortOrder: habits.length })
      setEditorOpen(false)
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (createError) {
      // createHabit rejects an active duplicate name itself, and
      // DuplicateHabitError already carries a readable message -- so this
      // needs no name check of its own.
      setEditorError(
        createError instanceof Error && createError.message
          ? createError.message
          : 'Could not create the habit.'
      )
    } finally {
      setEditorSaving(false)
    }
  }

  const doneCount = habits.filter((habit) => completedIds.has(habit.id)).length

  async function toggleHabit(habit: DashboardHabit) {
    if (busyId) return

    const wasCompleted = completedIds.has(habit.id)
    const completed = !wasCompleted

    setBusyId(habit.id)
    setError(null)
    setCompletedIds((current) => {
      const next = new Set(current)
      if (completed) next.add(habit.id)
      else next.delete(habit.id)
      return next
    })

    try {
      await setHabitLogCompletion(supabase, {
        userId,
        habitId: habit.id,
        date: today,
        completed,
      })

      try {
        const outcome = await applyHabitCheckInReward(supabase, {
          habitId: habit.id,
          date: today,
          completed,
          wasCompleted,
          streak: habit.streakThroughYesterday + 1,
          skillCategory: habit.skillCategory,
        })
        if (outcome) {
          addXp(outcome.xpDelta, outcome.totalXp - outcome.xpDelta)
          setCoins(outcome.coins)
        }
      } catch (rewardError) {
        // The check-in itself is saved; only the reward failed. Matches how
        // /habits treats this -- do not roll the row back over it.
        console.error('Failed to apply habit check-in reward', rewardError)
      }

      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (saveError) {
      setCompletedIds((current) => {
        const next = new Set(current)
        if (wasCompleted) next.add(habit.id)
        else next.delete(habit.id)
        return next
      })
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : `Could not update ${habit.name}.`
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Flame className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">Habits</h2>
        </div>
        {habits.length > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground sm:text-xs">
            {doneCount} of {habits.length} today
          </span>
        )}
      </div>

      {habits.length === 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-base leading-relaxed text-muted-foreground sm:text-sm">
            No habits yet. Add one to start a daily chain.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
            <Plus />
            Add habit
          </Button>
        </div>
      ) : (
        <>
          {/* One dot per habit rather than a percentage: it carries the same
              completion signal and also says how many habits there are. */}
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
            {habits.map((habit) => (
              <span
                key={habit.id}
                className={cn(
                  'h-1.5 w-6 rounded-full transition-colors',
                  completedIds.has(habit.id) ? 'bg-orange-500' : 'bg-muted'
                )}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-2">
            {(expanded ? habits : habits.slice(0, HABITS_PREVIEW_COUNT)).map((habit) => {
              const checked = completedIds.has(habit.id)
              const busy = busyId === habit.id

              return (
                <li key={habit.id}>
                  {/* Mobile-first: the larger sizes are the base and desktop
                      steps back down, since thumbs need the room more than a
                      cursor does. */}
                  <button
                    type="button"
                    onClick={() => void toggleHabit(habit)}
                    disabled={busy}
                    aria-pressed={checked}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors disabled:opacity-60 sm:min-h-12',
                      checked
                        ? 'border-orange-500/40 bg-orange-500/5'
                        : 'border-border bg-background hover:border-foreground/25 hover:bg-muted/50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors sm:size-6',
                        checked
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-border'
                      )}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin sm:size-3.5" />
                      ) : (
                        checked && <Check className="size-4 sm:size-3.5" />
                      )}
                    </span>
                    <span aria-hidden="true" className="text-xl sm:text-base">
                      {habit.emoji}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-lg sm:text-base',
                        checked && 'text-muted-foreground line-through'
                      )}
                    >
                      {habit.name}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {habits.length > HABITS_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              {expanded ? 'Show less' : `Show ${habits.length - HABITS_PREVIEW_COUNT} more`}
              <ChevronDown
                className={cn('size-4 transition-transform sm:size-3.5', expanded && 'rotate-180')}
              />
            </button>
          )}

          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
              <Plus />
              Add habit
            </Button>
            <Link
              href="/habits"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              Manage habits →
            </Link>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive sm:text-xs">{error}</p>}

      <HabitEditorDialog
        key={editorOpen ? 'open' : 'closed'}
        open={editorOpen}
        busy={editorSaving}
        error={editorError}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditorError(null)
        }}
        onSubmit={handleCreate}
      />
    </section>
  )
}

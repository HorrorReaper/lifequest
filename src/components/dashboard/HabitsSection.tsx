'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Flame, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { setHabitLogCompletion } from '@/lib/habits'
import { applyHabitCheckInReward } from '@/lib/habit-check-in'
import { useUserStore } from '@/lib/stores/user-store'
import type { DashboardHabit } from '@/lib/dashboard-habits'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface HabitsSectionProps {
  userId: string
  today: string
  habits: DashboardHabit[]
}

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
          <Flame className="size-4 text-orange-500" />
          <h2 className="text-sm font-semibold">Habits</h2>
        </div>
        {habits.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {doneCount} of {habits.length} today
          </span>
        )}
      </div>

      {habits.length === 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            No habits yet. Add one to start a daily chain.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/habits">Add a habit</Link>
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
            {habits.map((habit) => {
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
                        'min-w-0 flex-1 truncate text-base sm:text-sm',
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

          <div className="mt-4 flex justify-end border-t pt-3">
            <Link
              href="/habits"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Manage habits →
            </Link>
          </div>
        </>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </section>
  )
}

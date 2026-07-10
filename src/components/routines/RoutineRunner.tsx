'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, CheckCircle2, Loader2, SkipForward } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { completeRoutineHabitStep } from '@/lib/routines'
import type { RoutineWithItems } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RoutineRunnerProps {
  userId: string
  routine: RoutineWithItems
  todayDate: string
  initialCompletedHabitIds: string[]
}

const COACHING_LINES = [
  'Start tiny. The win is beginning the chain.',
  'Let this step become the cue for the next one.',
  'Move slowly enough that it feels repeatable tomorrow.',
  'Keep the promise small and clean.',
  'One calm action. Then the next.',
]

export function RoutineRunner({
  userId,
  routine,
  todayDate,
  initialCompletedHabitIds,
}: RoutineRunnerProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [completedIds, setCompletedIds] = useState(() => new Set(initialCompletedHabitIds))
  const [skippedIds, setSkippedIds] = useState(() => new Set<string>())
  const [savingHabitId, setSavingHabitId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentIndex = routine.items.findIndex(
    (item) => !completedIds.has(item.habit_id) && !skippedIds.has(item.habit_id)
  )
  const currentItem = currentIndex >= 0 ? routine.items[currentIndex] : null
  const completedCount = routine.items.filter((item) => completedIds.has(item.habit_id)).length
  const progressedCount = routine.items.filter(
    (item) => completedIds.has(item.habit_id) || skippedIds.has(item.habit_id)
  ).length
  const done = progressedCount >= routine.items.length
  const percent = routine.items.length > 0 ? Math.round((progressedCount / routine.items.length) * 100) : 100

  async function handleComplete() {
    if (!currentItem || savingHabitId) return

    setSavingHabitId(currentItem.habit_id)
    setError(null)
    setCompletedIds((current) => new Set(current).add(currentItem.habit_id))

    try {
      await completeRoutineHabitStep(supabase, userId, currentItem.habit_id, todayDate)
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (err) {
      console.error('Failed to complete routine step:', err)
      setCompletedIds((current) => {
        const next = new Set(current)
        next.delete(currentItem.habit_id)
        return next
      })
      setError('Could not save this step. Try again.')
    } finally {
      setSavingHabitId(null)
    }
  }

  function handleSkip() {
    if (!currentItem) return
    setSkippedIds((current) => new Set(current).add(currentItem.habit_id))
  }

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent" />

      <header className="relative z-10 flex items-center justify-between gap-3 p-4 sm:p-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Exit
          </Link>
        </Button>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Guided routine
          </p>
          <p className="text-sm font-semibold">
            {completedCount}/{routine.items.length} completed
          </p>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-6 sm:px-6">
        <div className="mb-8 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>

        <div className="flex flex-1 items-center justify-center">
          {done ? (
            <div className="w-full max-w-xl rounded-[2rem] border bg-card p-8 text-center shadow-sm sm:p-10">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-8" />
              </div>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Routine finished
              </p>
              <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
                {routine.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {completedCount === routine.items.length
                  ? 'Every step is complete. This is how identity gets built: one repeatable chain at a time.'
                  : 'You moved through the routine. Skipped steps stay open for another pass later today.'}
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Button asChild variant="outline" className="h-10">
                  <Link href="/settings">Edit routines</Link>
                </Button>
                <Button asChild className="h-10">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            </div>
          ) : currentItem ? (
            <div className="w-full max-w-xl rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Step {currentIndex + 1} of {routine.items.length}
                  </p>
                  <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                    {routine.name}
                  </h1>
                </div>
                <span className="text-4xl">{routine.emoji}</span>
              </div>

              <div className="mt-8 rounded-[1.5rem] border bg-background/80 p-5 text-center">
                <span className="text-6xl">{currentItem.habit.emoji}</span>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                  {currentItem.habit.name}
                </h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  {COACHING_LINES[currentIndex % COACHING_LINES.length]}
                </p>
                {currentItem.habit.is_archived && (
                  <p className="mt-3 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    This habit is archived, but remains in this routine.
                  </p>
                )}
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="mt-6 grid gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="h-12 text-base"
                  onClick={handleComplete}
                  disabled={savingHabitId === currentItem.habit_id}
                >
                  {savingHabitId === currentItem.habit_id ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Check className="size-5" />
                  )}
                  Complete Step
                </Button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button type="button" variant="outline" className="h-10" onClick={handleSkip}>
                    <SkipForward className="size-4" />
                    Skip for now
                  </Button>
                  <Button asChild variant="ghost" className="h-10">
                    <Link href="/dashboard">Exit Routine</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <ol className="relative z-10 mt-8 grid gap-2 sm:grid-cols-2">
          {routine.items.map((item, index) => {
            const completed = completedIds.has(item.habit_id)
            const skipped = skippedIds.has(item.habit_id)
            const active = currentItem?.habit_id === item.habit_id

            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border bg-card/70 p-2 text-xs text-muted-foreground',
                  active && 'border-primary/35 text-foreground',
                  completed && 'bg-primary/10 text-primary',
                  skipped && 'opacity-60'
                )}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {completed ? <Check className="size-3" /> : index + 1}
                </span>
                <span className="truncate">
                  {item.habit.emoji} {item.habit.name}
                </span>
              </li>
            )
          })}
        </ol>
      </section>
    </main>
  )
}

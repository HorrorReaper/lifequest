'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createHabit, fetchHabits } from '@/lib/habits'
import type { Habit } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Flame, Minus, Plus } from 'lucide-react'
import { format } from 'date-fns'

interface HabitDashboardWidgetProps {
  userId: string
  initiallyOpen?: boolean
}

interface HabitLogUpsertClient {
  from(table: 'habit_logs'): {
    upsert(
      value: {
        user_id: string
        habit_id: string
        log_date: string
        completed: boolean
        entry_id: string | null
      },
      options: { onConflict: string }
    ): PromiseLike<{ error: unknown }>
  }
}

const EMOJI_OPTIONS = ['✅', '💪', '🧘', '💧', '📖', '🏃', '🥗', '😴', '🎯', '🧠', '🙏', '🚭', '☕', '💻', '🎵']

function habitLogUpsertClient(supabase: ReturnType<typeof createClient>): HabitLogUpsertClient {
  return supabase as unknown as HabitLogUpsertClient
}

export function HabitDashboardWidget({ userId, initiallyOpen = false }: HabitDashboardWidgetProps) {
  const supabase = useMemo(() => createClient(), [])
  const today = format(new Date(), 'yyyy-MM-dd')

  const [habits, setHabits] = useState<Habit[]>([])
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(initiallyOpen)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [habitData, logData] = await Promise.all([
        fetchHabits(supabase, userId),
        supabase
          .from('habit_logs')
          .select('habit_id')
          .eq('user_id', userId)
          .eq('log_date', today)
          .eq('completed', true),
      ])
      setHabits(habitData)
      const ids = new Set<string>((logData.data ?? []).map((l: { habit_id: string }) => l.habit_id))
      setLoggedIds(ids)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }, [supabase, today, userId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    function handleDataUpdated() {
      load()
    }

    window.addEventListener('lifequest-data-updated', handleDataUpdated)
    return () => window.removeEventListener('lifequest-data-updated', handleDataUpdated)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return

    setCreating(true)
    try {
      const habit = await createHabit(supabase, userId, { name, emoji: newEmoji })
      setHabits((prev) => [...prev, habit])
      setNewName('')
      setNewEmoji('✅')
      setShowAddForm(false)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(habit: Habit) {
    const wasChecked = loggedIds.has(habit.id)
    setToggling((s) => new Set(s).add(habit.id))

    // Optimistic update
    setLoggedIds((prev) => {
      const next = new Set(prev)
      if (wasChecked) {
        next.delete(habit.id)
      } else {
        next.add(habit.id)
      }
      return next
    })

    try {
      if (wasChecked) {
        await supabase
          .from('habit_logs')
          .delete()
          .eq('user_id', userId)
          .eq('habit_id', habit.id)
          .eq('log_date', today)
      } else {
        const { error } = await habitLogUpsertClient(supabase).from('habit_logs').upsert(
          { user_id: userId, habit_id: habit.id, log_date: today, completed: true, entry_id: null },
          { onConflict: 'user_id,habit_id,log_date' }
        )
        if (error) throw error
      }
    } catch (e) {
      console.error(e)
      // revert
      setLoggedIds((prev) => {
        const next = new Set(prev)
        if (wasChecked) {
          next.add(habit.id)
        } else {
          next.delete(habit.id)
        }
        return next
      })
    } finally {
      setToggling((s) => {
        const next = new Set(s)
        next.delete(habit.id)
        return next
      })
    }
  }

  const doneCount = habits.filter((h) => loggedIds.has(h.id)).length

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-orange-500" />
          <h2 className="text-sm font-semibold">Today&apos;s Habits</h2>
        </div>
        <div className="flex items-center gap-2">
          {habits.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{habits.length} done
          </span>
          )}
          <Button
            type="button"
            size="sm"
            variant={showAddForm ? 'outline' : 'default'}
            onClick={() => setShowAddForm((v) => !v)}
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
        <form onSubmit={handleCreate} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex gap-2">
            <select
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="h-9 w-14 shrink-0 rounded-md border border-input bg-background text-center text-lg"
              aria-label="Habit icon"
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>
            <Input
              placeholder="New habit"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
              {creating ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading…</p>
      ) : habits.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm font-medium">No habits yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add the first daily habit you want to keep alive.
          </p>
          {!showAddForm && (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-1.5 size-4" />
              Add Habit
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const checked = loggedIds.has(habit.id)
            const busy = toggling.has(habit.id)
            return (
              <li key={habit.id} className="flex items-center gap-3">
                <Checkbox
                  id={`habit-${habit.id}`}
                  checked={checked}
                  disabled={busy}
                  onCheckedChange={() => handleToggle(habit)}
                />
                <label
                  htmlFor={`habit-${habit.id}`}
                  className={`flex flex-1 items-center gap-2 text-sm cursor-pointer select-none ${
                    checked ? 'text-muted-foreground line-through' : ''
                  }`}
                >
                  <span>{habit.emoji}</span>
                  {habit.name}
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

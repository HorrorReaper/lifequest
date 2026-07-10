'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createHabit, fetchHabits, updateHabit } from '@/lib/habits'
import type { Habit } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Archive, Flame, Minus, Pencil, Plus, Save, X } from 'lucide-react'
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
  const router = useRouter()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [habits, setHabits] = useState<Habit[]>([])
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(initiallyOpen)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [creating, setCreating] = useState(false)
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('✅')

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
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
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
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
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

  function startEdit(habit: Habit) {
    setEditingHabitId(habit.id)
    setEditName(habit.name)
    setEditEmoji(habit.emoji)
  }

  function cancelEdit() {
    setEditingHabitId(null)
    setEditName('')
    setEditEmoji('✅')
  }

  async function handleSaveEdit(habit: Habit) {
    const name = editName.trim()
    if (!name) return

    try {
      await updateHabit(supabase, habit.id, { name, emoji: editEmoji })
      setHabits((current) =>
        current.map((item) =>
          item.id === habit.id ? { ...item, name, emoji: editEmoji } : item
        )
      )
      cancelEdit()
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (error) {
      console.error('Failed to update habit:', error)
      await load()
    }
  }

  async function handleArchive(habit: Habit) {
    setHabits((current) => current.filter((item) => item.id !== habit.id))
    setLoggedIds((current) => {
      const next = new Set(current)
      next.delete(habit.id)
      return next
    })

    try {
      await updateHabit(supabase, habit.id, { is_archived: true })
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
      router.refresh()
    } catch (error) {
      console.error('Failed to archive habit:', error)
      await load()
    }
  }

  const doneCount = habits.filter((h) => loggedIds.has(h.id)).length

  return (
    <div className="space-y-3 rounded-2xl border bg-background/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="grid gap-2 sm:grid-cols-[3.5rem_1fr_auto]">
            <select
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="h-10 w-14 shrink-0 rounded-md border border-input bg-background text-center text-lg sm:h-9"
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
            <Button
              type="submit"
              size="sm"
              className="col-span-2 h-10 sm:col-span-1 sm:h-9"
              disabled={creating || !newName.trim()}
            >
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
            const isEditing = editingHabitId === habit.id
            return (
              <li key={habit.id} className="group flex items-center gap-3 rounded-lg border p-2">
                <Checkbox
                  id={`habit-${habit.id}`}
                  checked={checked}
                  disabled={busy || isEditing}
                  onCheckedChange={() => handleToggle(habit)}
                />
                {isEditing ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                    <select
                      value={editEmoji}
                      onChange={(event) => setEditEmoji(event.target.value)}
                      className="h-10 w-14 shrink-0 rounded-md border border-input bg-background text-center text-lg sm:h-8"
                      aria-label="Habit icon"
                    >
                      {EMOJI_OPTIONS.map((emoji) => (
                        <option key={emoji} value={emoji}>
                          {emoji}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="h-10 sm:h-8"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-10 sm:h-8" onClick={() => handleSaveEdit(habit)} disabled={!editName.trim()}>
                        <Save className="size-3.5" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={cancelEdit}>
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label
                      htmlFor={`habit-${habit.id}`}
                      className={`flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2 text-sm ${
                        checked ? 'text-muted-foreground line-through' : ''
                      }`}
                    >
                      <span className="shrink-0">{habit.emoji}</span>
                      <span className="truncate">{habit.name}</span>
                    </label>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="size-10 p-0 text-muted-foreground sm:size-7"
                        onClick={() => startEdit(habit)}
                        aria-label="Edit habit"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="size-10 p-0 text-muted-foreground hover:text-destructive sm:size-7"
                        onClick={() => handleArchive(habit)}
                        aria-label="Archive habit"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

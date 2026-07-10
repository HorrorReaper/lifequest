'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Play, Plus, Save, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchHabits } from '@/lib/habits'
import type { Habit, RoutineWithItems } from '@/lib/types'
import {
  archiveRoutine,
  createRoutine,
  deleteRoutine,
  fetchRoutines,
  updateRoutine,
} from '@/lib/routines'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const EMOJI_OPTIONS = ['🌅', '☀️', '🧘', '💪', '🧠', '📚', '🌙', '🔥', '🎯', '✨']

interface RoutinesManagerProps {
  userId: string
}

function emptyForm() {
  return {
    name: '',
    emoji: '🌅',
    description: '',
    habitIds: [] as string[],
  }
}

export function RoutinesManager({ userId }: RoutinesManagerProps) {
  const supabase = useMemo(() => createClient(), [])
  const [habits, setHabits] = useState<Habit[]>([])
  const [routines, setRoutines] = useState<RoutineWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [habitToAdd, setHabitToAdd] = useState('')

  const activeHabits = habits.filter((habit) => !habit.is_archived)
  const habitById = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit])),
    [habits]
  )
  const availableHabits = activeHabits.filter((habit) => !form.habitIds.includes(habit.id))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [habitData, routineData] = await Promise.all([
        fetchHabits(supabase, userId, true),
        fetchRoutines(supabase, userId, true),
      ])
      setHabits(habitData)
      setRoutines(routineData)
    } catch (error) {
      console.error('Failed to load routines:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setHabitToAdd('')
  }

  function startEdit(routine: RoutineWithItems) {
    setEditingId(routine.id)
    setForm({
      name: routine.name,
      emoji: routine.emoji,
      description: routine.description ?? '',
      habitIds: routine.items.map((item) => item.habit_id),
    })
    setHabitToAdd('')
  }

  function addHabitToRoutine() {
    if (!habitToAdd || form.habitIds.includes(habitToAdd)) return
    setForm((current) => ({ ...current, habitIds: [...current.habitIds, habitToAdd] }))
    setHabitToAdd('')
  }

  function removeHabit(habitId: string) {
    setForm((current) => ({
      ...current,
      habitIds: current.habitIds.filter((id) => id !== habitId),
    }))
  }

  function moveHabit(habitId: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.habitIds.indexOf(habitId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.habitIds.length) return current

      const next = [...current.habitIds]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)

      return { ...current, habitIds: next }
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.name.trim() || form.habitIds.length === 0) return

    setSaving(true)
    try {
      if (editingId) {
        await updateRoutine(supabase, userId, editingId, form)
      } else {
        await createRoutine(supabase, userId, form)
      }
      resetForm()
      await load()
      window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
    } catch (error) {
      console.error('Failed to save routine:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(routine: RoutineWithItems) {
    await archiveRoutine(supabase, userId, routine.id, !routine.is_archived)
    await load()
    window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
  }

  async function handleDelete(routine: RoutineWithItems) {
    if (!confirm(`Delete "${routine.name}"? Habits and habit logs stay untouched.`)) return
    await deleteRoutine(supabase, userId, routine.id)
    await load()
    window.dispatchEvent(new CustomEvent('lifequest-data-updated'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Routines</CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Chain your existing habits into guided rituals like a morning routine or evening shutdown.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-muted/25 p-3">
          <div className="grid gap-2 sm:grid-cols-[4rem_1fr]">
            <select
              value={form.emoji}
              onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))}
              className="h-10 rounded-lg border border-input bg-background text-center text-lg"
              aria-label="Routine emoji"
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Routine name, e.g. Morning Energy"
              required
            />
          </div>

          <Input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Optional coaching note"
            maxLength={500}
          />

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              value={habitToAdd}
              onChange={(event) => setHabitToAdd(event.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              disabled={availableHabits.length === 0}
              aria-label="Add habit to routine"
            >
              <option value="">
                {availableHabits.length === 0 ? 'No more active habits to add' : 'Add a habit step'}
              </option>
              {availableHabits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  {habit.emoji} {habit.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={addHabitToRoutine} disabled={!habitToAdd}>
              <Plus className="size-4" />
              Add Step
            </Button>
          </div>

          {form.habitIds.length > 0 ? (
            <ol className="space-y-1.5">
              {form.habitIds.map((habitId, index) => {
                const habit = habitById.get(habitId)

                return (
                  <li key={habitId} className="flex items-center gap-2 rounded-lg border bg-background p-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {habit ? `${habit.emoji} ${habit.name}` : 'Missing habit'}
                    </span>
                    {habit?.is_archived && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        archived
                      </span>
                    )}
                    <Button type="button" size="icon-xs" variant="ghost" onClick={() => moveHabit(habitId, -1)} disabled={index === 0}>
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button type="button" size="icon-xs" variant="ghost" onClick={() => moveHabit(habitId, 1)} disabled={index === form.habitIds.length - 1}>
                      <ArrowDown className="size-3" />
                    </Button>
                    <Button type="button" size="icon-xs" variant="ghost" onClick={() => removeHabit(habitId)}>
                      <X className="size-3" />
                    </Button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              Add at least one habit to create a routine.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={saving || !form.name.trim() || form.habitIds.length === 0} className="flex-1">
              {editingId ? <Save className="size-4" /> : <Plus className="size-4" />}
              {saving ? 'Saving...' : editingId ? 'Save Routine' : 'Create Routine'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading routines...</p>
        ) : routines.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm font-medium">No routines yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Start with a simple 2-3 step ritual. Tiny beats perfect.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {routines.map((routine) => (
              <li
                key={routine.id}
                className={cn(
                  'rounded-xl border p-3',
                  routine.is_archived && 'opacity-55'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{routine.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{routine.name}</p>
                      {routine.is_archived && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          archived
                        </span>
                      )}
                    </div>
                    {routine.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {routine.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {routine.items.length} step{routine.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                {routine.items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {routine.items.map((item) => (
                      <span key={item.id} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {item.habit.emoji} {item.habit.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!routine.is_archived && routine.items.length > 0 && (
                    <Button asChild size="sm">
                      <Link href={`/routines/${routine.id}/run`}>
                        <Play className="size-3.5" />
                        Run
                      </Link>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => startEdit(routine)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleArchive(routine)}>
                    {routine.is_archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                    {routine.is_archived ? 'Restore' : 'Archive'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(routine)}>
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, ChevronUp, Pencil, Save, Trash2, X } from 'lucide-react'
import type {
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { describeSet, formatDuration, personalRecordLabel, sessionVolume } from './analytics'

export function WorkoutHistory({
  sessions,
  sessionExercises,
  sets,
  exercises,
  onUpdate,
  onDelete,
}: {
  sessions: WorkoutSessionRow[]
  sessionExercises: WorkoutSessionExerciseRow[]
  sets: WorkoutSetRow[]
  exercises: ExerciseRow[]
  onUpdate: (id: string, patch: Partial<WorkoutSessionRow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState<string | null>(sessions[0]?.id ?? null)
  const [editing, setEditing] = useState<WorkoutSessionRow | null>(null)
  const exerciseMap = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])

  return <section className="space-y-4">
    <div><p className="text-sm text-muted-foreground">Completed sessions and progression</p><h2 className="text-xl font-semibold">Workout history</h2></div>
    {editing && <form onSubmit={async (event) => { event.preventDefault(); await onUpdate(editing.id, { name: editing.name.trim(), notes: editing.notes, updated_at: new Date().toISOString() }); setEditing(null) }} className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Edit workout</h3><Button type="button" size="icon" variant="ghost" onClick={() => setEditing(null)}><X /></Button></div>
      <Input className="mt-3" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
      <Input className="mt-3" value={editing.notes ?? ''} onChange={(event) => setEditing({ ...editing, notes: event.target.value || null })} placeholder="Session notes" />
      <Button className="mt-3" type="submit"><Save /> Save changes</Button>
    </form>}
    <div className="space-y-3">{sessions.filter((session) => session.status !== 'active').map((session) => {
      const items = sessionExercises.filter((item) => item.session_id === session.id)
      const open = expanded === session.id
      const completedSets = sets.filter((set) => items.some((item) => item.id === set.session_exercise_id) && set.is_complete)
      return <article key={session.id} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <button className="flex w-full items-center gap-3 p-4 text-left sm:p-5" onClick={() => setExpanded(open ? null : session.id)}>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{session.name}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{session.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{format(new Date(session.started_at), 'd MMM yyyy · HH:mm')} · {formatDuration(session.duration_seconds)} · {completedSets.length} sets · {Math.round(sessionVolume(session.id, sessionExercises, sets)).toLocaleString()} kg volume</p></div>{open ? <ChevronUp /> : <ChevronDown />}</button>
        {open && <div className="border-t p-4 sm:p-5">
          {session.notes && <p className="mb-4 text-sm text-muted-foreground">{session.notes}</p>}
          <div className="space-y-4">{items.map((item) => {
            const exercise = exerciseMap.get(item.exercise_id)
            if (!exercise) return null
            const itemSets = sets.filter((set) => set.session_exercise_id === item.id)
            return <div key={item.id}><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">{exercise.name}</h4><span className="text-xs text-primary">{personalRecordLabel(exercise, itemSets)}</span></div><div className="mt-2 flex flex-wrap gap-2">{itemSets.map((set, index) => <span key={set.id} className="rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs">{index + 1}. {describeSet(exercise, set)}</span>)}</div></div>
          })}</div>
          <div className="mt-5 flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(session)}><Pencil /> Edit</Button><Button size="sm" variant="ghost" onClick={() => onDelete(session.id)}><Trash2 /> Delete</Button></div>
        </div>}
      </article>
    })}</div>
  </section>
}

'use client'

import { useMemo, useState } from 'react'
import { Copy, GripVertical, Link2, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react'
import type { ExerciseRow, WorkoutTemplateExerciseRow, WorkoutTemplateRow } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type RoutineItemDraft = {
  id?: string
  exerciseId: string
  targetSets: number
  repMin: number
  repMax: number
  restSeconds: number
  supersetGroup: string
  notes: string
}

export type RoutineDraft = {
  id?: string
  name: string
  notes: string
  items: RoutineItemDraft[]
}

export type RoutineWithItems = WorkoutTemplateRow & { items: WorkoutTemplateExerciseRow[] }

export function RoutineBuilder({
  exercises,
  routines,
  onSave,
  onStart,
  onClone,
  onDelete,
}: {
  exercises: ExerciseRow[]
  routines: RoutineWithItems[]
  onSave: (draft: RoutineDraft) => Promise<void>
  onStart: (routine?: RoutineWithItems) => Promise<void>
  onClone: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<RoutineDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragged, setDragged] = useState<number | null>(null)
  const exerciseMap = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])

  function edit(routine: RoutineWithItems) {
    setDraft({
      id: routine.id,
      name: routine.name,
      notes: routine.notes ?? '',
      items: routine.items.map((item) => ({
        id: item.id,
        exerciseId: item.exercise_id,
        targetSets: item.target_sets,
        repMin: item.rep_min ?? 6,
        repMax: item.rep_max ?? 12,
        restSeconds: item.rest_seconds,
        supersetGroup: item.superset_group ?? '',
        notes: item.notes ?? '',
      })),
    })
  }

  function addExercise(exerciseId: string) {
    if (!draft || !exerciseId || draft.items.some((item) => item.exerciseId === exerciseId)) return
    setDraft({ ...draft, items: [...draft.items, { exerciseId, targetSets: 3, repMin: 6, repMax: 12, restSeconds: 120, supersetGroup: '', notes: '' }] })
  }

  function patchItem(index: number, patch: Partial<RoutineItemDraft>) {
    if (!draft) return
    const items = [...draft.items]
    items[index] = { ...items[index], ...patch }
    setDraft({ ...draft, items })
  }

  function drop(target: number) {
    if (!draft || dragged === null || target === dragged) return
    const items = [...draft.items]
    const [moved] = items.splice(dragged, 1)
    items.splice(target, 0, moved)
    setDraft({ ...draft, items })
    setDragged(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft?.name.trim() || !draft.items.length || saving) return
    setSaving(true)
    try {
      await onSave(draft)
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  if (draft) return <form onSubmit={submit} className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
    <div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Routine builder</p><h2 className="text-xl font-semibold">{draft.id ? 'Edit routine' : 'New routine'}</h2></div><Button type="button" size="icon" variant="ghost" onClick={() => setDraft(null)}><X /></Button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr]"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Push day" required /><Input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Routine intent or notes" /></div>
    <select className="mt-3 h-11 w-full rounded-md border bg-background px-3 text-sm" value="" onChange={(event) => addExercise(event.target.value)}>
      <option value="">Add exercise…</option>{exercises.filter((exercise) => !exercise.is_archived && !draft.items.some((item) => item.exerciseId === exercise.id)).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
    </select>
    <div className="mt-5 space-y-3">{draft.items.map((item, index) => {
      const exercise = exerciseMap.get(item.exerciseId)
      return <article key={item.exerciseId} draggable onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(index)} className="rounded-2xl bg-muted/45 p-4">
        <div className="flex items-center gap-3"><GripVertical className="size-4 cursor-grab text-muted-foreground" /><div className="min-w-0 flex-1"><p className="font-medium">{exercise?.name}</p><p className="text-xs capitalize text-muted-foreground">{exercise?.tracking_type.replaceAll('_', ' ')}</p></div><Button type="button" size="icon" variant="ghost" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></Button></div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
          <SmallNumber label="Sets" value={item.targetSets} min={1} onChange={(targetSets) => patchItem(index, { targetSets })} />
          <SmallNumber label="Min reps" value={item.repMin} min={0} onChange={(repMin) => patchItem(index, { repMin })} />
          <SmallNumber label="Max reps" value={item.repMax} min={0} onChange={(repMax) => patchItem(index, { repMax })} />
          <SmallNumber label="Rest sec" value={item.restSeconds} min={0} onChange={(restSeconds) => patchItem(index, { restSeconds })} />
          <label className="block"><span className="mb-1 block text-[10px] text-muted-foreground">Superset</span><Input value={item.supersetGroup} onChange={(event) => patchItem(index, { supersetGroup: event.target.value })} placeholder="A" /></label>
          <label className="block"><span className="mb-1 block text-[10px] text-muted-foreground">Note</span><Input value={item.notes} onChange={(event) => patchItem(index, { notes: event.target.value })} placeholder="Tempo…" /></label>
        </div>
      </article>
    })}</div>
    <div className="sticky bottom-3 mt-5 flex justify-end"><Button type="submit" disabled={saving || !draft.items.length}><Save /> {saving ? 'Saving…' : 'Save routine'}</Button></div>
  </form>

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Repeatable training days</p><h2 className="text-xl font-semibold">Routines</h2></div><div className="flex gap-2"><Button variant="outline" onClick={() => onStart()}><Play /> Empty workout</Button><Button onClick={() => setDraft({ name: '', notes: '', items: [] })}><Plus /> New routine</Button></div></div>
    <div className="grid gap-4 lg:grid-cols-2">{routines.length ? routines.map((routine) => <article key={routine.id} className="rounded-[2rem] bg-card p-5 ring-1 ring-border">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold">{routine.name}</h3><p className="mt-1 text-xs text-muted-foreground">{routine.items.length} exercises · {routine.items.reduce((sum, item) => sum + item.target_sets, 0)} sets</p></div><Button size="icon" variant="ghost" onClick={() => edit(routine)}><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => onClone(routine.id)}><Copy /></Button><Button size="icon" variant="ghost" onClick={() => onDelete(routine.id)}><Trash2 /></Button></div>
      {routine.notes && <p className="mt-3 text-sm text-muted-foreground">{routine.notes}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{routine.items.map((item) => <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">{item.superset_group && <Link2 className="size-3" />}{exerciseMap.get(item.exercise_id)?.name}</span>)}</div>
      <Button className="mt-5 w-full" onClick={() => onStart(routine)}><Play /> Start workout</Button>
    </article>) : <div className="rounded-[2rem] border border-dashed p-10 text-center text-sm text-muted-foreground lg:col-span-2">Create your first routine or start an empty workout.</div>}</div>
  </section>
}

function SmallNumber({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1 block text-[10px] text-muted-foreground">{label}</span><Input type="number" min={min} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value)))} /></label>
}

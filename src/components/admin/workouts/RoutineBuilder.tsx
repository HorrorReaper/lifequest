'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, GripVertical, Link2, Pencil, Play, Plus, Save, Trash2, X } from 'lucide-react'
import type {
  ExerciseRow,
  WorkoutSetType,
  WorkoutTemplateExerciseRow,
  WorkoutTemplateRow,
  WorkoutTemplateSetRow,
} from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type RoutineSetDraft = {
  setType: WorkoutSetType
  targetReps: number | null
  targetWeightKg: number | null
  targetAssistanceKg: number | null
  targetDurationSeconds: number | null
  targetDistanceMeters: number | null
  targetRir: number | null
}

export type RoutineItemDraft = {
  id?: string
  exerciseId: string
  restSeconds: number
  supersetGroup: string
  notes: string
  sets: RoutineSetDraft[]
}

export type RoutineDraft = {
  id?: string
  name: string
  notes: string
  items: RoutineItemDraft[]
}

export type RoutineExerciseWithSets = WorkoutTemplateExerciseRow & { sets: WorkoutTemplateSetRow[] }
export type RoutineWithItems = WorkoutTemplateRow & { items: RoutineExerciseWithSets[] }

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
        restSeconds: item.rest_seconds,
        supersetGroup: item.superset_group ?? '',
        notes: item.notes ?? '',
        sets: item.sets.length
          ? item.sets.sort((a, b) => a.set_order - b.set_order).map((set) => ({
            setType: set.set_type,
            targetReps: set.target_reps,
            targetWeightKg: set.target_weight_kg,
            targetAssistanceKg: set.target_assistance_kg,
            targetDurationSeconds: set.target_duration_seconds,
            targetDistanceMeters: set.target_distance_meters,
            targetRir: set.target_rir,
          }))
          : Array.from({ length: Math.max(1, item.target_sets) }, () => defaultSet(exerciseMap.get(item.exercise_id))),
      })),
    })
  }

  function addExercise(exerciseId: string) {
    if (!draft || !exerciseId || draft.items.some((item) => item.exerciseId === exerciseId)) return
    setDraft({ ...draft, items: [...draft.items, { exerciseId, restSeconds: 120, supersetGroup: '', notes: '', sets: Array.from({ length: 3 }, () => defaultSet(exerciseMap.get(exerciseId))) }] })
  }

  function patchItem(index: number, patch: Partial<RoutineItemDraft>) {
    if (!draft) return
    const items = [...draft.items]
    items[index] = { ...items[index], ...patch }
    setDraft({ ...draft, items })
  }

  function patchSet(itemIndex: number, setIndex: number, patch: Partial<RoutineSetDraft>) {
    if (!draft) return
    const sets = [...draft.items[itemIndex].sets]
    sets[setIndex] = { ...sets[setIndex], ...patch }
    patchItem(itemIndex, { sets })
  }

  function move(from: number, to: number) {
    if (!draft || to < 0 || to >= draft.items.length || from === to) return
    const items = [...draft.items]
    const [moved] = items.splice(from, 1)
    items.splice(to, 0, moved)
    setDraft({ ...draft, items })
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

  if (draft) return <form onSubmit={submit} className="rounded-[2rem] bg-card p-4 ring-1 ring-border sm:p-7">
    <div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Focused routine editor</p><h2 className="text-xl font-semibold">{draft.id ? 'Edit routine' : 'New routine'}</h2></div><Button type="button" size="icon" variant="ghost" onClick={() => setDraft(null)} aria-label="Close routine editor"><X /></Button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Push day" required /><Input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Routine intent or notes" /></div>
    <select className="mt-3 h-11 w-full rounded-md border bg-background px-3 text-sm" value="" onChange={(event) => addExercise(event.target.value)} aria-label="Add exercise to routine">
      <option value="">Add exercise…</option>{exercises.filter((exercise) => !exercise.is_archived && !draft.items.some((item) => item.exerciseId === exercise.id)).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
    </select>
    <div className="mt-5 space-y-3">{draft.items.map((item, itemIndex) => {
      const exercise = exerciseMap.get(item.exerciseId)
      return <article
        key={item.exerciseId}
        draggable
        onDragStart={() => setDragged(itemIndex)}
        onDragEnd={() => setDragged(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => { if (dragged !== null) move(dragged, itemIndex); setDragged(null) }}
        className={cn('rounded-2xl bg-muted/45 p-3 sm:p-4', dragged === itemIndex && 'opacity-55')}
      >
        <div className="flex items-center gap-2"><GripVertical className="hidden size-4 cursor-grab text-muted-foreground sm:block" /><div className="min-w-0 flex-1"><p className="font-medium">{exercise?.name}</p><p className="text-xs capitalize text-muted-foreground">{exercise?.tracking_type.replaceAll('_', ' ')} · {item.sets.length} sets</p></div><Button type="button" size="icon" variant="ghost" onClick={() => move(itemIndex, itemIndex - 1)} disabled={itemIndex === 0} aria-label="Move up"><ChevronUp /></Button><Button type="button" size="icon" variant="ghost" onClick={() => move(itemIndex, itemIndex + 1)} disabled={itemIndex === draft.items.length - 1} aria-label="Move down"><ChevronDown /></Button><Button type="button" size="icon" variant="ghost" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, index) => index !== itemIndex) })} aria-label="Remove exercise"><Trash2 /></Button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_8rem_1fr]">
          <SmallNumber label="Rest seconds" value={item.restSeconds} min={0} onChange={(restSeconds) => patchItem(itemIndex, { restSeconds })} />
          <label><span className="mb-1 block text-[10px] text-muted-foreground">Superset</span><Input value={item.supersetGroup} onChange={(event) => patchItem(itemIndex, { supersetGroup: event.target.value })} placeholder="A" /></label>
          <label><span className="mb-1 block text-[10px] text-muted-foreground">Exercise notes</span><Input value={item.notes} onChange={(event) => patchItem(itemIndex, { notes: event.target.value })} placeholder="Tempo, cues…" /></label>
        </div>
        <div className="mt-3 space-y-2">{item.sets.map((set, setIndex) => <div key={setIndex} className="rounded-xl bg-card p-3 ring-1 ring-border">
          <div className="flex items-center gap-2"><span className="w-6 font-mono text-xs text-muted-foreground">{setIndex + 1}</span><select className="h-9 rounded-md border bg-background px-2 text-xs" value={set.setType} onChange={(event) => patchSet(itemIndex, setIndex, { setType: event.target.value as WorkoutSetType })}><option value="warmup">Warm-up</option><option value="working">Working</option><option value="drop">Drop</option><option value="failure">Failure</option></select><span className="flex-1" /><Button type="button" size="sm" variant="ghost" onClick={() => patchItem(itemIndex, { sets: [...item.sets.slice(0, setIndex + 1), { ...set }, ...item.sets.slice(setIndex + 1)] })}><Copy /> Duplicate</Button><Button type="button" size="icon" variant="ghost" disabled={item.sets.length === 1} onClick={() => patchItem(itemIndex, { sets: item.sets.filter((_, index) => index !== setIndex) })} aria-label="Delete planned set"><Trash2 /></Button></div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{targetInputs(exercise, set, (patch) => patchSet(itemIndex, setIndex, patch))}{supportsRir(exercise) && <NullableNumber label="Target RIR" value={set.targetRir} min={0} onChange={(targetRir) => patchSet(itemIndex, setIndex, { targetRir })} />}</div>
        </div>)}</div>
        <Button type="button" className="mt-3" variant="outline" size="sm" onClick={() => patchItem(itemIndex, { sets: [...item.sets, defaultSet(exercise)] })}><Plus /> Add planned set</Button>
      </article>
    })}</div>
    <div className="sticky bottom-3 mt-5 flex justify-end rounded-xl bg-card/90 p-2 backdrop-blur"><Button type="submit" disabled={saving || !draft.items.length}><Save /> {saving ? 'Saving…' : 'Save routine'}</Button></div>
  </form>

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Repeatable training days</p><h2 className="text-xl font-semibold">Routines</h2></div><div className="flex gap-2"><Button variant="outline" onClick={() => onStart()}><Play /> Empty workout</Button><Button onClick={() => setDraft({ name: '', notes: '', items: [] })}><Plus /> New routine</Button></div></div>
    <div className="grid gap-4 lg:grid-cols-2">{routines.length ? routines.map((routine) => <article key={routine.id} className="rounded-[2rem] bg-card p-5 ring-1 ring-border">
      <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="text-lg font-semibold">{routine.name}</h3><p className="mt-1 text-xs text-muted-foreground">{routine.items.length} exercises · {routine.items.reduce((sum, item) => sum + item.sets.length, 0)} sets</p></div><Button size="icon" variant="ghost" onClick={() => edit(routine)} aria-label="Edit routine"><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => onClone(routine.id)} aria-label="Duplicate routine"><Copy /></Button><Button size="icon" variant="ghost" onClick={() => onDelete(routine.id)} aria-label="Delete routine"><Trash2 /></Button></div>
      {routine.notes && <p className="mt-3 text-sm text-muted-foreground">{routine.notes}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{routine.items.map((item) => <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">{item.superset_group && <Link2 className="size-3" />}{exerciseMap.get(item.exercise_id)?.name}</span>)}</div>
      <Button className="mt-5 w-full" onClick={() => onStart(routine)}><Play /> Start workout</Button>
    </article>) : <div className="rounded-[2rem] border border-dashed p-10 text-center text-sm text-muted-foreground lg:col-span-2">Create your first routine or start an empty workout.</div>}</div>
  </section>
}

function defaultSet(exercise?: ExerciseRow): RoutineSetDraft {
  return {
    setType: 'working',
    targetReps: supportsRir(exercise) ? 8 : null,
    targetWeightKg: null,
    targetAssistanceKg: null,
    targetDurationSeconds: exercise && ['duration', 'distance_duration', 'weight_duration'].includes(exercise.tracking_type) ? 60 : null,
    targetDistanceMeters: exercise?.tracking_type === 'distance_duration' ? 1000 : null,
    targetRir: supportsRir(exercise) ? 2 : null,
  }
}

function targetInputs(exercise: ExerciseRow | undefined, set: RoutineSetDraft, onChange: (patch: Partial<RoutineSetDraft>) => void) {
  switch (exercise?.tracking_type) {
    case 'weight_reps':
    case 'bodyweight_reps':
      return <><NullableNumber label={exercise.tracking_type === 'bodyweight_reps' ? 'Added kg' : 'Target kg'} value={set.targetWeightKg} min={0} onChange={(targetWeightKg) => onChange({ targetWeightKg })} /><NullableNumber label="Target reps" value={set.targetReps} min={0} onChange={(targetReps) => onChange({ targetReps })} /></>
    case 'assisted_reps':
      return <><NullableNumber label="Assist kg" value={set.targetAssistanceKg} min={0} onChange={(targetAssistanceKg) => onChange({ targetAssistanceKg })} /><NullableNumber label="Target reps" value={set.targetReps} min={0} onChange={(targetReps) => onChange({ targetReps })} /></>
    case 'duration':
      return <NullableNumber label="Target seconds" value={set.targetDurationSeconds} min={0} onChange={(targetDurationSeconds) => onChange({ targetDurationSeconds })} />
    case 'distance_duration':
      return <><NullableNumber label="Target meters" value={set.targetDistanceMeters} min={0} onChange={(targetDistanceMeters) => onChange({ targetDistanceMeters })} /><NullableNumber label="Target seconds" value={set.targetDurationSeconds} min={0} onChange={(targetDurationSeconds) => onChange({ targetDurationSeconds })} /></>
    case 'weight_duration':
      return <><NullableNumber label="Target kg" value={set.targetWeightKg} min={0} onChange={(targetWeightKg) => onChange({ targetWeightKg })} /><NullableNumber label="Target seconds" value={set.targetDurationSeconds} min={0} onChange={(targetDurationSeconds) => onChange({ targetDurationSeconds })} /></>
    default:
      return null
  }
}

function supportsRir(exercise?: ExerciseRow) {
  return Boolean(exercise && ['weight_reps', 'bodyweight_reps', 'assisted_reps'].includes(exercise.tracking_type))
}

function SmallNumber({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) {
  return <label><span className="mb-1 block text-[10px] text-muted-foreground">{label}</span><Input type="number" min={min} value={value} onChange={(event) => onChange(Math.max(min, Number(event.target.value)))} /></label>
}

function NullableNumber({ label, value, min, onChange }: { label: string; value: number | null; min: number; onChange: (value: number | null) => void }) {
  return <label><span className="mb-1 block text-[10px] text-muted-foreground">{label}</span><Input type="number" min={min} value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Math.max(min, Number(event.target.value)))} /></label>
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Plus, TimerReset, Trash2, X } from 'lucide-react'
import type {
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
  WorkoutSetType,
} from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { describeSet, formatDuration } from './analytics'

export type ActiveExercise = WorkoutSessionExerciseRow & { exercise: ExerciseRow; sets: WorkoutSetRow[] }

export function ActiveWorkout({
  session,
  items,
  exercises,
  previous,
  timerSound,
  timerVibration,
  onAddExercise,
  onRemoveExercise,
  onMoveExercise,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onFinish,
}: {
  session: WorkoutSessionRow
  items: ActiveExercise[]
  exercises: ExerciseRow[]
  previous: (exerciseId: string) => string
  timerSound: boolean
  timerVibration: boolean
  onAddExercise: (exerciseId: string) => Promise<void>
  onRemoveExercise: (id: string) => Promise<void>
  onMoveExercise: (index: number, direction: -1 | 1) => Promise<void>
  onUpdateSet: (id: string, patch: Partial<WorkoutSetRow>) => Promise<void>
  onAddSet: (item: ActiveExercise, source?: WorkoutSetRow) => Promise<void>
  onDeleteSet: (id: string) => Promise<void>
  onFinish: (status: 'completed' | 'cancelled') => Promise<void>
}) {
  const [exerciseId, setExerciseId] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [rest, setRest] = useState<number | null>(null)

  useEffect(() => {
    const tick = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)))
      setRest((current) => current === null ? null : Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [session.started_at])

  useEffect(() => {
    if (rest !== 0) return
    if (timerVibration) navigator.vibrate?.([150, 100, 150])
    if (timerSound) {
      const audio = new AudioContext()
      const oscillator = audio.createOscillator()
      oscillator.connect(audio.destination)
      oscillator.start()
      oscillator.stop(audio.currentTime + 0.18)
    }
  }, [rest, timerSound, timerVibration])

  function startRest(seconds: number) {
    if (!seconds) return
    setRest(seconds)
  }

  return <div className="mx-auto max-w-5xl space-y-5 pb-28">
    <div className="sticky top-3 z-20 flex items-center justify-between gap-3 rounded-2xl bg-card/95 p-4 shadow-lg ring-1 ring-border backdrop-blur">
      <div><p className="text-xs text-muted-foreground">Active workout · {formatDuration(elapsed)}</p><h1 className="font-semibold">{session.name}</h1></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => onFinish('cancelled')}><X /> Cancel</Button><Button onClick={() => onFinish('completed')}><Check /> Finish</Button></div>
    </div>
    {rest !== null && rest > 0 && <div className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground"><TimerReset /><div className="flex-1"><p className="text-xs opacity-70">Rest timer</p><p className="font-mono text-2xl">{formatDuration(rest)}</p></div><Button variant="secondary" size="sm" onClick={() => setRest(null)}>Skip</Button></div>}
    {items.map((item, index) => <article key={item.id} className="overflow-hidden rounded-[2rem] bg-card ring-1 ring-border">
      <div className="flex items-start gap-2 p-4 sm:p-5"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="font-semibold">{item.exercise.name}</h2>{item.superset_group && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">SUPERSET {item.superset_group}</span>}</div><p className="mt-1 text-xs text-muted-foreground">{previous(item.exercise_id)}</p></div><Button size="icon" variant="ghost" onClick={() => onMoveExercise(index, -1)} disabled={index === 0}><ChevronUp /></Button><Button size="icon" variant="ghost" onClick={() => onMoveExercise(index, 1)} disabled={index === items.length - 1}><ChevronDown /></Button><Button size="icon" variant="ghost" onClick={() => onRemoveExercise(item.id)}><Trash2 /></Button></div>
      <div className="border-t">
        {item.sets.map((set, setIndex) => <SetEditor key={set.id} exercise={item.exercise} set={set} index={setIndex} onSave={onUpdateSet} onDelete={onDeleteSet} onComplete={async (patch) => { await onUpdateSet(set.id, patch); if (!set.is_complete && patch.is_complete) startRest(item.rest_seconds ?? 120) }} />)}
      </div>
      <Button className="m-4 sm:m-5" variant="outline" size="sm" onClick={() => onAddSet(item, item.sets.at(-1))}><Plus /> Add set</Button>
    </article>)}
    <div className="rounded-2xl border border-dashed p-4"><div className="flex gap-2"><select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}><option value="">Add an exercise…</option>{exercises.filter((exercise) => !items.some((item) => item.exercise_id === exercise.id)).map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select><Button disabled={!exerciseId} onClick={async () => { await onAddExercise(exerciseId); setExerciseId('') }}><Plus /> Add</Button></div></div>
  </div>
}

function SetEditor({
  exercise,
  set,
  index,
  onSave,
  onDelete,
  onComplete,
}: {
  exercise: ExerciseRow
  set: WorkoutSetRow
  index: number
  onSave: (id: string, patch: Partial<WorkoutSetRow>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onComplete: (patch: Partial<WorkoutSetRow>) => Promise<void>
}) {
  const [draft, setDraft] = useState(set)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(set), [set])
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(set), [draft, set])

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await onSave(set.id, {
        set_type: draft.set_type,
        reps: draft.reps,
        weight_kg: draft.weight_kg,
        assistance_kg: draft.assistance_kg,
        duration_seconds: draft.duration_seconds,
        distance_meters: draft.distance_meters,
        rir: draft.rir,
      })
    } finally {
      setSaving(false)
    }
  }

  async function toggle() {
    await save()
    const completed = !draft.is_complete
    const patch = { is_complete: completed, completed_at: completed ? new Date().toISOString() : null }
    setDraft({ ...draft, ...patch })
    await onComplete(patch)
  }

  return <div className={cn('grid items-end gap-2 border-b p-3 last:border-0 sm:px-5', set.is_complete && 'bg-primary/5')}>
    <div className="flex items-center gap-2"><span className="w-6 font-mono text-xs text-muted-foreground">{index + 1}</span><select className="h-9 rounded-md border bg-background px-2 text-xs" value={draft.set_type} onChange={(event) => setDraft({ ...draft, set_type: event.target.value as WorkoutSetType })} onBlur={save}><option value="warmup">Warm-up</option><option value="working">Working</option><option value="drop">Drop</option><option value="failure">Failure</option></select><span className="flex-1 text-right text-xs text-muted-foreground">{saving ? 'Saving…' : set.is_complete ? describeSet(exercise, set) : dirty ? 'Unsaved' : ''}</span></div>
    <div className="flex flex-wrap items-end gap-2">
      {(exercise.tracking_type === 'weight_reps' || exercise.tracking_type === 'bodyweight_reps' || exercise.tracking_type === 'weight_duration') && <SetNumber label={exercise.tracking_type === 'bodyweight_reps' ? 'Added kg' : 'Weight kg'} value={draft.weight_kg} onChange={(weight_kg) => setDraft({ ...draft, weight_kg })} onBlur={save} />}
      {(exercise.tracking_type === 'weight_reps' || exercise.tracking_type === 'bodyweight_reps' || exercise.tracking_type === 'assisted_reps') && <SetNumber label="Reps" value={draft.reps} step={1} onChange={(reps) => setDraft({ ...draft, reps })} onBlur={save} />}
      {exercise.tracking_type === 'assisted_reps' && <SetNumber label="Assist kg" value={draft.assistance_kg} onChange={(assistance_kg) => setDraft({ ...draft, assistance_kg })} onBlur={save} />}
      {(exercise.tracking_type === 'duration' || exercise.tracking_type === 'distance_duration' || exercise.tracking_type === 'weight_duration') && <SetNumber label="Seconds" value={draft.duration_seconds} step={1} onChange={(duration_seconds) => setDraft({ ...draft, duration_seconds })} onBlur={save} />}
      {exercise.tracking_type === 'distance_duration' && <SetNumber label="Distance m" value={draft.distance_meters} onChange={(distance_meters) => setDraft({ ...draft, distance_meters })} onBlur={save} />}
      {(exercise.tracking_type === 'weight_reps' || exercise.tracking_type === 'bodyweight_reps' || exercise.tracking_type === 'assisted_reps') && <SetNumber label="RIR" value={draft.rir} onChange={(rir) => setDraft({ ...draft, rir })} onBlur={save} />}
      <Button className="ml-auto" size="icon" variant={draft.is_complete ? 'default' : 'outline'} onClick={toggle} aria-label="Complete set"><Check /></Button>
      <Button size="icon" variant="ghost" onClick={() => onDelete(set.id)} aria-label="Delete set"><Trash2 /></Button>
    </div>
  </div>
}

function SetNumber({ label, value, step = 0.5, onChange, onBlur }: { label: string; value: number | null; step?: number; onChange: (value: number | null) => void; onBlur: () => void }) {
  return <label className="min-w-20 flex-1"><span className="mb-1 block text-[10px] text-muted-foreground">{label}</span><Input className="font-mono" type="number" min="0" step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Math.max(0, Number(event.target.value)))} onBlur={onBlur} /></label>
}

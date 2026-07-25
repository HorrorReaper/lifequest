'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  MoreHorizontal,
  Plus,
  RefreshCw,
  TimerReset,
  Trash2,
  X,
} from 'lucide-react'
import type {
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
  WorkoutSetType,
} from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { describeSet, formatDuration } from './analytics'
import { ExercisePicker } from './ExercisePicker'
import { PlateCalculator } from './PlateCalculator'
import { secondsUntil, type PreviousPerformance } from './workout-utils'

export type ActiveExercise = WorkoutSessionExerciseRow & { exercise: ExerciseRow; sets: WorkoutSetRow[] }

const editableSetKeys = [
  'set_type',
  'reps',
  'weight_kg',
  'assistance_kg',
  'duration_seconds',
  'distance_meters',
  'rir',
] as const

export function ActiveWorkout({
  session,
  items,
  exercises,
  previous,
  recentIds,
  favoriteIds,
  timerSound,
  timerVibration,
  externalError,
  onRetryLoad,
  onAddExercise,
  onRemoveExercise,
  onMoveExercise,
  onUpdateExercise,
  onUpdateSession,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onFinish,
}: {
  session: WorkoutSessionRow
  items: ActiveExercise[]
  exercises: ExerciseRow[]
  previous: (exerciseId: string) => PreviousPerformance
  recentIds: ReadonlySet<string>
  favoriteIds: ReadonlySet<string>
  timerSound: boolean
  timerVibration: boolean
  externalError: string | null
  onRetryLoad: () => Promise<void>
  onAddExercise: (exerciseId: string) => Promise<void>
  onRemoveExercise: (id: string) => Promise<void>
  onMoveExercise: (index: number, direction: -1 | 1) => Promise<void>
  onUpdateExercise: (id: string, patch: Partial<WorkoutSessionExerciseRow>) => Promise<void>
  onUpdateSession: (id: string, patch: Partial<WorkoutSessionRow>) => Promise<void>
  onUpdateSet: (id: string, patch: Partial<WorkoutSetRow>) => Promise<void>
  onAddSet: (item: ActiveExercise, source?: WorkoutSetRow) => Promise<void>
  onDeleteSet: (id: string) => Promise<void>
  onFinish: (status: 'completed' | 'cancelled') => Promise<void>
}) {
  const [drafts, setDrafts] = useState<Record<string, WorkoutSetRow>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  const [elapsed, setElapsed] = useState(0)
  const [restDeadline, setRestDeadline] = useState<number | null>(null)
  const [restRemaining, setRestRemaining] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [plateCalculatorOpen, setPlateCalculatorOpen] = useState(false)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const announcedDeadline = useRef<number | null>(null)
  const pendingSaves = useRef(new Map<string, Promise<boolean>>())

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, WorkoutSetRow> = {}
      for (const item of items) {
        for (const set of item.sets) next[set.id] = current[set.id] ?? set
      }
      return next
    })
  }, [items])

  useEffect(() => {
    const tick = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)))
      setRestRemaining(secondsUntil(restDeadline))
    }
    tick()
    const interval = window.setInterval(tick, 500)
    return () => window.clearInterval(interval)
  }, [restDeadline, session.started_at])

  useEffect(() => {
    if (restDeadline === null || restRemaining !== 0 || announcedDeadline.current === restDeadline) return
    announcedDeadline.current = restDeadline
    if (timerVibration) navigator.vibrate?.([150, 100, 150])
    if (timerSound) {
      const audio = new window.AudioContext()
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.frequency.value = 660
      gain.gain.setValueAtTime(0.08, audio.currentTime)
      oscillator.connect(gain)
      gain.connect(audio.destination)
      oscillator.start()
      oscillator.stop(audio.currentTime + 0.2)
      oscillator.addEventListener('ended', () => void audio.close(), { once: true })
    }
  }, [restDeadline, restRemaining, timerSound, timerVibration])

  function patchDraft(id: string, patch: Partial<WorkoutSetRow>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
    setDirtyIds((current) => new Set(current).add(id))
    setSaveErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function saveSet(id: string): Promise<boolean> {
    const pending = pendingSaves.current.get(id)
    if (pending) return pending
    if (!dirtyIds.has(id)) return Promise.resolve(true)
    const draft = drafts[id]
    if (!draft) return Promise.resolve(true)
    const patch = Object.fromEntries(editableSetKeys.map((key) => [key, draft[key]])) as Partial<WorkoutSetRow>
    const task = (async () => {
      try {
        await onUpdateSet(id, patch)
        setDirtyIds((current) => {
          const next = new Set(current)
          next.delete(id)
          return next
        })
        setSaveErrors((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
        return true
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Set could not be saved.'
        setSaveErrors((current) => ({ ...current, [id]: message }))
        return false
      } finally {
        pendingSaves.current.delete(id)
      }
    })()
    pendingSaves.current.set(id, task)
    return task
  }

  async function completeSet(item: ActiveExercise, id: string) {
    if (!await saveSet(id)) return
    const draft = drafts[id]
    const complete = !draft.is_complete
    const patch = { is_complete: complete, completed_at: complete ? new Date().toISOString() : null }
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
    try {
      await onUpdateSet(id, patch)
      if (complete && item.rest_seconds) {
        const deadline = Date.now() + item.rest_seconds * 1000
        announcedDeadline.current = null
        setRestDeadline(deadline)
      }
    } catch (caught) {
      setDrafts((current) => ({ ...current, [id]: { ...current[id], is_complete: !complete, completed_at: draft.completed_at } }))
      setSaveErrors((current) => ({ ...current, [id]: caught instanceof Error ? caught.message : 'Set could not be completed.' }))
    }
  }

  async function finish() {
    if (finishing) return
    setFinishing(true)
    setFinishError(null)
    try {
      const pending = [...dirtyIds]
      const results = []
      for (const id of pending) results.push(await saveSet(id))
      if (results.some((saved) => !saved)) {
        setFinishError('Some sets are still unsaved. Your values are kept below — retry them before finishing.')
        return
      }
      await onFinish('completed')
    } catch (caught) {
      setFinishError(caught instanceof Error ? caught.message : 'Workout could not be finished.')
    } finally {
      setFinishing(false)
    }
  }

  const excludedIds = useMemo(() => new Set(items.map((item) => item.exercise_id)), [items])

  return <div className="mx-auto max-w-6xl space-y-4 pb-32">
    <header className="sticky top-3 z-30 rounded-2xl bg-card/95 p-3 shadow-lg ring-1 ring-border backdrop-blur sm:p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Active workout · <span className="font-mono">{formatDuration(elapsed)}</span>{dirtyIds.size > 0 && <span className="ml-2 text-amber-600">· {dirtyIds.size} unsaved</span>}</p><h1 className="truncate font-semibold">{session.name}</h1></div>
        <Button size="icon" variant="outline" onClick={() => setPlateCalculatorOpen(true)} aria-label="Open plate calculator"><Calculator /></Button>
        <Button className="hidden sm:inline-flex" variant="outline" onClick={() => onFinish('cancelled')}><X /> Discard</Button>
        <Button onClick={finish} disabled={finishing}><Check /> {finishing ? 'Saving…' : 'Finish'}</Button>
      </div>
      <Textarea
        className="mt-3 min-h-10 resize-none text-sm"
        defaultValue={session.notes ?? ''}
        placeholder="Session notes…"
        onBlur={(event) => {
          const notes = event.currentTarget.value.trim() || null
          if (notes !== session.notes) void onUpdateSession(session.id, { notes })
        }}
      />
    </header>

    {(finishError || externalError || Object.keys(saveErrors).length > 0) && <div className="sticky top-28 z-20 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><span className="flex-1">{finishError ?? externalError ?? 'One or more set values could not be saved.'}</span><Button size="sm" variant="ghost" onClick={() => finishError || Object.keys(saveErrors).length > 0 ? void finish() : void onRetryLoad()}><RefreshCw /> Retry</Button></div>}

    {restRemaining !== null && restRemaining > 0 && <div className="sticky top-28 z-20 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg"><TimerReset /><div className="flex-1"><p className="text-xs opacity-70">Rest timer</p><p className="font-mono text-2xl">{formatDuration(restRemaining)}</p></div><Button variant="secondary" size="sm" onClick={() => { setRestDeadline(null); setRestRemaining(null) }}>Skip</Button></div>}

    {items.map((item, index) => {
      const performance = previous(item.exercise_id)
      const expanded = expandedExercise === item.id
      return <article key={item.id} className={cn('overflow-hidden rounded-[2rem] bg-card ring-1 ring-border', item.superset_group && 'ring-primary/45')}>
        <div className="flex items-start gap-2 p-4 sm:p-5">
          <GripVertical className="mt-1 hidden size-4 text-muted-foreground sm:block" />
          <button className="min-w-0 flex-1 text-left" onClick={() => setExpandedExercise(expanded ? null : item.id)}>
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.exercise.name}</h2>{item.superset_group && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">SUPERSET {item.superset_group}</span>}</div>
            <p className="mt-1 text-xs capitalize text-muted-foreground">{item.exercise.tracking_type.replaceAll('_', ' ')} · rest {formatDuration(item.rest_seconds)}</p>
          </button>
          <Button size="icon" variant="ghost" onClick={() => setExpandedExercise(expanded ? null : item.id)} aria-label={`Exercise options for ${item.exercise.name}`}><MoreHorizontal /></Button>
        </div>
        {expanded && <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-[1fr_8rem_auto] sm:px-5">
          <label><span className="mb-1 block text-[10px] text-muted-foreground">Exercise notes</span><Input defaultValue={item.notes ?? ''} placeholder="Technique cue…" onBlur={(event) => { const notes = event.currentTarget.value.trim() || null; if (notes !== item.notes) void onUpdateExercise(item.id, { notes }) }} /></label>
          <label><span className="mb-1 block text-[10px] text-muted-foreground">Superset group</span><Input defaultValue={item.superset_group ?? ''} placeholder="A" onBlur={(event) => { const superset_group = event.currentTarget.value.trim() || null; if (superset_group !== item.superset_group) void onUpdateExercise(item.id, { superset_group }) }} /></label>
          <div className="flex items-end justify-end gap-1"><Button size="icon" type="button" variant="outline" onClick={() => onMoveExercise(index, -1)} disabled={index === 0} aria-label="Move exercise up"><ChevronUp /></Button><Button size="icon" type="button" variant="outline" onClick={() => onMoveExercise(index, 1)} disabled={index === items.length - 1} aria-label="Move exercise down"><ChevronDown /></Button><Button size="icon" type="button" variant="ghost" onClick={() => onRemoveExercise(item.id)} aria-label="Remove exercise"><Trash2 /></Button></div>
        </div>}

        <div className="border-t">
          <div className="hidden grid-cols-[3rem_7rem_minmax(0,1fr)_5rem_5rem] gap-2 bg-muted/35 px-5 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Set</span><span>Previous</span><span>Performance</span><span>RIR</span><span className="text-right">Done</span>
          </div>
          {item.sets.map((set, setIndex) => {
            const draft = drafts[set.id] ?? set
            return <SetEditor
              key={set.id}
              exercise={item.exercise}
              draft={draft}
              index={setIndex}
              previousSet={performance.sets[setIndex]}
              previousDate={performance.performedAt}
              dirty={dirtyIds.has(set.id)}
              error={saveErrors[set.id]}
              onChange={(patch) => patchDraft(set.id, patch)}
              onBlur={() => void saveSet(set.id)}
              onRetry={() => void saveSet(set.id)}
              onComplete={() => void completeSet(item, set.id)}
              onDuplicate={() => onAddSet(item, draft)}
              onDelete={() => onDeleteSet(set.id)}
            />
          })}
        </div>
        <Button className="m-4 sm:m-5" variant="outline" size="sm" onClick={() => onAddSet(item, drafts[item.sets.at(-1)?.id ?? ''] ?? item.sets.at(-1))}><Plus /> Add set</Button>
      </article>
    })}

    {items.length === 0 && <div className="rounded-[2rem] border border-dashed p-10 text-center"><p className="font-semibold">Build your workout</p><p className="mt-1 text-sm text-muted-foreground">Add the first exercise from the full catalog.</p></div>}
    <div className="sticky bottom-3 z-20 grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-card/95 p-3 shadow-xl ring-1 ring-border backdrop-blur">
      <Button className="min-h-12" onClick={() => setPickerOpen(true)}><Plus /> Add exercise</Button>
      <Button className="sm:hidden" variant="outline" size="icon" onClick={() => onFinish('cancelled')} aria-label="Discard workout"><Trash2 /></Button>
    </div>

    <ExercisePicker open={pickerOpen} exercises={exercises} excludedIds={excludedIds} recentIds={recentIds} favoriteIds={favoriteIds} onClose={() => setPickerOpen(false)} onSelect={onAddExercise} />
    <PlateCalculator open={plateCalculatorOpen} onClose={() => setPlateCalculatorOpen(false)} />
  </div>
}

function SetEditor({
  exercise,
  draft,
  index,
  previousSet,
  previousDate,
  dirty,
  error,
  onChange,
  onBlur,
  onRetry,
  onComplete,
  onDuplicate,
  onDelete,
}: {
  exercise: ExerciseRow
  draft: WorkoutSetRow
  index: number
  previousSet?: WorkoutSetRow
  previousDate: string | null
  dirty: boolean
  error?: string
  onChange: (patch: Partial<WorkoutSetRow>) => void
  onBlur: () => void
  onRetry: () => void
  onComplete: () => void
  onDuplicate: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  return <div className={cn('border-b px-3 py-3 last:border-0 sm:px-5', draft.is_complete && 'bg-primary/5', error && 'bg-destructive/5')}>
    <div className="grid grid-cols-[2.75rem_5rem_minmax(0,1fr)_3.5rem_3rem] items-end gap-1.5 sm:grid-cols-[3rem_7rem_minmax(0,1fr)_5rem_5rem] sm:gap-2">
      <label><span className="mb-1 block text-[10px] text-muted-foreground sm:hidden">Set</span><select className="h-10 w-full rounded-md border bg-background px-2 text-xs font-semibold" value={draft.set_type} onChange={(event) => onChange({ set_type: event.target.value as WorkoutSetType })} onBlur={onBlur} aria-label={`Set ${index + 1} type`}><option value="warmup">W</option><option value="working">{index + 1}</option><option value="drop">D</option><option value="failure">F</option></select></label>
      <div><span className="mb-1 block text-[10px] text-muted-foreground sm:hidden">Previous</span><p className="min-h-10 rounded-md bg-muted/55 px-2 py-2 font-mono text-[11px] leading-5 text-muted-foreground" title={previousDate ?? undefined}>{previousSet ? describeSet(exercise, previousSet) : '—'}</p></div>
      <div className="flex min-w-0 gap-2">{trackingInputs(exercise, draft, onChange, onBlur)}</div>
      <div>{supportsRir(exercise) ? <SetNumber compact label="RIR" value={draft.rir} step={1} onChange={(rir) => onChange({ rir })} onBlur={onBlur} /> : <span className="hidden sm:block" />}</div>
      <div className="flex justify-end"><Button className="size-10" size="icon" variant={draft.is_complete ? 'default' : 'outline'} onClick={onComplete} aria-label={`Complete set ${index + 1}`}><Check /></Button></div>
    </div>
    <div className="mt-2 flex min-h-7 items-center gap-2">
      <span className={cn('text-[10px]', error ? 'text-destructive' : 'text-muted-foreground')}>{error ?? (dirty ? 'Unsaved changes' : draft.is_complete ? describeSet(exercise, draft) : '')}</span>
      <span className="flex-1" />
      {error && <Button size="sm" variant="ghost" onClick={onRetry}><RefreshCw /> Retry</Button>}
      <Button size="sm" variant="ghost" onClick={onDuplicate}><Copy /> Duplicate</Button>
      <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Delete set ${index + 1}`}><Trash2 /></Button>
    </div>
  </div>
}

function trackingInputs(exercise: ExerciseRow, draft: WorkoutSetRow, onChange: (patch: Partial<WorkoutSetRow>) => void, onBlur: () => void) {
  switch (exercise.tracking_type) {
    case 'weight_reps':
      return <><SetNumber label="kg" value={draft.weight_kg} onChange={(weight_kg) => onChange({ weight_kg })} onBlur={onBlur} /><SetNumber label="Reps" value={draft.reps} step={1} onChange={(reps) => onChange({ reps })} onBlur={onBlur} /></>
    case 'bodyweight_reps':
      return <><SetNumber label="+ kg" value={draft.weight_kg} onChange={(weight_kg) => onChange({ weight_kg })} onBlur={onBlur} /><SetNumber label="Reps" value={draft.reps} step={1} onChange={(reps) => onChange({ reps })} onBlur={onBlur} /></>
    case 'assisted_reps':
      return <><SetNumber label="Assist kg" value={draft.assistance_kg} onChange={(assistance_kg) => onChange({ assistance_kg })} onBlur={onBlur} /><SetNumber label="Reps" value={draft.reps} step={1} onChange={(reps) => onChange({ reps })} onBlur={onBlur} /></>
    case 'duration':
      return <SetNumber label="Seconds" value={draft.duration_seconds} step={1} onChange={(duration_seconds) => onChange({ duration_seconds })} onBlur={onBlur} />
    case 'distance_duration':
      return <><SetNumber label="Meters" value={draft.distance_meters} step={1} onChange={(distance_meters) => onChange({ distance_meters })} onBlur={onBlur} /><SetNumber label="Seconds" value={draft.duration_seconds} step={1} onChange={(duration_seconds) => onChange({ duration_seconds })} onBlur={onBlur} /></>
    case 'weight_duration':
      return <><SetNumber label="kg" value={draft.weight_kg} onChange={(weight_kg) => onChange({ weight_kg })} onBlur={onBlur} /><SetNumber label="Seconds" value={draft.duration_seconds} step={1} onChange={(duration_seconds) => onChange({ duration_seconds })} onBlur={onBlur} /></>
  }
}

function supportsRir(exercise: ExerciseRow) {
  return ['weight_reps', 'bodyweight_reps', 'assisted_reps'].includes(exercise.tracking_type)
}

function SetNumber({ label, value, step = 0.5, compact = false, onChange, onBlur }: { label: string; value: number | null; step?: number; compact?: boolean; onChange: (value: number | null) => void; onBlur: () => void }) {
  return <label className={cn('min-w-0 flex-1', compact && 'w-full')}><span className="mb-1 block text-[10px] text-muted-foreground">{label}</span><Input className="h-10 min-w-0 font-mono" inputMode="decimal" type="number" min="0" step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Math.max(0, Number(event.target.value)))} onBlur={onBlur} /></label>
}

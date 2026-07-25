'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Activity, Dumbbell, History, Library, Play, RefreshCw, Settings2, Trophy, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type {
  ExercisePreferenceRow,
  ExerciseRow,
  WorkoutPreferenceRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
  WorkoutTemplateExerciseRow,
  WorkoutTemplateRow,
  WorkoutTemplateSetRow,
} from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from './AdminPageHeader'
import { cn } from '@/lib/utils'
import { ActiveWorkout, type ActiveExercise } from './workouts/ActiveWorkout'
import { ExerciseLibrary, type ExerciseDraft } from './workouts/ExerciseLibrary'
import { RoutineBuilder, type RoutineDraft, type RoutineWithItems } from './workouts/RoutineBuilder'
import { WorkoutHistory } from './workouts/WorkoutHistory'
import { sessionVolume } from './workouts/analytics'
import { findPreviousPerformance } from './workouts/workout-utils'

type View = 'overview' | 'routines' | 'exercises' | 'history'
const defaultPreferences: Omit<WorkoutPreferenceRow, 'user_id' | 'created_at' | 'updated_at'> = {
  default_rest_seconds: 120,
  previous_scope: 'same_template',
  weight_unit: 'kg',
  distance_unit: 'km',
  timer_sound: true,
  timer_vibration: true,
}

export function WorkoutHub({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, [])
  const [view, setView] = useState<View>('overview')
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [exercisePreferences, setExercisePreferences] = useState<ExercisePreferenceRow[]>([])
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [routines, setRoutines] = useState<RoutineWithItems[]>([])
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([])
  const [sessionExercises, setSessionExercises] = useState<WorkoutSessionExerciseRow[]>([])
  const [sets, setSets] = useState<WorkoutSetRow[]>([])
  const [activeSession, setActiveSession] = useState<WorkoutSessionRow | null>(null)
  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>([])
  const [activeOpen, setActiveOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [exerciseRes, preferenceRes, workoutPreferenceRes, routineRes, routineItemRes, routineSetRes, sessionRes] = await Promise.all([
      supabase.from('exercises').select('*').or(`user_id.is.null,user_id.eq.${userId}`).order('is_archived').order('name'),
      supabase.from('exercise_preferences').select('*').eq('user_id', userId),
      supabase.from('workout_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('workout_templates').select('*').eq('user_id', userId).order('sort_order').order('created_at'),
      supabase.from('workout_template_exercises').select('*').order('sort_order'),
      supabase.from('workout_template_sets').select('*').order('set_order'),
      supabase.from('workout_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(100),
    ])
    const firstError = exerciseRes.error ?? preferenceRes.error ?? workoutPreferenceRes.error ?? routineRes.error ?? routineItemRes.error ?? routineSetRes.error ?? sessionRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const loadedExercises = exerciseRes.data as ExerciseRow[]
    const loadedRoutines = routineRes.data as WorkoutTemplateRow[]
    const loadedItems = routineItemRes.data as WorkoutTemplateExerciseRow[]
    const loadedTemplateSets = routineSetRes.data as WorkoutTemplateSetRow[]
    const loadedSessions = sessionRes.data as WorkoutSessionRow[]
    const loadedSessionIds = loadedSessions.map((session) => session.id)
    const sessionExerciseRes = loadedSessionIds.length
      ? await supabase.from('workout_session_exercises').select('*').in('session_id', loadedSessionIds).order('sort_order')
      : { data: [], error: null }
    const loadedSessionExercises = (sessionExerciseRes.data ?? []) as WorkoutSessionExerciseRow[]
    const loadedSessionExerciseIds = loadedSessionExercises.map((item) => item.id)
    const setRes = loadedSessionExerciseIds.length
      ? await supabase.from('workout_sets').select('*').in('session_exercise_id', loadedSessionExerciseIds).order('set_order')
      : { data: [], error: null }
    if (sessionExerciseRes.error || setRes.error) setError((sessionExerciseRes.error ?? setRes.error)?.message ?? 'Workout details could not be loaded.')

    const loadedSets = (setRes.data ?? []) as WorkoutSetRow[]
    const active = loadedSessions.find((session) => session.status === 'active') ?? null
    setExercises(loadedExercises)
    setExercisePreferences(preferenceRes.data as ExercisePreferenceRow[])
    setPreferences(workoutPreferenceRes.data ? workoutPreferenceRes.data as WorkoutPreferenceRow : defaultPreferences)
    setRoutines(loadedRoutines.map((routine) => ({
      ...routine,
      items: loadedItems
        .filter((item) => item.template_id === routine.id)
        .map((item) => ({ ...item, sets: loadedTemplateSets.filter((set) => set.template_exercise_id === item.id) })),
    })))
    setSessions(loadedSessions)
    setSessionExercises(loadedSessionExercises)
    setSets(loadedSets)
    setActiveSession(active)
    setActiveExercises(active ? loadedSessionExercises
      .filter((item) => item.session_id === active.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        ...item,
        exercise: loadedExercises.find((exercise) => exercise.id === item.exercise_id)!,
        sets: loadedSets.filter((set) => set.session_exercise_id === item.id).sort((a, b) => a.set_order - b.set_order),
      }))
      .filter((item) => item.exercise) : [])
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  async function execute(action: () => Promise<void>) {
    if (working) throw new Error('Another workout action is still being saved.')
    setWorking(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      throw caught
    } finally {
      setWorking(false)
    }
  }

  async function saveExercise(draft: ExerciseDraft) {
    await execute(async () => {
      const payload = {
        user_id: userId,
        name: draft.name.trim(),
        slug: `${slugify(draft.name)}-${draft.id?.slice(0, 8) ?? crypto.randomUUID().slice(0, 8)}`,
        muscle_group: draft.muscle_group.trim().toLowerCase() || 'other',
        equipment: draft.equipment.trim().toLowerCase() || 'other',
        tracking_type: draft.tracking_type,
        notes: draft.notes.trim() || null,
        source: 'custom' as const,
        is_system: false,
        updated_at: new Date().toISOString(),
      }
      const result = draft.id
        ? await supabase.from('exercises').update(payload).eq('id', draft.id)
        : await supabase.from('exercises').insert(payload)
      if (result.error) throw result.error
      await load()
    })
  }

  async function archiveExercise(exercise: ExerciseRow) {
    await execute(async () => {
      const { error: updateError } = await supabase.from('exercises').update({ is_archived: !exercise.is_archived, updated_at: new Date().toISOString() }).eq('id', exercise.id)
      if (updateError) throw updateError
      await load()
    })
  }

  async function toggleFavorite(exercise: ExerciseRow) {
    await execute(async () => {
      const favorite = exercisePreferences.some((preference) => preference.exercise_id === exercise.id && preference.is_favorite)
      const result = favorite
        ? await supabase.from('exercise_preferences').delete().eq('user_id', userId).eq('exercise_id', exercise.id)
        : await supabase.from('exercise_preferences').upsert({ user_id: userId, exercise_id: exercise.id, is_favorite: true, updated_at: new Date().toISOString() })
      if (result.error) throw result.error
      await load()
    })
  }

  async function saveRoutine(draft: RoutineDraft) {
    await execute(async () => {
      const { data: savedTemplateId, error: saveError } = await supabase.rpc('save_workout_template', {
        p_template_id: draft.id ?? null,
        p_name: draft.name.trim(),
        p_notes: draft.notes.trim() || null,
        p_items: draft.items.map((item) => ({
          exercise_id: item.exerciseId,
          target_sets: item.sets.length,
          rep_min: minimum(item.sets.map((set) => set.targetReps)),
          rep_max: maximum(item.sets.map((set) => set.targetReps)),
          rest_seconds: item.restSeconds,
          superset_group: item.supersetGroup.trim() || null,
          notes: item.notes.trim() || null,
        })),
      })
      if (saveError) throw saveError
      const templateId = String(savedTemplateId)
      const { data: savedItems, error: itemError } = await supabase
        .from('workout_template_exercises')
        .select('*')
        .eq('template_id', templateId)
      if (itemError) throw itemError
      for (const draftItem of draft.items) {
        const savedItem = (savedItems as WorkoutTemplateExerciseRow[]).find((item) => item.exercise_id === draftItem.exerciseId)
        if (!savedItem) throw new Error('A planned exercise could not be saved.')
        const { error: clearError } = await supabase.from('workout_template_sets').delete().eq('template_exercise_id', savedItem.id)
        if (clearError) throw clearError
        const { error: setError } = await supabase.from('workout_template_sets').insert(draftItem.sets.map((set, index) => ({
          template_exercise_id: savedItem.id,
          set_order: index,
          set_type: set.setType,
          target_reps: set.targetReps,
          target_weight_kg: set.targetWeightKg,
          target_assistance_kg: set.targetAssistanceKg,
          target_duration_seconds: set.targetDurationSeconds,
          target_distance_meters: set.targetDistanceMeters,
          target_rir: set.targetRir,
        })))
        if (setError) throw setError
      }
      await load()
    })
  }

  async function startWorkout(routine?: RoutineWithItems) {
    if (activeSession) {
      setActiveOpen(true)
      return
    }
    await execute(async () => {
      const { error: startError } = await supabase.rpc('start_workout', { p_template_id: routine?.id ?? null, p_name: routine?.name ?? 'Open workout' })
      if (startError) throw startError
      await load()
      setView('overview')
      setActiveOpen(true)
    })
  }

  async function cloneRoutine(id: string) {
    await execute(async () => {
      const { error: cloneError } = await supabase.rpc('clone_workout_template', { p_template_id: id })
      if (cloneError) throw cloneError
      await load()
    })
  }

  async function deleteRoutine(id: string) {
    await execute(async () => {
      const { error: deleteError } = await supabase.from('workout_templates').delete().eq('id', id)
      if (deleteError) throw deleteError
      await load()
    })
  }

  async function addSessionExercise(exerciseId: string) {
    if (!activeSession) return
    await execute(async () => {
      const exercisePreference = exercisePreferences.find((preference) => preference.exercise_id === exerciseId)
      const { data, error: insertError } = await supabase.from('workout_session_exercises').insert({
        session_id: activeSession.id,
        exercise_id: exerciseId,
        sort_order: activeExercises.length,
        rest_seconds: exercisePreference?.rest_seconds ?? preferences.default_rest_seconds,
      }).select('*').single()
      if (insertError) throw insertError
      const { error: setsError } = await supabase.from('workout_sets').insert(Array.from({ length: 3 }, (_, index) => ({ session_exercise_id: data.id, set_order: index })))
      if (setsError) {
        await supabase.from('workout_session_exercises').delete().eq('id', data.id)
        throw setsError
      }
      await load()
    })
  }

  async function removeSessionExercise(id: string) {
    await execute(async () => {
      const { error: deleteError } = await supabase.from('workout_session_exercises').delete().eq('id', id)
      if (deleteError) throw deleteError
      await load()
    })
  }

  async function moveSessionExercise(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= activeExercises.length) return
    await execute(async () => {
      const current = activeExercises[index]
      const target = activeExercises[targetIndex]
      const [currentResult, targetResult] = await Promise.all([
        supabase.from('workout_session_exercises').update({ sort_order: targetIndex }).eq('id', current.id),
        supabase.from('workout_session_exercises').update({ sort_order: index }).eq('id', target.id),
      ])
      if (currentResult.error || targetResult.error) throw currentResult.error ?? targetResult.error
      await load()
    })
  }

  async function updateSessionExercise(id: string, patch: Partial<WorkoutSessionExerciseRow>) {
    const { error: updateError } = await supabase.from('workout_session_exercises').update(patch).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      throw updateError
    }
    setSessionExercises((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
    setActiveExercises((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function updateSet(id: string, patch: Partial<WorkoutSetRow>) {
    const { error: updateError } = await supabase.from('workout_sets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      throw updateError
    }
    setSets((current) => current.map((set) => set.id === id ? { ...set, ...patch } : set))
    setActiveExercises((current) => current.map((item) => ({ ...item, sets: item.sets.map((set) => set.id === id ? { ...set, ...patch } : set) })))
  }

  async function addSet(item: ActiveExercise, source?: WorkoutSetRow) {
    await execute(async () => {
      const { error: insertError } = await supabase.from('workout_sets').insert({
        session_exercise_id: item.id,
        set_order: item.sets.length,
        set_type: source?.set_type ?? 'working',
        reps: source?.reps ?? null,
        weight_kg: source?.weight_kg ?? null,
        assistance_kg: source?.assistance_kg ?? null,
        duration_seconds: source?.duration_seconds ?? null,
        distance_meters: source?.distance_meters ?? null,
        rir: source?.rir ?? null,
      })
      if (insertError) throw insertError
      await load()
    })
  }

  async function deleteSet(id: string) {
    await execute(async () => {
      const { error: deleteError } = await supabase.from('workout_sets').delete().eq('id', id)
      if (deleteError) throw deleteError
      await load()
    })
  }

  async function finishWorkout(status: 'completed' | 'cancelled') {
    if (!activeSession) return
    await execute(async () => {
      const { error: finishError } = await supabase.rpc('finish_workout', { p_session_id: activeSession.id, p_status: status })
      if (finishError) throw finishError
      await load()
      setView(status === 'completed' ? 'history' : 'overview')
      setActiveOpen(false)
    })
  }

  async function updateSession(id: string, patch: Partial<WorkoutSessionRow>) {
    await execute(async () => {
      const { error: updateError } = await supabase.from('workout_sessions').update(patch).eq('id', id)
      if (updateError) throw updateError
      await load()
    })
  }

  async function deleteSession(id: string) {
    await execute(async () => {
      const { error: deleteError } = await supabase.from('workout_sessions').delete().eq('id', id)
      if (deleteError) throw deleteError
      await load()
    })
  }

  function previousPerformance(exerciseId: string) {
    return findPreviousPerformance({
      exerciseId,
      activeTemplateId: activeSession?.template_id ?? null,
      scope: preferences.previous_scope,
      sessions,
      sessionExercises,
      sets,
    })
  }

  const completed = sessions.filter((session) => session.status === 'completed')
  const recentSessionIds = new Set(sessions.slice(0, 20).map((session) => session.id))
  const recentIds = new Set(sessionExercises.filter((item) => recentSessionIds.has(item.session_id)).map((item) => item.exercise_id))
  const favoriteIds = new Set(exercisePreferences.filter((preference) => preference.is_favorite).map((preference) => preference.exercise_id))
  const lastWeek = completed.filter((session) => Date.now() - new Date(session.started_at).getTime() < 7 * 86400000)
  const weeklyVolume = lastWeek.reduce((sum, session) => sum + sessionVolume(session.id, sessionExercises, sets), 0)

  if (activeSession && activeOpen) return <ActiveWorkout session={activeSession} items={activeExercises} exercises={exercises.filter((exercise) => !exercise.is_archived)} previous={previousPerformance} recentIds={recentIds} favoriteIds={favoriteIds} timerSound={preferences.timer_sound} timerVibration={preferences.timer_vibration} externalError={error} onRetryLoad={load} onAddExercise={addSessionExercise} onRemoveExercise={removeSessionExercise} onMoveExercise={moveSessionExercise} onUpdateExercise={updateSessionExercise} onUpdateSession={updateSession} onUpdateSet={updateSet} onAddSet={addSet} onDeleteSet={deleteSet} onFinish={finishWorkout} />

  return <div className="mx-auto max-w-[92rem] space-y-7">
    <AdminPageHeader eyebrow="Progressive training" title="Workout tracker" description="Build routines, track every training mode, and turn completed sets into useful progression data." actions={<Button onClick={() => activeSession ? setActiveOpen(true) : startWorkout()} disabled={working}><Play /> {activeSession ? 'Resume workout' : 'Start empty workout'}</Button>} />
    {error && <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><span className="flex-1">{error}</span><Button size="sm" variant="ghost" onClick={() => load()}><RefreshCw /> Retry</Button></div>}
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-muted/50 p-1">{([
      ['overview', Activity], ['routines', Dumbbell], ['exercises', Library], ['history', History],
    ] as const).map(([item, Icon]) => <button key={item} onClick={() => setView(item)} className={cn('flex min-w-28 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium capitalize transition-colors', view === item ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}><Icon className="size-4" />{item}</button>)}</nav>
    {loading ? <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading training data…</div> : <>
      {view === 'overview' && <Overview routines={routines} completed={completed} activeSession={activeSession} weeklyCount={lastWeek.length} weeklyVolume={weeklyVolume} exerciseCount={exercises.filter((exercise) => !exercise.is_archived).length} onStart={startWorkout} onResume={() => setActiveOpen(true)} onDiscard={() => finishWorkout('cancelled')} onOpenRoutines={() => setView('routines')} />}
      {view === 'routines' && <RoutineBuilder exercises={exercises.filter((exercise) => !exercise.is_archived)} routines={routines} onSave={saveRoutine} onStart={startWorkout} onClone={cloneRoutine} onDelete={deleteRoutine} />}
      {view === 'exercises' && <ExerciseLibrary exercises={exercises} favoriteIds={favoriteIds} recentIds={recentIds} sessions={sessions} sessionExercises={sessionExercises} sets={sets} onSave={saveExercise} onArchive={archiveExercise} onFavorite={toggleFavorite} />}
      {view === 'history' && <WorkoutHistory sessions={sessions} sessionExercises={sessionExercises} sets={sets} exercises={exercises} onUpdate={updateSession} onDelete={deleteSession} />}
    </>}
  </div>
}

function Overview({ routines, completed, activeSession, weeklyCount, weeklyVolume, exerciseCount, onStart, onResume, onDiscard, onOpenRoutines }: { routines: RoutineWithItems[]; completed: WorkoutSessionRow[]; activeSession: WorkoutSessionRow | null; weeklyCount: number; weeklyVolume: number; exerciseCount: number; onStart: (routine?: RoutineWithItems) => Promise<void>; onResume: () => void; onDiscard: () => Promise<void>; onOpenRoutines: () => void }) {
  return <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
    <div className="space-y-4">
      {activeSession && <div className="rounded-[2rem] bg-primary p-5 text-primary-foreground shadow-lg sm:p-6"><p className="text-xs opacity-70">Workout in progress · {format(new Date(activeSession.started_at), 'HH:mm')}</p><h2 className="mt-1 text-xl font-semibold">{activeSession.name}</h2><p className="mt-2 text-sm opacity-75">Your workout is saved and ready to continue.</p><div className="mt-5 grid grid-cols-[1fr_auto] gap-2"><Button variant="secondary" onClick={onResume}><Play /> Resume</Button><Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={onDiscard}><X /> Discard</Button></div></div>}
      <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Ready sessions</p><h2 className="text-xl font-semibold">Your routines</h2></div><Button variant="ghost" onClick={onOpenRoutines}><Settings2 /> Manage</Button></div><Button className="mt-5 w-full min-h-12" variant="outline" disabled={Boolean(activeSession)} onClick={() => onStart()}><Play /> Start empty workout</Button><div className="mt-3 grid gap-3 md:grid-cols-2">{routines.slice(0, 6).map((routine) => <article key={routine.id} className="rounded-2xl bg-muted/45 p-4"><Dumbbell className="size-5 text-primary" /><p className="mt-4 font-semibold">{routine.name}</p><p className="mt-1 text-xs text-muted-foreground">{routine.items.length} exercises · {routine.items.reduce((sum, item) => sum + item.sets.length, 0)} sets</p><Button className="mt-5 w-full" disabled={Boolean(activeSession)} onClick={() => onStart(routine)}><Play /> Start</Button></article>)}{!routines.length && <button className="min-h-48 rounded-2xl border border-dashed text-sm text-muted-foreground" onClick={onOpenRoutines}>Create your first routine</button>}</div></div>
    </div>
    <div className="space-y-4"><div className="rounded-[2rem] bg-primary p-6 text-primary-foreground"><p className="text-sm opacity-70">Last seven days</p><p className="mt-4 font-mono text-5xl font-semibold tracking-[-0.07em]">{weeklyCount}</p><p className="text-sm opacity-70">completed workouts</p><div className="mt-7 rounded-2xl bg-primary-foreground/10 p-4"><p className="font-mono text-2xl">{Math.round(weeklyVolume).toLocaleString()} kg</p><p className="text-xs opacity-65">recorded volume</p></div></div><div className="grid grid-cols-2 gap-3"><Stat icon={Library} value={exerciseCount} label="Exercises" /><Stat icon={Trophy} value={completed.length} label="All workouts" /></div>{completed[0] && <div className="rounded-2xl bg-card p-5 ring-1 ring-border"><p className="text-sm text-muted-foreground">Last session</p><p className="mt-2 font-semibold">{completed[0].name}</p><p className="mt-1 text-xs text-muted-foreground">{format(new Date(completed[0].started_at), 'd MMM · HH:mm')}</p></div>}</div>
  </section>
}

function Stat({ icon: Icon, value, label }: { icon: typeof Library; value: number; label: string }) {
  return <div className="rounded-2xl bg-card p-4 ring-1 ring-border"><Icon className="size-4 text-primary" /><p className="mt-3 font-mono text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'exercise'
}

function minimum(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => value !== null)
  return numbers.length ? Math.min(...numbers) : null
}

function maximum(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => value !== null)
  return numbers.length ? Math.max(...numbers) : null
}

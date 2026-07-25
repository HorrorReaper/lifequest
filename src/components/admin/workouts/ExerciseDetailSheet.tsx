'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { Activity, ExternalLink, Trophy, X } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import {
  describeSet,
  estimatedOneRepMax,
  paceSecondsPerKm,
  personalRecordLabel,
} from './analytics'

type TrendPoint = { date: string; value: number; label: string }

export function ExerciseDetailSheet({
  exercise,
  sessions,
  sessionExercises,
  sets,
  onClose,
}: {
  exercise: ExerciseRow | null
  sessions: WorkoutSessionRow[]
  sessionExercises: WorkoutSessionExerciseRow[]
  sets: WorkoutSetRow[]
  onClose: () => void
}) {
  const history = useMemo(() => {
    if (!exercise) return []
    return sessions
      .filter((session) => session.status === 'completed')
      .flatMap((session) => sessionExercises
        .filter((item) => item.session_id === session.id && item.exercise_id === exercise.id)
        .map((item) => ({
          session,
          item,
          sets: sets.filter((set) => set.session_exercise_id === item.id && set.is_complete).sort((a, b) => a.set_order - b.set_order),
        })))
      .filter((entry) => entry.sets.length > 0)
      .sort((a, b) => new Date(b.session.started_at).getTime() - new Date(a.session.started_at).getTime())
  }, [exercise, sessionExercises, sessions, sets])
  const trend = useMemo(() => {
    if (!exercise) return []
    return history.slice().reverse().map(({ session, sets: workoutSets }): TrendPoint => {
      const { value, label } = trendValue(exercise, workoutSets)
      return { date: format(new Date(session.started_at), 'd MMM'), value, label }
    })
  }, [exercise, history])
  const allSets = useMemo(() => history.flatMap((entry) => entry.sets), [history])
  if (!exercise) return null

  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45" role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title">
    <section className="h-full w-full overflow-y-auto bg-background shadow-2xl sm:max-w-2xl">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6"><div className="min-w-0 flex-1"><p className="text-xs capitalize text-muted-foreground">{exercise.target_muscle ?? exercise.muscle_group} · {exercise.equipment}</p><h2 id="exercise-detail-title" className="truncate font-semibold">{exercise.name}</h2></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close exercise detail"><X /></Button></header>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground"><Trophy className="size-5" /><p className="mt-5 text-xs opacity-70">Personal record</p><p className="mt-1 font-semibold">{personalRecordLabel(exercise, allSets)}</p></div>
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border"><Activity className="size-5 text-primary" /><p className="mt-5 text-xs text-muted-foreground">Completed history</p><p className="mt-1 font-mono text-2xl font-semibold">{history.length} workouts</p></div>
        </div>

        <section className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5">
          <div><p className="text-xs text-muted-foreground">Progress trend</p><h3 className="font-semibold">{trendMetricLabel(exercise)}</h3></div>
          {trend.length > 1 ? <div className="mt-4 h-56 w-full" aria-label={`${exercise.name} progression chart`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.25} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, _name, item) => [item.payload.label, 'Best']} />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div> : <div className="mt-4 grid min-h-40 place-items-center rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">Complete this exercise in two workouts to unlock the trend.</div>}
        </section>

        {(exercise.instructions.length > 0 || exercise.notes || exercise.attribution) && <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h3 className="font-semibold">How to perform</h3>
          {exercise.notes && <p className="mt-3 text-sm text-muted-foreground">{exercise.notes}</p>}
          {exercise.instructions.length > 0 && <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{exercise.instructions.map((instruction, index) => <li key={`${exercise.id}-${index}`}>{instruction}</li>)}</ol>}
          {exercise.attribution && <p className="mt-4 text-xs text-muted-foreground">{exercise.source_url ? <a className="inline-flex items-center gap-1 underline underline-offset-2" href={exercise.source_url} target="_blank" rel="noreferrer">{exercise.attribution}<ExternalLink className="size-3" /></a> : exercise.attribution}</p>}
        </section>}

        <section>
          <div><p className="text-xs text-muted-foreground">Set-by-set performance</p><h3 className="font-semibold">Recent history</h3></div>
          <div className="mt-3 space-y-3">{history.slice(0, 12).map(({ session, item, sets: workoutSets }) => <article key={item.id} className="rounded-2xl bg-card p-4 ring-1 ring-border"><div className="flex items-center justify-between gap-3"><p className="font-medium">{format(new Date(session.started_at), 'd MMM yyyy')}</p><span className="text-xs text-muted-foreground">{workoutSets.length} sets</span></div><div className="mt-3 flex flex-wrap gap-2">{workoutSets.map((set, index) => <span key={set.id} className="rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs">{index + 1}. {describeSet(exercise, set)}</span>)}</div>{item.notes && <p className="mt-3 text-xs text-muted-foreground">{item.notes}</p>}</article>)}</div>
          {history.length === 0 && <div className="mt-3 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No completed sets for this exercise yet.</div>}
        </section>
      </div>
    </section>
  </div>
}

function trendValue(exercise: ExerciseRow, sets: WorkoutSetRow[]) {
  switch (exercise.tracking_type) {
    case 'weight_reps': {
      const value = Math.max(...sets.map((set) => estimatedOneRepMax(set.weight_kg, set.reps)), 0)
      return { value, label: `${value.toFixed(1)} kg e1RM` }
    }
    case 'bodyweight_reps': {
      const value = Math.max(...sets.map((set) => Number(set.reps ?? 0)), 0)
      return { value, label: `${value} reps` }
    }
    case 'assisted_reps': {
      const value = Math.min(...sets.map((set) => Number(set.assistance_kg ?? 0)))
      return { value, label: `${value} kg assistance` }
    }
    case 'duration':
    case 'weight_duration': {
      const value = Math.max(...sets.map((set) => Number(set.duration_seconds ?? 0)), 0)
      return { value, label: `${value} seconds` }
    }
    case 'distance_duration': {
      const paces = sets.map((set) => paceSecondsPerKm(set.distance_meters, set.duration_seconds)).filter((value): value is number => value !== null)
      const value = paces.length ? Math.min(...paces) : 0
      return { value, label: `${Math.round(value)} sec/km` }
    }
  }
}

function trendMetricLabel(exercise: ExerciseRow) {
  switch (exercise.tracking_type) {
    case 'weight_reps': return 'Estimated one-rep max'
    case 'bodyweight_reps': return 'Best repetitions'
    case 'assisted_reps': return 'Lowest assistance'
    case 'duration':
    case 'weight_duration': return 'Longest duration'
    case 'distance_duration': return 'Fastest pace'
  }
}

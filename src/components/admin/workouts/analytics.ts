import type {
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSetRow,
} from '@/lib/supabase/database.types'

export type SetMetrics = Pick<
  WorkoutSetRow,
  'reps' | 'weight_kg' | 'assistance_kg' | 'duration_seconds' | 'distance_meters'
>

export function setVolume(set: SetMetrics) {
  return Math.max(0, Number(set.weight_kg ?? 0)) * Math.max(0, Number(set.reps ?? 0))
}

export function estimatedOneRepMax(weightKg: number | null, reps: number | null) {
  if (!weightKg || !reps || weightKg < 0 || reps < 1) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + Math.min(reps, 30) / 30)
}

export function paceSecondsPerKm(distanceMeters: number | null, durationSeconds: number | null) {
  if (!distanceMeters || !durationSeconds || distanceMeters <= 0 || durationSeconds <= 0) return null
  return durationSeconds / (distanceMeters / 1000)
}

export function formatDuration(totalSeconds: number | null) {
  const seconds = Math.max(0, Math.round(totalSeconds ?? 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`
}

export function formatPace(distanceMeters: number | null, durationSeconds: number | null) {
  const pace = paceSecondsPerKm(distanceMeters, durationSeconds)
  return pace ? `${formatDuration(pace)} /km` : '—'
}

export function describeSet(exercise: ExerciseRow, set: SetMetrics) {
  const reps = Number(set.reps ?? 0)
  const weight = Number(set.weight_kg ?? 0)
  const assistance = Number(set.assistance_kg ?? 0)
  const duration = Number(set.duration_seconds ?? 0)
  const distance = Number(set.distance_meters ?? 0)

  switch (exercise.tracking_type) {
    case 'weight_reps':
      return `${weight || '—'} kg × ${reps || '—'}`
    case 'bodyweight_reps':
      return `${reps || '—'} reps${weight ? ` · +${weight} kg` : ''}`
    case 'assisted_reps':
      return `${reps || '—'} reps · ${assistance || '—'} kg assist`
    case 'duration':
      return formatDuration(duration)
    case 'distance_duration':
      return `${distance ? (distance / 1000).toFixed(2) : '—'} km · ${formatDuration(duration)}`
    case 'weight_duration':
      return `${weight || '—'} kg · ${formatDuration(duration)}`
  }
}

export function personalRecordLabel(exercise: ExerciseRow, sets: WorkoutSetRow[]) {
  const complete = sets.filter((set) => set.is_complete)
  if (!complete.length) return 'No completed sets yet'

  if (exercise.tracking_type === 'weight_reps') {
    const best = complete.reduce((winner, set) =>
      estimatedOneRepMax(set.weight_kg, set.reps) > estimatedOneRepMax(winner.weight_kg, winner.reps) ? set : winner
    )
    return `Best e1RM ${estimatedOneRepMax(best.weight_kg, best.reps).toFixed(1)} kg`
  }
  if (exercise.tracking_type === 'assisted_reps') {
    const best = [...complete].sort((a, b) =>
      Number(b.reps ?? 0) - Number(a.reps ?? 0) || Number(a.assistance_kg ?? 0) - Number(b.assistance_kg ?? 0)
    )[0]
    return `${best.reps ?? 0} reps at ${best.assistance_kg ?? 0} kg assist`
  }
  if (exercise.tracking_type === 'distance_duration') {
    const longest = Math.max(...complete.map((set) => Number(set.distance_meters ?? 0)))
    const paces = complete
      .map((set) => paceSecondsPerKm(set.distance_meters, set.duration_seconds))
      .filter((pace): pace is number => pace !== null)
    return `${(longest / 1000).toFixed(2)} km · best pace ${paces.length ? formatDuration(Math.min(...paces)) : '—'} /km`
  }
  if (exercise.tracking_type === 'duration' || exercise.tracking_type === 'weight_duration') {
    const longest = Math.max(...complete.map((set) => Number(set.duration_seconds ?? 0)))
    return `Longest ${formatDuration(longest)}`
  }
  const mostReps = Math.max(...complete.map((set) => Number(set.reps ?? 0)))
  const extraWeight = Math.max(...complete.map((set) => Number(set.weight_kg ?? 0)))
  return `Best ${mostReps} reps${extraWeight ? ` · +${extraWeight} kg` : ''}`
}

export function sessionVolume(
  sessionId: string,
  sessionExercises: WorkoutSessionExerciseRow[],
  sets: WorkoutSetRow[],
) {
  const exerciseIds = new Set(sessionExercises.filter((item) => item.session_id === sessionId).map((item) => item.id))
  return sets
    .filter((set) => exerciseIds.has(set.session_exercise_id) && set.is_complete)
    .reduce((total, set) => total + setVolume(set), 0)
}

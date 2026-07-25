import type {
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/lib/supabase/database.types'

export type ExerciseFilter = {
  query: string
  muscle: string
  equipment: string
  scope: 'all' | 'recent' | 'favorites'
}

export function filterExerciseCatalog(
  exercises: ExerciseRow[],
  filter: ExerciseFilter,
  recentIds: ReadonlySet<string>,
  favoriteIds: ReadonlySet<string>,
) {
  const query = filter.query.trim().toLocaleLowerCase()
  return exercises.filter((exercise) => {
    const searchable = [
      exercise.name,
      exercise.target_muscle,
      exercise.muscle_group,
      exercise.equipment,
      ...exercise.secondary_muscles,
      ...exercise.aliases,
    ].filter(Boolean).join(' ').toLocaleLowerCase()

    return !exercise.is_archived
      && (!query || searchable.includes(query))
      && (filter.muscle === 'all' || exercise.muscle_group === filter.muscle)
      && (filter.equipment === 'all' || exercise.equipment === filter.equipment)
      && (filter.scope === 'all'
        || (filter.scope === 'recent' ? recentIds.has(exercise.id) : favoriteIds.has(exercise.id)))
  })
}

export type PreviousPerformance = {
  performedAt: string | null
  sets: WorkoutSetRow[]
}

export function findPreviousPerformance({
  exerciseId,
  activeTemplateId,
  scope,
  sessions,
  sessionExercises,
  sets,
}: {
  exerciseId: string
  activeTemplateId: string | null
  scope: 'same_template' | 'any_workout'
  sessions: WorkoutSessionRow[]
  sessionExercises: WorkoutSessionExerciseRow[]
  sets: WorkoutSetRow[]
}): PreviousPerformance {
  const candidates = sessions
    .filter((session) =>
      session.status === 'completed'
      && (scope === 'any_workout' || session.template_id === activeTemplateId)
    )
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  for (const session of candidates) {
    const occurrence = sessionExercises.find((item) =>
      item.session_id === session.id && item.exercise_id === exerciseId
    )
    if (!occurrence) continue
    const completed = sets
      .filter((set) => set.session_exercise_id === occurrence.id && set.is_complete)
      .sort((a, b) => a.set_order - b.set_order)
    if (completed.length) return { performedAt: session.started_at, sets: completed }
  }

  return { performedAt: null, sets: [] }
}

export type PlateBreakdown = {
  platesPerSide: Array<{ weightKg: number; count: number }>
  remainderKg: number
  loadableKg: number
}

export function calculatePlateBreakdown(
  targetKg: number,
  barKg: number,
  availablePlates: number[] = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
): PlateBreakdown {
  const safeTarget = Math.max(0, targetKg)
  const safeBar = Math.max(0, barKg)
  let perSide = Math.max(0, (safeTarget - safeBar) / 2)
  const platesPerSide: PlateBreakdown['platesPerSide'] = []

  for (const plate of [...availablePlates].filter((value) => value > 0).sort((a, b) => b - a)) {
    const count = Math.floor((perSide + 1e-8) / plate)
    if (count > 0) {
      platesPerSide.push({ weightKg: plate, count })
      perSide -= count * plate
    }
  }

  const remainderKg = Math.max(0, perSide * 2)
  return {
    platesPerSide,
    remainderKg,
    loadableKg: safeTarget - remainderKg,
  }
}

export function secondsUntil(deadline: number | null, now = Date.now()) {
  if (deadline === null) return null
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

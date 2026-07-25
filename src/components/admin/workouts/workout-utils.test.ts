import { describe, expect, it } from 'vitest'
import type {
  ExerciseRow,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/lib/supabase/database.types'
import {
  calculatePlateBreakdown,
  filterExerciseCatalog,
  findPreviousPerformance,
  secondsUntil,
} from './workout-utils'

const exercise = (id: string, name: string, muscle = 'chest'): ExerciseRow => ({
  id,
  user_id: null,
  name,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  muscle_group: muscle,
  target_muscle: muscle,
  secondary_muscles: [],
  equipment: 'barbell',
  tracking_type: 'weight_reps',
  instructions: [],
  aliases: [],
  notes: null,
  is_archived: false,
  is_system: true,
  source: 'system',
  catalog_source: null,
  catalog_external_id: null,
  source_version: null,
  source_url: null,
  attribution: null,
  created_at: '',
  updated_at: '',
})

const session = (id: string, startedAt: string, templateId = 'routine'): WorkoutSessionRow => ({
  id,
  user_id: 'user',
  template_id: templateId,
  name: 'Workout',
  status: 'completed',
  started_at: startedAt,
  ended_at: startedAt,
  duration_seconds: 1000,
  notes: null,
  created_at: startedAt,
  updated_at: startedAt,
})

const occurrence = (id: string, sessionId: string): WorkoutSessionExerciseRow => ({
  id,
  session_id: sessionId,
  exercise_id: 'bench',
  sort_order: 0,
  is_complete: true,
  superset_group: null,
  rest_seconds: 120,
  notes: null,
  created_at: '',
})

const set = (id: string, occurrenceId: string, order: number): WorkoutSetRow => ({
  id,
  session_exercise_id: occurrenceId,
  set_order: order,
  set_type: 'working',
  reps: 8,
  weight_kg: 100 + order,
  assistance_kg: null,
  duration_seconds: null,
  distance_meters: null,
  rir: 2,
  is_complete: true,
  completed_at: '',
  created_at: '',
  updated_at: '',
})

describe('workout utilities', () => {
  it('filters a large exercise catalog by metadata and scope', () => {
    const exercises = [exercise('bench', 'Bench press'), exercise('squat', 'Back squat', 'quadriceps')]
    expect(filterExerciseCatalog(exercises, {
      query: 'quad',
      muscle: 'all',
      equipment: 'all',
      scope: 'all',
    }, new Set(), new Set()).map((item) => item.id)).toEqual(['squat'])
    expect(filterExerciseCatalog(exercises, {
      query: '',
      muscle: 'all',
      equipment: 'all',
      scope: 'favorites',
    }, new Set(), new Set(['bench'])).map((item) => item.id)).toEqual(['bench'])
  })

  it('returns set-aligned values from the latest eligible workout', () => {
    const older = session('older', '2026-07-01T10:00:00Z')
    const latest = session('latest', '2026-07-20T10:00:00Z')
    const olderOccurrence = occurrence('old-item', older.id)
    const latestOccurrence = occurrence('new-item', latest.id)
    const result = findPreviousPerformance({
      exerciseId: 'bench',
      activeTemplateId: 'routine',
      scope: 'same_template',
      sessions: [older, latest],
      sessionExercises: [olderOccurrence, latestOccurrence],
      sets: [
        set('old-set', olderOccurrence.id, 0),
        set('new-set-2', latestOccurrence.id, 1),
        set('new-set-1', latestOccurrence.id, 0),
      ],
    })
    expect(result.performedAt).toBe(latest.started_at)
    expect(result.sets.map((item) => item.id)).toEqual(['new-set-1', 'new-set-2'])
  })

  it('calculates metric plates per side and reports impossible remainder', () => {
    expect(calculatePlateBreakdown(100, 20).platesPerSide).toEqual([
      { weightKg: 25, count: 1 },
      { weightKg: 15, count: 1 },
    ])
    expect(calculatePlateBreakdown(101, 20, [20, 5, 2.5])).toMatchObject({
      loadableKg: 100,
      remainderKg: 1,
    })
  })

  it('derives timer state from an absolute deadline', () => {
    expect(secondsUntil(12_500, 10_000)).toBe(3)
    expect(secondsUntil(9_000, 10_000)).toBe(0)
    expect(secondsUntil(null, 10_000)).toBeNull()
  })
})

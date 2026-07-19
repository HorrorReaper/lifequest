import { describe, expect, it } from 'vitest'
import type { ExerciseRow, WorkoutSetRow } from '@/lib/supabase/database.types'
import { estimatedOneRepMax, formatPace, paceSecondsPerKm, personalRecordLabel, setVolume } from './analytics'

const baseSet = {
  id: 'set',
  session_exercise_id: 'exercise',
  set_order: 0,
  set_type: 'working',
  reps: 10,
  weight_kg: 100,
  assistance_kg: null,
  duration_seconds: null,
  distance_meters: null,
  rir: 1,
  is_complete: true,
  completed_at: '2026-07-19T08:00:00Z',
  created_at: '2026-07-19T08:00:00Z',
  updated_at: '2026-07-19T08:00:00Z',
} satisfies WorkoutSetRow

const exercise = {
  id: 'exercise',
  user_id: null,
  name: 'Bench press',
  slug: 'bench-press',
  muscle_group: 'chest',
  secondary_muscles: [],
  equipment: 'barbell',
  tracking_type: 'weight_reps',
  instructions: [],
  aliases: [],
  notes: null,
  is_archived: false,
  is_system: true,
  source: 'system',
  created_at: '',
  updated_at: '',
} satisfies ExerciseRow

describe('workout analytics', () => {
  it('calculates volume and Epley estimated one-rep max', () => {
    expect(setVolume(baseSet)).toBe(1000)
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 1)
  })

  it('calculates and formats running pace', () => {
    expect(paceSecondsPerKm(5000, 1500)).toBe(300)
    expect(formatPace(5000, 1500)).toBe('5:00 /km')
  })

  it('describes the best record for a weight-and-reps exercise', () => {
    expect(personalRecordLabel(exercise, [baseSet])).toContain('133.3 kg')
  })
})

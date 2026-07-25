import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ExerciseTrackingType } from '@/lib/supabase/database.types'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260725095954_import_exercises_dataset_metadata.sql'),
  'utf8'
)
const payload = migration.match(/\$exercise_dataset_7455efae\$([\s\S]+)\$exercise_dataset_7455efae\$/)?.[1]

if (!payload) throw new Error('Exercise dataset payload is missing from the generated migration.')

type ImportedExercise = {
  external_id: string
  name: string
  slug: string
  muscle_group: string
  target_muscle: string
  secondary_muscles: string[]
  equipment: string
  tracking_type: ExerciseTrackingType
  instructions: string[]
  aliases: string[]
}

const exercises = JSON.parse(payload) as ImportedExercise[]
const validTrackingTypes = new Set<ExerciseTrackingType>([
  'weight_reps',
  'bodyweight_reps',
  'assisted_reps',
  'duration',
  'distance_duration',
  'weight_duration',
])

describe('metadata-only exercise dataset migration', () => {
  it('pins and imports all 1,324 source records with unique identities', () => {
    expect(exercises).toHaveLength(1324)
    expect(new Set(exercises.map((exercise) => exercise.external_id)).size).toBe(1324)
    expect(new Set(exercises.map((exercise) => exercise.slug)).size).toBe(1324)
    expect(migration).toContain('7455efae41b330c265e7cd4b78dfa848e7ce5ebd')
    expect(migration).toContain('656634224b8977b99a6d765470ee123260d4979715eaa4e7c0b7c8bb0d79f93d')
  })

  it('contains useful searchable metadata and supported tracking modes', () => {
    for (const exercise of exercises) {
      expect(exercise.name.length).toBeGreaterThan(0)
      expect(exercise.target_muscle.length).toBeGreaterThan(0)
      expect(exercise.instructions.length).toBeGreaterThan(0)
      expect(validTrackingTypes.has(exercise.tracking_type)).toBe(true)
    }
    expect(exercises.some((exercise) => exercise.tracking_type === 'assisted_reps')).toBe(true)
    expect(exercises.some((exercise) => exercise.tracking_type === 'duration')).toBe(true)
    expect(exercises.some((exercise) => exercise.tracking_type === 'distance_duration')).toBe(true)
  })

  it('excludes separately licensed media from the application payload', () => {
    for (const exercise of exercises) {
      expect(exercise).not.toHaveProperty('image')
      expect(exercise).not.toHaveProperty('gif_url')
      expect(exercise).not.toHaveProperty('media_id')
    }
    expect(migration).not.toContain('gymvisual.com')
    expect(migration).not.toMatch(/"gif_url"|"image"|"media_id"/)
  })

  it('adds provenance, deduplication, and a post-import count guard', () => {
    expect(migration).toContain('exercises_catalog_external_id_idx')
    expect(migration).toContain("catalog_source = 'hasaneyldrm/exercises-dataset'")
    expect(migration).toContain('on conflict (slug) where is_system')
    expect(migration).toContain("<> 1324 then")
  })
})

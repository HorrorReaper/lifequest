import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ExerciseRow } from '@/lib/supabase/database.types'
import { ExerciseLibrary } from './ExerciseLibrary'

const exercise = (id: string, name: string, muscle: string): ExerciseRow => ({
  id,
  user_id: null,
  name,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  muscle_group: muscle,
  target_muscle: muscle,
  secondary_muscles: [],
  equipment: 'barbell',
  tracking_type: 'weight_reps',
  instructions: ['Controlled technique.'],
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

afterEach(cleanup)

describe('ExerciseLibrary', () => {
  it('filters the catalog by search text', async () => {
    const user = userEvent.setup()
    render(<ExerciseLibrary exercises={[exercise('1', 'Bench Press', 'chest'), exercise('2', 'Back Squat', 'quadriceps')]} favoriteIds={new Set()} recentIds={new Set()} onSave={vi.fn()} onArchive={vi.fn()} onFavorite={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search exercises'), 'bench')
    expect(screen.getByText('Bench Press')).toBeTruthy()
    expect(screen.queryByText('Back Squat')).toBeNull()
  })

  it('searches imported muscle metadata and shows instructions with attribution', async () => {
    const user = userEvent.setup()
    const imported = {
      ...exercise('1', 'Incline Press', 'pectorals'),
      target_muscle: 'pectorals',
      secondary_muscles: ['triceps'],
      instructions: ['Set the bench to an incline.', 'Press with control.'],
      catalog_source: 'hasaneyldrm/exercises-dataset',
      catalog_external_id: '0042',
      source_version: '7455efae',
      source_url: 'https://github.com/hasaneyldrm/exercises-dataset',
      attribution: 'Exercise metadata and instructions · MIT License',
    } satisfies ExerciseRow

    render(<ExerciseLibrary exercises={[imported]} favoriteIds={new Set()} recentIds={new Set()} onSave={vi.fn()} onArchive={vi.fn()} onFavorite={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search exercises'), 'triceps')
    expect(screen.getByText('Incline Press')).toBeTruthy()
    expect(screen.getByText('OPEN DATA')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /details/i }))
    expect(screen.getByText('Press with control.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /MIT License/i }).getAttribute('href')).toBe(imported.source_url)
  })
})

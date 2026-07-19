import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ExerciseRow } from '@/lib/supabase/database.types'
import { ExerciseLibrary } from './ExerciseLibrary'

const exercise = (id: string, name: string, muscle: string): ExerciseRow => ({
  id,
  user_id: null,
  name,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  muscle_group: muscle,
  secondary_muscles: [],
  equipment: 'barbell',
  tracking_type: 'weight_reps',
  instructions: ['Controlled technique.'],
  aliases: [],
  notes: null,
  is_archived: false,
  is_system: true,
  source: 'system',
  created_at: '',
  updated_at: '',
})

describe('ExerciseLibrary', () => {
  it('filters the catalog by search text', async () => {
    const user = userEvent.setup()
    render(<ExerciseLibrary exercises={[exercise('1', 'Bench Press', 'chest'), exercise('2', 'Back Squat', 'quadriceps')]} favoriteIds={new Set()} recentIds={new Set()} onSave={vi.fn()} onArchive={vi.fn()} onFavorite={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search exercises'), 'bench')
    expect(screen.getByText('Bench Press')).toBeTruthy()
    expect(screen.queryByText('Back Squat')).toBeNull()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  ExerciseRow,
  ExerciseTrackingType,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/lib/supabase/database.types'
import { ActiveWorkout, type ActiveExercise } from './ActiveWorkout'

const session: WorkoutSessionRow = {
  id: 'session',
  user_id: 'user',
  template_id: 'template',
  name: 'Push day',
  status: 'active',
  started_at: new Date().toISOString(),
  ended_at: null,
  duration_seconds: null,
  notes: null,
  created_at: '',
  updated_at: '',
}

const makeExercise = (id: string, trackingType: ExerciseTrackingType): ExerciseRow => ({
  id,
  user_id: null,
  name: id,
  slug: id,
  muscle_group: 'full body',
  target_muscle: 'full body',
  secondary_muscles: [],
  equipment: 'other',
  tracking_type: trackingType,
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

const makeSet = (id: string, occurrenceId: string): WorkoutSetRow => ({
  id,
  session_exercise_id: occurrenceId,
  set_order: 0,
  set_type: 'working',
  reps: null,
  weight_kg: null,
  assistance_kg: null,
  duration_seconds: null,
  distance_meters: null,
  rir: null,
  is_complete: false,
  completed_at: null,
  created_at: '',
  updated_at: '',
})

const makeItem = (trackingType: ExerciseTrackingType, index: number): ActiveExercise => {
  const id = `item-${index}`
  const exercise = makeExercise(trackingType, trackingType)
  const row: WorkoutSessionExerciseRow = {
    id,
    session_id: session.id,
    exercise_id: exercise.id,
    sort_order: index,
    is_complete: false,
    superset_group: index < 2 ? 'A' : null,
    rest_seconds: 120,
    notes: null,
    created_at: '',
  }
  return { ...row, exercise, sets: [makeSet(`set-${index}`, id)] }
}

afterEach(cleanup)

function renderWorkout(items: ActiveExercise[], overrides: Partial<React.ComponentProps<typeof ActiveWorkout>> = {}) {
  const props: React.ComponentProps<typeof ActiveWorkout> = {
    session,
    items,
    exercises: items.map((item) => item.exercise),
    previous: () => ({ performedAt: null, sets: [] }),
    recentIds: new Set(),
    favoriteIds: new Set(),
    timerSound: false,
    timerVibration: false,
    externalError: null,
    onRetryLoad: vi.fn(),
    onAddExercise: vi.fn(),
    onRemoveExercise: vi.fn(),
    onMoveExercise: vi.fn(),
    onUpdateExercise: vi.fn(),
    onUpdateSession: vi.fn(),
    onUpdateSet: vi.fn(),
    onAddSet: vi.fn(),
    onDeleteSet: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  }
  render(<ActiveWorkout {...props} />)
  return props
}

describe('ActiveWorkout', () => {
  it('renders inputs for every supported tracking mode and superset grouping', () => {
    const modes: ExerciseTrackingType[] = ['weight_reps', 'bodyweight_reps', 'assisted_reps', 'duration', 'distance_duration', 'weight_duration']
    renderWorkout(modes.map(makeItem))
    expect(screen.getAllByText('SUPERSET A')).toHaveLength(2)
    expect(screen.getAllByText('Assist kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Meters').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Seconds').length).toBeGreaterThan(0)
    expect(screen.getAllByText('RIR').length).toBeGreaterThan(0)
  })

  it('flushes dirty set values before finishing', async () => {
    const user = userEvent.setup()
    const onUpdateSet = vi.fn().mockResolvedValue(undefined)
    const onFinish = vi.fn().mockResolvedValue(undefined)
    renderWorkout([makeItem('weight_reps', 0)], { onUpdateSet, onFinish })
    const weight = screen.getByLabelText('kg')
    await user.type(weight, '100')
    await user.click(screen.getByRole('button', { name: /^finish$/i }))
    await waitFor(() => expect(onUpdateSet).toHaveBeenCalledWith('set-0', expect.objectContaining({ weight_kg: 100 })))
    expect(onFinish).toHaveBeenCalledWith('completed')
  })

  it('retains a failed draft and exposes a working retry before finish', async () => {
    const user = userEvent.setup()
    const onUpdateSet = vi.fn().mockRejectedValue(new Error('Offline'))
    const onFinish = vi.fn().mockResolvedValue(undefined)
    renderWorkout([makeItem('weight_reps', 0)], { onUpdateSet, onFinish })
    await user.type(screen.getByLabelText('kg'), '80')
    await user.click(screen.getByRole('button', { name: /^finish$/i }))
    expect(await screen.findByText('Offline')).toBeTruthy()
    expect(onFinish).not.toHaveBeenCalled()
    expect((screen.getByLabelText('kg') as HTMLInputElement).value).toBe('80')
    onUpdateSet.mockResolvedValue(undefined)
    await user.click(screen.getAllByRole('button', { name: /retry/i })[0])
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith('completed'))
  })
})

'use client'

import { useMemo, useState } from 'react'
import { Check, Dumbbell, Heart, Search, X } from 'lucide-react'
import type { ExerciseRow } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { filterExerciseCatalog } from './workout-utils'

export function ExercisePicker({
  open,
  exercises,
  excludedIds,
  recentIds,
  favoriteIds,
  onClose,
  onSelect,
}: {
  open: boolean
  exercises: ExerciseRow[]
  excludedIds?: ReadonlySet<string>
  recentIds: ReadonlySet<string>
  favoriteIds: ReadonlySet<string>
  onClose: () => void
  onSelect: (exerciseId: string) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('all')
  const [equipment, setEquipment] = useState('all')
  const [scope, setScope] = useState<'all' | 'recent' | 'favorites'>(() => recentIds.size ? 'recent' : 'all')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const muscles = useMemo(() => [...new Set(exercises.map((item) => item.muscle_group))].sort(), [exercises])
  const equipmentOptions = useMemo(() => [...new Set(exercises.map((item) => item.equipment))].sort(), [exercises])
  const available = useMemo(
    () => exercises.filter((exercise) => !excludedIds?.has(exercise.id)),
    [excludedIds, exercises],
  )
  const filtered = useMemo(() => filterExerciseCatalog(
    available,
    { query, muscle, equipment, scope },
    recentIds,
    favoriteIds,
  ), [available, equipment, favoriteIds, muscle, query, recentIds, scope])

  if (!open) return null

  return <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-labelledby="exercise-picker-title">
    <header className="border-b bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close exercise picker"><X /></Button>
        <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{exercises.length.toLocaleString()} exercises available</p><h2 id="exercise-picker-title" className="font-semibold">Add exercise</h2></div>
      </div>
    </header>
    <div className="border-b bg-background px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-3">
        <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus className="h-12 pl-10" value={query} onChange={(event) => { setQuery(event.target.value); setScope('all') }} placeholder="Search exercise, muscle or equipment" /></label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['recent', 'favorites', 'all'] as const).map((item) => <button key={item} onClick={() => setScope(item)} className={cn('min-h-10 shrink-0 rounded-full px-4 text-sm font-medium capitalize', scope === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{item}</button>)}
          <Filter value={muscle} onChange={setMuscle} options={muscles} label="All muscles" />
          <Filter value={equipment} onChange={setEquipment} options={equipmentOptions} label="All equipment" />
        </div>
        {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      </div>
    </div>
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-4xl divide-y rounded-2xl bg-card ring-1 ring-border">
        {filtered.map((exercise) => <button
          key={exercise.id}
          className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/55 disabled:opacity-60"
          disabled={addingId !== null}
          onClick={async () => {
            setAddingId(exercise.id)
            setError(null)
            try {
              await onSelect(exercise.id)
              onClose()
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : 'Exercise could not be added.')
            } finally {
              setAddingId(null)
            }
          }}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Dumbbell className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-medium">{exercise.name}</span><span className="mt-1 block truncate text-xs capitalize text-muted-foreground">{exercise.target_muscle ?? exercise.muscle_group} · {exercise.equipment} · {exercise.tracking_type.replaceAll('_', ' ')}</span></span>
          {favoriteIds.has(exercise.id) && <Heart className="size-4 fill-current text-rose-500" aria-label="Favorite" />}
          {addingId === exercise.id && <Check className="size-4 text-primary" />}
        </button>)}
        {filtered.length === 0 && <div className="grid min-h-52 place-items-center p-8 text-center text-sm text-muted-foreground">No available exercises match these filters.</div>}
      </div>
    </main>
  </div>
}

function Filter({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return <select className="h-10 shrink-0 rounded-full border bg-background px-3 text-sm capitalize" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
    <option value="all">{label}</option>
    {options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
  </select>
}

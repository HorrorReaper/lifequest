'use client'

import { useMemo, useState } from 'react'
import { Activity, Archive, ChevronDown, ExternalLink, Heart, Pencil, Plus, Search, X } from 'lucide-react'
import type {
  ExerciseRow,
  ExerciseTrackingType,
  WorkoutSessionExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'

export type ExerciseDraft = {
  id?: string
  name: string
  muscle_group: string
  equipment: string
  tracking_type: ExerciseTrackingType
  notes: string
}

const blank: ExerciseDraft = {
  name: '',
  muscle_group: 'other',
  equipment: 'other',
  tracking_type: 'weight_reps',
  notes: '',
}

const PAGE_SIZE = 60

export function ExerciseLibrary({
  exercises,
  favoriteIds,
  recentIds,
  sessions = [],
  sessionExercises = [],
  sets = [],
  onSave,
  onArchive,
  onFavorite,
}: {
  exercises: ExerciseRow[]
  favoriteIds: Set<string>
  recentIds: Set<string>
  sessions?: WorkoutSessionRow[]
  sessionExercises?: WorkoutSessionExerciseRow[]
  sets?: WorkoutSetRow[]
  onSave: (draft: ExerciseDraft) => Promise<void>
  onArchive: (exercise: ExerciseRow) => Promise<void>
  onFavorite: (exercise: ExerciseRow) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('all')
  const [equipment, setEquipment] = useState('all')
  const [tracking, setTracking] = useState('all')
  const [special, setSpecial] = useState<'all' | 'favorites' | 'recent'>('all')
  const [draft, setDraft] = useState<ExerciseDraft | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailExercise, setDetailExercise] = useState<ExerciseRow | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [saving, setSaving] = useState(false)

  const muscles = useMemo(() => [...new Set(exercises.map((exercise) => exercise.muscle_group))].sort(), [exercises])
  const equipmentOptions = useMemo(() => [...new Set(exercises.map((exercise) => exercise.equipment))].sort(), [exercises])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return exercises.filter((exercise) => {
      const searchable = [
        exercise.name,
        exercise.target_muscle,
        exercise.muscle_group,
        exercise.equipment,
        ...exercise.secondary_muscles,
        ...exercise.aliases,
      ].filter(Boolean).join(' ').toLowerCase()
      return (!needle || searchable.includes(needle))
        && (muscle === 'all' || exercise.muscle_group === muscle)
        && (equipment === 'all' || exercise.equipment === equipment)
        && (tracking === 'all' || exercise.tracking_type === tracking)
        && (special === 'all' || (special === 'favorites' ? favoriteIds.has(exercise.id) : recentIds.has(exercise.id)))
    })
  }, [equipment, exercises, favoriteIds, muscle, query, recentIds, special, tracking])
  const visibleExercises = filtered.slice(0, visibleCount)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft?.name.trim() || saving) return
    setSaving(true)
    try {
      await onSave(draft)
      setDraft(null)
    } finally {
      setSaving(false)
    }
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-muted-foreground">{filtered.length} of {exercises.length} exercises</p><h2 className="text-xl font-semibold">Exercise library</h2></div>
      <Button onClick={() => setDraft(blank)}><Plus /> Custom exercise</Button>
    </div>
    <div className="grid gap-2 rounded-2xl bg-card p-3 ring-1 ring-border md:grid-cols-[minmax(12rem,1fr)_repeat(4,auto)]">
      <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" /></label>
      <Filter value={muscle} onChange={setMuscle} options={muscles} label="All muscles" />
      <Filter value={equipment} onChange={setEquipment} options={equipmentOptions} label="All equipment" />
      <Filter value={tracking} onChange={setTracking} options={trackingTypes} label="All modes" />
      <select className="h-10 rounded-md border bg-background px-3 text-sm" value={special} onChange={(event) => setSpecial(event.target.value as typeof special)}>
        <option value="all">All exercises</option><option value="favorites">Favorites</option><option value="recent">Recent</option>
      </select>
    </div>
    {draft && <form onSubmit={submit} className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center justify-between"><h3 className="font-semibold">{draft.id ? 'Edit custom exercise' : 'New custom exercise'}</h3><Button type="button" size="icon" variant="ghost" onClick={() => setDraft(null)}><X /></Button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Exercise name" required />
        <Input value={draft.muscle_group} onChange={(event) => setDraft({ ...draft, muscle_group: event.target.value })} placeholder="Primary muscle" />
        <Input value={draft.equipment} onChange={(event) => setDraft({ ...draft, equipment: event.target.value })} placeholder="Equipment" />
        <Filter value={draft.tracking_type} onChange={(value) => setDraft({ ...draft, tracking_type: value as ExerciseTrackingType })} options={trackingTypes} label="Tracking mode" />
      </div>
      <Input className="mt-3" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Optional coaching notes" />
      <Button className="mt-4" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save exercise'}</Button>
    </form>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {visibleExercises.map((exercise) => <article key={exercise.id} className={cn('rounded-2xl bg-card p-4 ring-1 ring-border', exercise.is_archived && 'opacity-55')}>
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{exercise.name}</h3>{exercise.is_system && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{exercise.catalog_source ? 'OPEN DATA' : 'SYSTEM'}</span>}</div><p className="mt-1 text-xs capitalize text-muted-foreground">{exercise.target_muscle ?? exercise.muscle_group} · {exercise.equipment} · {trackingLabel(exercise.tracking_type)}</p></div>
          <Button size="icon" variant="ghost" onClick={() => onFavorite(exercise)} aria-label="Favorite exercise"><Heart className={cn(favoriteIds.has(exercise.id) && 'fill-current text-rose-500')} /></Button>
        </div>
        {exercise.instructions[0] && <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{exercise.instructions[0]}</p>}
        {expandedId === exercise.id && <div className="mt-4 space-y-3 border-t pt-4 text-xs">
          {exercise.secondary_muscles.length > 0 && <p className="capitalize text-muted-foreground"><span className="font-medium text-foreground">Also trains:</span> {exercise.secondary_muscles.join(', ')}</p>}
          {exercise.instructions.length > 0 && <ol className="list-decimal space-y-2 pl-5 leading-5 text-muted-foreground">{exercise.instructions.map((instruction, index) => <li key={`${exercise.id}-${index}`}>{instruction}</li>)}</ol>}
          {exercise.attribution && <p className="leading-5 text-muted-foreground">{exercise.source_url ? <a className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground" href={exercise.source_url} target="_blank" rel="noreferrer">{exercise.attribution}<ExternalLink className="size-3" /></a> : exercise.attribution}</p>}
        </div>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailExercise(exercise)}><Activity /> Progress</Button>
          {(exercise.instructions.length > 0 || exercise.attribution) && <Button size="sm" variant="ghost" aria-expanded={expandedId === exercise.id} onClick={() => setExpandedId(expandedId === exercise.id ? null : exercise.id)}>Details <ChevronDown className={cn('transition-transform', expandedId === exercise.id && 'rotate-180')} /></Button>}
          {!exercise.is_system && <><Button size="sm" variant="outline" onClick={() => setDraft({ id: exercise.id, name: exercise.name, muscle_group: exercise.muscle_group, equipment: exercise.equipment, tracking_type: exercise.tracking_type, notes: exercise.notes ?? '' })}><Pencil /> Edit</Button><Button size="sm" variant="ghost" onClick={() => onArchive(exercise)}><Archive /> {exercise.is_archived ? 'Restore' : 'Archive'}</Button></>}
        </div>
      </article>)}
    </div>
    {filtered.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No exercises match these filters.</div>}
    {visibleCount < filtered.length && <div className="flex justify-center"><Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more</Button></div>}
    <ExerciseDetailSheet exercise={detailExercise} sessions={sessions} sessionExercises={sessionExercises} sets={sets} onClose={() => setDetailExercise(null)} />
  </section>
}

const trackingTypes: ExerciseTrackingType[] = ['weight_reps', 'bodyweight_reps', 'assisted_reps', 'duration', 'distance_duration', 'weight_duration']

function trackingLabel(value: ExerciseTrackingType) {
  return value.replaceAll('_', ' ')
}

function Filter({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: readonly string[]; label: string }) {
  return <select className="h-10 rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="all">{label}</option>{options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
  </select>
}

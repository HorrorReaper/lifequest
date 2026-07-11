'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Copy, Pencil, Plus, Save, Settings2, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { NutritionEntryRow, NutritionTargetRow } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminPageHeader } from './AdminPageHeader'
import { cn } from '@/lib/utils'

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const
type MealType = typeof mealTypes[number]
type MealDraft = { name: string; meal_type: MealType; calories: number; protein_g: number; carbs_g: number; fat_g: number; notes: string }
const emptyMeal: MealDraft = { name: '', meal_type: 'breakfast', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, notes: '' }

export function NutritionHub({ userId, initialDate }: { userId: string; initialDate: string }) {
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, [])
  const [date, setDate] = useState(initialDate)
  const [targets, setTargets] = useState<NutritionTargetRow>({ user_id: userId, calories: 2500, protein_g: 180, carbs_g: 250, fat_g: 75, created_at: '', updated_at: '' })
  const [entries, setEntries] = useState<NutritionEntryRow[]>([])
  const [weekEntries, setWeekEntries] = useState<NutritionEntryRow[]>([])
  const [showTargets, setShowTargets] = useState(false)
  const [showMeal, setShowMeal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [meal, setMeal] = useState<MealDraft>(emptyMeal)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const weekStart = format(addDays(new Date(`${date}T12:00:00`), -6), 'yyyy-MM-dd')
    const [targetRes, dayRes, weekRes] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('nutrition_entries').select('*').eq('user_id', userId).eq('entry_date', date).order('created_at'),
      supabase.from('nutrition_entries').select('*').eq('user_id', userId).gte('entry_date', weekStart).lte('entry_date', date).order('entry_date'),
    ])
    const firstError = targetRes.error ?? dayRes.error ?? weekRes.error
    if (firstError) setError(firstError.message)
    if (targetRes.data) setTargets(targetRes.data as NutritionTargetRow)
    setEntries((dayRes.data ?? []) as NutritionEntryRow[])
    setWeekEntries((weekRes.data ?? []) as NutritionEntryRow[])
  }, [date, supabase, userId])
  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const totals = entries.reduce((sum, entry) => ({ calories: sum.calories + entry.calories, protein_g: sum.protein_g + Number(entry.protein_g), carbs_g: sum.carbs_g + Number(entry.carbs_g), fat_g: sum.fat_g + Number(entry.fat_g) }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
  const days = Array.from({ length: 7 }, (_, index) => format(addDays(new Date(`${date}T12:00:00`), index - 6), 'yyyy-MM-dd')).map((day) => ({ date: day, calories: weekEntries.filter((entry) => entry.entry_date === day).reduce((sum, entry) => sum + entry.calories, 0), protein: weekEntries.filter((entry) => entry.entry_date === day).reduce((sum, entry) => sum + Number(entry.protein_g), 0) }))
  const loggedDays = days.filter((day) => day.calories > 0)
  const averageCalories = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length) : 0
  const averageProtein = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.protein, 0) / loggedDays.length) : 0
  const adherence = loggedDays.length ? Math.round(loggedDays.filter((day) => day.calories >= targets.calories * .9 && day.calories <= targets.calories * 1.1).length / loggedDays.length * 100) : 0

  function updateMeal<K extends keyof MealDraft>(key: K, value: MealDraft[K]) { setMeal((current) => ({ ...current, [key]: value })) }
  async function saveTargets() { const payload = { user_id: userId, calories: Number(targets.calories), protein_g: Number(targets.protein_g), carbs_g: Number(targets.carbs_g), fat_g: Number(targets.fat_g), updated_at: new Date().toISOString() }; const { error: saveError } = await supabase.from('nutrition_targets').upsert(payload); if (saveError) setError(saveError.message); else { setShowTargets(false); await load() } }
  async function saveMeal(event: React.FormEvent) { event.preventDefault(); if (!meal.name.trim()) return; const payload = { user_id: userId, entry_date: date, ...meal, name: meal.name.trim(), notes: meal.notes.trim() || null, updated_at: new Date().toISOString() }; const result = editingId ? await supabase.from('nutrition_entries').update(payload).eq('id', editingId) : await supabase.from('nutrition_entries').insert(payload); if (result.error) setError(result.error.message); else { setMeal(emptyMeal); setEditingId(null); setShowMeal(false); await load() } }
  function editEntry(entry: NutritionEntryRow) { setMeal({ name: entry.name, meal_type: entry.meal_type, calories: entry.calories, protein_g: Number(entry.protein_g), carbs_g: Number(entry.carbs_g), fat_g: Number(entry.fat_g), notes: entry.notes ?? '' }); setEditingId(entry.id); setShowMeal(true) }
  async function duplicateEntry(entry: NutritionEntryRow) { const { id: _id, created_at: _created, updated_at: _updated, ...copy } = entry; void _id; void _created; void _updated; await supabase.from('nutrition_entries').insert({ ...copy, entry_date: date, name: `${entry.name} copy` }); await load() }
  async function deleteEntry(id: string) { await supabase.from('nutrition_entries').delete().eq('id', id); await load() }

  return <div className="mx-auto max-w-[92rem] space-y-7">
    <AdminPageHeader eyebrow="Fuel and recovery" title="Nutrition tracker" description="Log meals quickly, keep protein visible, and judge the week by consistent averages rather than one perfect day." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowTargets((value) => !value)}><Settings2 /> Targets</Button><Button onClick={() => { setMeal(emptyMeal); setEditingId(null); setShowMeal(true) }}><Plus /> Add meal</Button></div>} />
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {showTargets && <section className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Daily targets</h2><Button size="icon" variant="ghost" onClick={() => setShowTargets(false)} aria-label="Close targets"><X /></Button></div><div className="mt-5 grid gap-4 sm:grid-cols-4"><NumberField label="Calories" value={targets.calories} onChange={(value) => setTargets({ ...targets, calories: value })} suffix="kcal" /><NumberField label="Protein" value={Number(targets.protein_g)} onChange={(value) => setTargets({ ...targets, protein_g: value })} suffix="g" /><NumberField label="Carbs" value={Number(targets.carbs_g)} onChange={(value) => setTargets({ ...targets, carbs_g: value })} suffix="g" /><NumberField label="Fat" value={Number(targets.fat_g)} onChange={(value) => setTargets({ ...targets, fat_g: value })} suffix="g" /></div><Button className="mt-5" onClick={saveTargets}><Save /> Save targets</Button></section>}

    <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Daily log</p><h2 className="text-xl font-semibold">{format(new Date(`${date}T12:00:00`), 'EEEE, d MMMM')}</h2></div><Input className="w-auto" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MacroProgress label="Calories" value={totals.calories} target={targets.calories} unit="kcal" /><MacroProgress label="Protein" value={totals.protein_g} target={Number(targets.protein_g)} unit="g" /><MacroProgress label="Carbs" value={totals.carbs_g} target={Number(targets.carbs_g)} unit="g" /><MacroProgress label="Fat" value={totals.fat_g} target={Number(targets.fat_g)} unit="g" /></div>
        {showMeal && <form onSubmit={saveMeal} className="mt-6 rounded-2xl bg-muted/45 p-4"><div className="grid gap-3 sm:grid-cols-[1fr_10rem]"><Input value={meal.name} onChange={(e) => updateMeal('name', e.target.value)} placeholder="Meal or food name" autoFocus required /><select value={meal.meal_type} onChange={(e) => updateMeal('meal_type', e.target.value as MealType)} className="h-10 rounded-md border bg-background px-3 text-sm">{mealTypes.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><NumberField label="Calories" value={meal.calories} onChange={(v) => updateMeal('calories', v)} suffix="kcal" /><NumberField label="Protein" value={meal.protein_g} onChange={(v) => updateMeal('protein_g', v)} suffix="g" /><NumberField label="Carbs" value={meal.carbs_g} onChange={(v) => updateMeal('carbs_g', v)} suffix="g" /><NumberField label="Fat" value={meal.fat_g} onChange={(v) => updateMeal('fat_g', v)} suffix="g" /></div><Input className="mt-3" value={meal.notes} onChange={(e) => updateMeal('notes', e.target.value)} placeholder="Optional note" /><div className="mt-4 flex gap-2"><Button type="submit"><Save />{editingId ? 'Update meal' : 'Save meal'}</Button><Button type="button" variant="ghost" onClick={() => { setShowMeal(false); setEditingId(null) }}>Cancel</Button></div></form>}
        <div className="mt-6 divide-y">{entries.length === 0 ? <div className="py-12 text-center"><p className="font-medium">Nothing logged yet</p><p className="mt-1 text-sm text-muted-foreground">Add the first meal when you are ready.</p></div> : entries.map((entry) => <div key={entry.id} className="flex items-center gap-3 py-4"><div className="min-w-0 flex-1"><p className="truncate font-medium">{entry.name}</p><p className="text-xs capitalize text-muted-foreground">{entry.meal_type} · {entry.calories} kcal · {Number(entry.protein_g)}g protein</p></div><Button size="icon" variant="ghost" onClick={() => editEntry(entry)} aria-label="Edit meal"><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => duplicateEntry(entry)} aria-label="Duplicate meal"><Copy /></Button><Button size="icon" variant="ghost" onClick={() => deleteEntry(entry.id)} aria-label="Delete meal"><Trash2 /></Button></div>)}</div>
      </div>
      <div className="space-y-5">
        <div className="rounded-[2rem] bg-primary p-6 text-primary-foreground"><p className="text-sm opacity-70">Remaining today</p><p className="mt-3 font-mono text-5xl font-semibold tracking-[-0.07em] tabular-nums">{targets.calories - totals.calories}</p><p className="mt-1 text-sm opacity-75">kilocalories</p><div className="mt-8 grid grid-cols-3 gap-2 text-center"><Remaining label="Protein" value={Number(targets.protein_g) - totals.protein_g} /><Remaining label="Carbs" value={Number(targets.carbs_g) - totals.carbs_g} /><Remaining label="Fat" value={Number(targets.fat_g) - totals.fat_g} /></div></div>
        <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border"><h2 className="font-semibold">Seven-day view</h2><div className="mt-5 flex h-28 items-end gap-2">{days.map((day) => <div key={day.date} className="flex flex-1 flex-col items-center gap-2"><div className={cn('w-full rounded-t-md', day.calories > targets.calories * 1.1 ? 'bg-amber-500' : 'bg-primary/75')} style={{ height: `${Math.max(4, Math.min(88, day.calories / Math.max(1, targets.calories) * 72))}px` }} /><span className="text-[10px] text-muted-foreground">{format(new Date(`${day.date}T12:00:00`), 'EE')}</span></div>)}</div><div className="mt-5 grid grid-cols-3 gap-2"><WeeklyStat label="Avg kcal" value={averageCalories} /><WeeklyStat label="Avg protein" value={`${averageProtein}g`} /><WeeklyStat label="Adherence" value={`${adherence}%`} /></div></div>
      </div>
    </section>
  </div>
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix: string }) { return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{label}</span><div className="relative"><Input type="number" min="0" step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} className="pr-12 font-mono" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span></div></label> }
function MacroProgress({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) { const ratio = target ? value / target : 0; return <div className="rounded-2xl bg-muted/45 p-4"><div className="flex items-baseline justify-between"><p className="text-sm font-medium">{label}</p><p className={cn('font-mono text-xs', ratio > 1.1 && 'text-amber-600')}>{Math.round(value)}/{Math.round(target)} {unit}</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background"><div className={cn('h-full rounded-full', ratio > 1.1 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div></div> }
function Remaining({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-primary-foreground/10 p-3"><p className="font-mono text-lg">{Math.round(value)}g</p><p className="text-[10px] opacity-65">{label}</p></div> }
function WeeklyStat({ label, value }: { label: string; value: string | number }) { return <div><p className="font-mono text-lg font-semibold tabular-nums">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div> }

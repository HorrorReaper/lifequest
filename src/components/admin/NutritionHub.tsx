'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Apple, BookOpen, Copy, Database, Heart, Pencil, Plus, RefreshCw, Save, Settings2, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  FoodFavoriteRow,
  FoodItemRow,
  MealType,
  NutritionEntryRow,
  NutritionTargetRow,
  RecipeIngredientRow,
  RecipeRow,
  SavedMealItemRow,
  SavedMealRow,
} from '@/lib/supabase/database.types'
import { scaleNutrients, sumNutrients } from '@/lib/nutrition/calculations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminPageHeader } from './AdminPageHeader'
import { FoodSearchPanel } from './nutrition/FoodSearchPanel'
import { ReusableFoodPlans, type ReusableItemDraft } from './nutrition/ReusableFoodPlans'
import { cn } from '@/lib/utils'

type View = 'diary' | 'foods' | 'plans'
type QuickDraft = {
  id?: string
  name: string
  meal_type: MealType
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
  notes: string
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
const blankQuick: QuickDraft = { name: '', meal_type: 'other', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, notes: '' }

export function NutritionHub({ userId, initialDate }: { userId: string; initialDate: string }) {
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, [])
  const [view, setView] = useState<View>('diary')
  const [date, setDate] = useState(initialDate)
  const [targets, setTargets] = useState<NutritionTargetRow>({ user_id: userId, calories: 2500, protein_g: 180, carbs_g: 250, fat_g: 75, fiber_g: 30, sodium_mg: 2300, created_at: '', updated_at: '' })
  const [entries, setEntries] = useState<NutritionEntryRow[]>([])
  const [weekEntries, setWeekEntries] = useState<NutritionEntryRow[]>([])
  const [foods, setFoods] = useState<FoodItemRow[]>([])
  const [favorites, setFavorites] = useState<FoodFavoriteRow[]>([])
  const [savedMeals, setSavedMeals] = useState<SavedMealRow[]>([])
  const [savedMealItems, setSavedMealItems] = useState<SavedMealItemRow[]>([])
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientRow[]>([])
  const [showTargets, setShowTargets] = useState(false)
  const [showFood, setShowFood] = useState(false)
  const [foodMealType, setFoodMealType] = useState<MealType>('other')
  const [quick, setQuick] = useState<QuickDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const weekStart = format(subDays(new Date(`${date}T12:00:00`), 6), 'yyyy-MM-dd')
    const [targetRes, dayRes, weekRes, foodRes, favoriteRes, mealRes, mealItemRes, recipeRes, ingredientRes] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('nutrition_entries').select('*').eq('user_id', userId).eq('entry_date', date).order('created_at'),
      supabase.from('nutrition_entries').select('*').eq('user_id', userId).gte('entry_date', weekStart).lte('entry_date', date).order('entry_date'),
      supabase.from('food_items').select('*').eq('user_id', userId).eq('is_archived', false).order('updated_at', { ascending: false }),
      supabase.from('food_favorites').select('*').eq('user_id', userId),
      supabase.from('saved_meals').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabase.from('saved_meal_items').select('*').order('sort_order'),
      supabase.from('recipes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabase.from('recipe_ingredients').select('*').order('sort_order'),
    ])
    const firstError = targetRes.error ?? dayRes.error ?? weekRes.error ?? foodRes.error ?? favoriteRes.error ?? mealRes.error ?? mealItemRes.error ?? recipeRes.error ?? ingredientRes.error
    if (firstError) setError(firstError.message)
    if (targetRes.data) setTargets(targetRes.data as NutritionTargetRow)
    setEntries((dayRes.data ?? []) as NutritionEntryRow[])
    setWeekEntries((weekRes.data ?? []) as NutritionEntryRow[])
    setFoods((foodRes.data ?? []) as FoodItemRow[])
    setFavorites((favoriteRes.data ?? []) as FoodFavoriteRow[])
    setSavedMeals((mealRes.data ?? []) as SavedMealRow[])
    setSavedMealItems((mealItemRes.data ?? []) as SavedMealItemRow[])
    setRecipes((recipeRes.data ?? []) as RecipeRow[])
    setRecipeIngredients((ingredientRes.data ?? []) as RecipeIngredientRow[])
    setLoading(false)
  }, [date, supabase, userId])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  async function execute(action: () => Promise<void>) {
    if (working) return
    setWorking(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      throw caught
    } finally {
      setWorking(false)
    }
  }

  async function saveTargets() {
    await execute(async () => {
      const { error: saveError } = await supabase.from('nutrition_targets').upsert({
        user_id: userId,
        calories: Number(targets.calories),
        protein_g: Number(targets.protein_g),
        carbs_g: Number(targets.carbs_g),
        fat_g: Number(targets.fat_g),
        fiber_g: targets.fiber_g === null ? null : Number(targets.fiber_g),
        sodium_mg: targets.sodium_mg === null ? null : Number(targets.sodium_mg),
        updated_at: new Date().toISOString(),
      })
      if (saveError) throw saveError
      setShowTargets(false)
      await load()
    })
  }

  async function logFood(food: FoodItemRow, servingGrams: number, servingCount: number, mealType: MealType) {
    await execute(async () => {
      const nutrient = scaleNutrients(food, servingGrams, servingCount)
      const { error: insertError } = await supabase.from('nutrition_entries').insert({
        user_id: userId,
        entry_date: date,
        meal_type: mealType,
        name: food.name,
        entry_kind: 'food',
        food_item_id: food.id,
        serving_grams: servingGrams,
        serving_count: servingCount,
        serving_label: `${servingCount} × ${servingGrams} g`,
        calories: Math.round(nutrient.calories),
        protein_g: nutrient.protein,
        carbs_g: nutrient.carbs,
        fat_g: nutrient.fat,
        fiber_g: nutrient.fiber,
        sugar_g: nutrient.sugar,
        sodium_mg: nutrient.sodium,
        source_details: { source: food.source, external_id: food.external_id, brand: food.brand },
      })
      if (insertError) throw insertError
      await supabase.from('food_items').update({ updated_at: new Date().toISOString() }).eq('id', food.id)
      await load()
    })
  }

  async function saveQuick(event: React.FormEvent) {
    event.preventDefault()
    if (!quick?.name.trim()) return
    await execute(async () => {
      const payload = {
        user_id: userId,
        entry_date: date,
        meal_type: quick.meal_type,
        name: quick.name.trim(),
        entry_kind: 'quick_add',
        calories: Math.round(Math.max(0, quick.calories)),
        protein_g: Math.max(0, quick.protein_g),
        carbs_g: Math.max(0, quick.carbs_g),
        fat_g: Math.max(0, quick.fat_g),
        fiber_g: Math.max(0, quick.fiber_g),
        sugar_g: Math.max(0, quick.sugar_g),
        sodium_mg: Math.max(0, quick.sodium_mg),
        notes: quick.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const result = quick.id
        ? await supabase.from('nutrition_entries').update(payload).eq('id', quick.id)
        : await supabase.from('nutrition_entries').insert(payload)
      if (result.error) throw result.error
      setQuick(null)
      await load()
    })
  }

  function editEntry(entry: NutritionEntryRow) {
    setQuick({
      id: entry.id,
      name: entry.name,
      meal_type: entry.meal_type,
      calories: entry.calories,
      protein_g: Number(entry.protein_g),
      carbs_g: Number(entry.carbs_g),
      fat_g: Number(entry.fat_g),
      fiber_g: Number(entry.fiber_g),
      sugar_g: Number(entry.sugar_g),
      sodium_mg: Number(entry.sodium_mg),
      notes: entry.notes ?? '',
    })
  }

  async function copyEntry(entry: NutritionEntryRow) {
    const destination = window.prompt('Copy to date (YYYY-MM-DD)', date)
    if (!destination || !/^\d{4}-\d{2}-\d{2}$/.test(destination)) return
    await execute(async () => {
      const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...snapshot } = entry
      void _id; void _createdAt; void _updatedAt
      const { error: copyError } = await supabase.from('nutrition_entries').insert({ ...snapshot, entry_date: destination })
      if (copyError) throw copyError
      if (destination === date) await load()
    })
  }

  async function deleteEntry(id: string) {
    await execute(async () => {
      const { error: deleteError } = await supabase.from('nutrition_entries').delete().eq('id', id)
      if (deleteError) throw deleteError
      await load()
    })
  }

  async function toggleFavorite(food: FoodItemRow) {
    await execute(async () => {
      const favorite = favorites.some((item) => item.food_item_id === food.id)
      const result = favorite
        ? await supabase.from('food_favorites').delete().eq('user_id', userId).eq('food_item_id', food.id)
        : await supabase.from('food_favorites').insert({ user_id: userId, food_item_id: food.id })
      if (result.error) throw result.error
      await load()
    })
  }

  async function createCustomFood(draft: Omit<FoodItemRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'source_updated_at' | 'is_archived'>) {
    await execute(async () => {
      const { error: insertError } = await supabase.from('food_items').insert({ ...draft, user_id: userId, source: 'custom' })
      if (insertError) throw insertError
      await load()
    })
  }

  async function createSavedMeal(name: string, items: ReusableItemDraft[]) {
    await execute(async () => {
      const { data: meal, error: mealError } = await supabase.from('saved_meals').insert({ user_id: userId, name }).select('*').single()
      if (mealError) throw mealError
      const { error: itemError } = await supabase.from('saved_meal_items').insert(items.map((item, index) => ({ saved_meal_id: meal.id, food_item_id: item.foodId, serving_grams: item.grams, sort_order: index })))
      if (itemError) {
        await supabase.from('saved_meals').delete().eq('id', meal.id)
        throw itemError
      }
      await load()
    })
  }

  async function createRecipe(name: string, servings: number, yieldWeight: number | null, items: ReusableItemDraft[]) {
    await execute(async () => {
      const { data: recipe, error: recipeError } = await supabase.from('recipes').insert({ user_id: userId, name, servings, yield_weight_g: yieldWeight }).select('*').single()
      if (recipeError) throw recipeError
      const { error: ingredientError } = await supabase.from('recipe_ingredients').insert(items.map((item, index) => ({ recipe_id: recipe.id, food_item_id: item.foodId, grams: item.grams, sort_order: index })))
      if (ingredientError) {
        await supabase.from('recipes').delete().eq('id', recipe.id)
        throw ingredientError
      }
      await load()
    })
  }

  async function logSavedMeal(id: string, mealType: MealType) {
    await execute(async () => {
      const { error: logError } = await supabase.rpc('log_saved_meal', { p_saved_meal_id: id, p_entry_date: date, p_meal_type: mealType })
      if (logError) throw logError
      await load()
      setView('diary')
    })
  }

  async function logRecipe(id: string, servingCount: number, mealType: MealType) {
    await execute(async () => {
      const { error: logError } = await supabase.rpc('log_recipe', { p_recipe_id: id, p_entry_date: date, p_meal_type: mealType, p_serving_count: servingCount })
      if (logError) throw logError
      await load()
      setView('diary')
    })
  }

  async function deleteSavedMeal(id: string) {
    await execute(async () => {
      const { error: deleteError } = await supabase.from('saved_meals').delete().eq('id', id)
      if (deleteError) throw deleteError
      await load()
    })
  }

  async function deleteRecipe(id: string) {
    await execute(async () => {
      const { error: deleteError } = await supabase.from('recipes').delete().eq('id', id)
      if (deleteError) throw deleteError
      await load()
    })
  }

  const totals = sumNutrients(entries.map((entry) => ({
    calories: Number(entry.calories),
    protein: Number(entry.protein_g),
    carbs: Number(entry.carbs_g),
    fat: Number(entry.fat_g),
    fiber: Number(entry.fiber_g),
    sugar: Number(entry.sugar_g),
    sodium: Number(entry.sodium_mg),
  })))
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = format(subDays(new Date(`${date}T12:00:00`), 6 - index), 'yyyy-MM-dd')
    const dayEntries = weekEntries.filter((entry) => entry.entry_date === day)
    return { date: day, calories: dayEntries.reduce((sum, entry) => sum + entry.calories, 0), protein: dayEntries.reduce((sum, entry) => sum + Number(entry.protein_g), 0) }
  })
  const loggedDays = days.filter((day) => day.calories > 0)
  const averageCalories = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length) : 0
  const averageProtein = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.protein, 0) / loggedDays.length) : 0
  const adherence = loggedDays.length ? Math.round(loggedDays.filter((day) => day.calories >= targets.calories * .9 && day.calories <= targets.calories * 1.1).length / loggedDays.length * 100) : 0
  const favoriteIds = new Set(favorites.map((favorite) => favorite.food_item_id))

  return <div className="mx-auto max-w-[92rem] space-y-7">
    <AdminPageHeader eyebrow="Fuel and recovery" title="Nutrition tracker" description="Search real foods, scale servings, reuse meals, and judge consistency from reliable daily snapshots." actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowTargets(true)}><Settings2 /> Targets</Button><Button onClick={() => { setFoodMealType('other'); setShowFood(true) }}><Plus /> Add food</Button></div>} />
    {error && <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><span className="flex-1">{error}</span><Button size="sm" variant="ghost" onClick={() => load()}><RefreshCw /> Retry</Button></div>}
    <nav className="flex rounded-2xl bg-muted/50 p-1">{([['diary', Apple], ['foods', Database], ['plans', BookOpen]] as const).map(([item, Icon]) => <button key={item} onClick={() => setView(item)} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm capitalize', view === item ? 'bg-card shadow-sm' : 'text-muted-foreground')}><Icon className="size-4" />{item}</button>)}</nav>
    {showTargets && <TargetEditor targets={targets} setTargets={setTargets} onSave={saveTargets} onClose={() => setShowTargets(false)} />}
    {showFood && <FoodSearchPanel foods={foods} favoriteIds={favoriteIds} initialMealType={foodMealType} onClose={() => setShowFood(false)} onLog={logFood} onFavorite={toggleFavorite} />}
    {quick && <QuickEditor draft={quick} setDraft={setQuick} onSave={saveQuick} onClose={() => setQuick(null)} />}
    {loading ? <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading nutrition data…</div> : <>
      {view === 'diary' && <Diary date={date} setDate={setDate} entries={entries} totals={totals} targets={targets} days={days} averageCalories={averageCalories} averageProtein={averageProtein} adherence={adherence} onAddFood={(type) => { setFoodMealType(type); setShowFood(true) }} onQuick={(type) => setQuick({ ...blankQuick, meal_type: type })} onEdit={editEntry} onCopy={copyEntry} onDelete={deleteEntry} />}
      {view === 'foods' && <FoodLibrary foods={foods} favoriteIds={favoriteIds} onFavorite={toggleFavorite} onCreate={createCustomFood} />}
      {view === 'plans' && <ReusableFoodPlans foods={foods} savedMeals={savedMeals} savedMealItems={savedMealItems} recipes={recipes} recipeIngredients={recipeIngredients} onCreateMeal={createSavedMeal} onCreateRecipe={createRecipe} onLogMeal={logSavedMeal} onLogRecipe={logRecipe} onDeleteMeal={deleteSavedMeal} onDeleteRecipe={deleteRecipe} />}
    </>}
  </div>
}

function Diary({ date, setDate, entries, totals, targets, days, averageCalories, averageProtein, adherence, onAddFood, onQuick, onEdit, onCopy, onDelete }: {
  date: string
  setDate: (date: string) => void
  entries: NutritionEntryRow[]
  totals: ReturnType<typeof sumNutrients>
  targets: NutritionTargetRow
  days: Array<{ date: string; calories: number; protein: number }>
  averageCalories: number
  averageProtein: number
  adherence: number
  onAddFood: (type: MealType) => void
  onQuick: (type: MealType) => void
  onEdit: (entry: NutritionEntryRow) => void
  onCopy: (entry: NutritionEntryRow) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  return <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]"><div className="space-y-5">
    <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Daily log</p><h2 className="text-xl font-semibold">{format(new Date(`${date}T12:00:00`), 'EEEE, d MMMM')}</h2></div><Input className="w-auto" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><MacroProgress label="Calories" value={totals.calories} target={targets.calories} unit="kcal" /><MacroProgress label="Protein" value={totals.protein} target={Number(targets.protein_g)} unit="g" /><MacroProgress label="Carbs" value={totals.carbs} target={Number(targets.carbs_g)} unit="g" /><MacroProgress label="Fat" value={totals.fat} target={Number(targets.fat_g)} unit="g" /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground"><span>Fiber {Math.round(totals.fiber)}g</span><span>Sugar {Math.round(totals.sugar)}g</span><span>Sodium {Math.round(totals.sodium)}mg</span></div></div>
    {mealTypes.map((type) => {
      const mealEntries = entries.filter((entry) => entry.meal_type === type)
      const calories = mealEntries.reduce((sum, entry) => sum + entry.calories, 0)
      return <article key={type} className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold capitalize">{type}</h3><p className="text-xs text-muted-foreground">{calories} kcal</p></div><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => onQuick(type)}>Quick add</Button><Button size="sm" variant="outline" onClick={() => onAddFood(type)}><Plus /> Food</Button></div></div><div className="mt-3 divide-y">{mealEntries.map((entry) => <div key={entry.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{entry.name}</p><p className="text-xs text-muted-foreground">{entry.serving_label || entry.entry_kind.replaceAll('_', ' ')} · {entry.calories} kcal · {Math.round(Number(entry.protein_g))}g protein</p></div><Button size="icon" variant="ghost" onClick={() => onEdit(entry)}><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => onCopy(entry)}><Copy /></Button><Button size="icon" variant="ghost" onClick={() => onDelete(entry.id)}><Trash2 /></Button></div>)}{!mealEntries.length && <p className="py-4 text-center text-xs text-muted-foreground">Nothing logged</p>}</div></article>
    })}
  </div><aside className="space-y-5"><div className="rounded-[2rem] bg-primary p-6 text-primary-foreground"><p className="text-sm opacity-70">Remaining today</p><p className="mt-3 font-mono text-5xl font-semibold tracking-[-0.07em]">{Math.round(targets.calories - totals.calories)}</p><p className="text-sm opacity-70">kilocalories</p><div className="mt-8 grid grid-cols-3 gap-2 text-center"><Remaining label="Protein" value={Number(targets.protein_g) - totals.protein} /><Remaining label="Carbs" value={Number(targets.carbs_g) - totals.carbs} /><Remaining label="Fat" value={Number(targets.fat_g) - totals.fat} /></div></div><div className="rounded-[2rem] bg-card p-5 ring-1 ring-border"><h2 className="font-semibold">Seven-day view</h2><div className="mt-5 flex h-28 items-end gap-2">{days.map((day) => <div key={day.date} className="flex flex-1 flex-col items-center gap-2"><div className={cn('w-full rounded-t-md', day.calories > targets.calories * 1.1 ? 'bg-amber-500' : 'bg-primary/75')} style={{ height: `${Math.max(4, Math.min(88, day.calories / Math.max(1, targets.calories) * 72))}px` }} /><span className="text-[10px] text-muted-foreground">{format(new Date(`${day.date}T12:00:00`), 'EE')}</span></div>)}</div><div className="mt-5 grid grid-cols-3 gap-2"><WeeklyStat label="Avg kcal" value={averageCalories} /><WeeklyStat label="Avg protein" value={`${averageProtein}g`} /><WeeklyStat label="Adherence" value={`${adherence}%`} /></div></div></aside></section>
}

function TargetEditor({ targets, setTargets, onSave, onClose }: { targets: NutritionTargetRow; setTargets: (targets: NutritionTargetRow) => void; onSave: () => Promise<void>; onClose: () => void }) {
  return <section className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Daily targets</h2><Button size="icon" variant="ghost" onClick={onClose}><X /></Button></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6"><NumberField label="Calories" value={targets.calories} onChange={(calories) => setTargets({ ...targets, calories })} suffix="kcal" /><NumberField label="Protein" value={Number(targets.protein_g)} onChange={(protein_g) => setTargets({ ...targets, protein_g })} suffix="g" /><NumberField label="Carbs" value={Number(targets.carbs_g)} onChange={(carbs_g) => setTargets({ ...targets, carbs_g })} suffix="g" /><NumberField label="Fat" value={Number(targets.fat_g)} onChange={(fat_g) => setTargets({ ...targets, fat_g })} suffix="g" /><NumberField label="Fiber" value={Number(targets.fiber_g ?? 0)} onChange={(fiber_g) => setTargets({ ...targets, fiber_g })} suffix="g" /><NumberField label="Sodium" value={Number(targets.sodium_mg ?? 0)} onChange={(sodium_mg) => setTargets({ ...targets, sodium_mg })} suffix="mg" /></div><Button className="mt-5" onClick={onSave}><Save /> Save targets</Button></section>
}

function QuickEditor({ draft, setDraft, onSave, onClose }: { draft: QuickDraft; setDraft: (draft: QuickDraft) => void; onSave: (event: React.FormEvent) => Promise<void>; onClose: () => void }) {
  return <form onSubmit={onSave} className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{draft.id ? 'Edit diary entry' : 'Quick add'}</h2><Button type="button" size="icon" variant="ghost" onClick={onClose}><X /></Button></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem]"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Food or meal name" required /><select className="h-10 rounded-md border bg-background px-3 text-sm" value={draft.meal_type} onChange={(event) => setDraft({ ...draft, meal_type: event.target.value as MealType })}>{mealTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-7">{(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg'] as const).map((key) => <NumberField key={key} label={key.replace('_g', '').replace('_mg', '')} value={draft[key]} onChange={(value) => setDraft({ ...draft, [key]: value })} suffix={key === 'calories' ? 'kcal' : key === 'sodium_mg' ? 'mg' : 'g'} />)}</div><Input className="mt-3" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Optional note" /><Button className="mt-4" type="submit"><Save /> Save entry</Button></form>
}

function FoodLibrary({ foods, favoriteIds, onFavorite, onCreate }: { foods: FoodItemRow[]; favoriteIds: Set<string>; onFavorite: (food: FoodItemRow) => Promise<void>; onCreate: (food: Omit<FoodItemRow, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'source_updated_at' | 'is_archived'>) => Promise<void> }) {
  const [show, setShow] = useState(false)
  const [draft, setDraft] = useState({ name: '', brand: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, serving: 100 })
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    await onCreate({ source: 'custom', external_id: null, barcode: null, name: draft.name.trim(), brand: draft.brand.trim() || null, calories_per_100g: draft.calories, protein_per_100g: draft.protein, carbs_per_100g: draft.carbs, fat_per_100g: draft.fat, fiber_per_100g: draft.fiber, sugar_per_100g: draft.sugar, sodium_mg_per_100g: draft.sodium, default_serving_grams: draft.serving, default_serving_label: `${draft.serving} g` })
    setShow(false)
  }
  return <section className="space-y-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Cached provider foods and your own foods</p><h2 className="text-xl font-semibold">Food library</h2></div><Button onClick={() => setShow(true)}><Plus /> Custom food</Button></div>{show && <form onSubmit={submit} className="rounded-2xl bg-card p-5 ring-1 ring-border"><div className="flex items-center justify-between"><h3 className="font-semibold">Nutrition per 100 g</h3><Button type="button" size="icon" variant="ghost" onClick={() => setShow(false)}><X /></Button></div><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5"><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Food name" required /><Input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} placeholder="Brand" />{(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'serving'] as const).map((key) => <NumberField key={key} label={key} value={draft[key]} onChange={(value) => setDraft({ ...draft, [key]: value })} suffix={key === 'calories' ? 'kcal' : key === 'sodium' ? 'mg' : 'g'} />)}</div><Button className="mt-4" type="submit"><Save /> Save custom food</Button></form>}<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{foods.map((food) => <article key={food.id} className="rounded-2xl bg-card p-4 ring-1 ring-border"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{food.name}</h3><p className="truncate text-xs text-muted-foreground">{food.brand || 'Generic'} · {food.source.replaceAll('_', ' ')}</p></div><Button size="icon" variant="ghost" onClick={() => onFavorite(food)}><Heart className={cn(favoriteIds.has(food.id) && 'fill-current text-rose-500')} /></Button></div><p className="mt-3 font-mono text-sm">{Math.round(Number(food.calories_per_100g))} kcal · {Math.round(Number(food.protein_per_100g))}P · {Math.round(Number(food.carbs_per_100g))}C · {Math.round(Number(food.fat_per_100g))}F</p></article>)}</div></section>
}

function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix: string }) {
  return <label><span className="mb-1 block text-xs capitalize text-muted-foreground">{label}</span><div className="relative"><Input className="pr-12 font-mono" type="number" min="0" step="0.1" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span></div></label>
}
function MacroProgress({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) { const ratio = target ? value / target : 0; return <div className="rounded-2xl bg-muted/45 p-4"><div className="flex items-baseline justify-between gap-2"><p className="text-sm font-medium">{label}</p><p className={cn('font-mono text-xs', ratio > 1.1 && 'text-amber-600')}>{Math.round(value)}/{Math.round(target)} {unit}</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background"><div className={cn('h-full rounded-full', ratio > 1.1 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div></div> }
function Remaining({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-primary-foreground/10 p-3"><p className="font-mono text-lg">{Math.round(value)}g</p><p className="text-[10px] opacity-65">{label}</p></div> }
function WeeklyStat({ label, value }: { label: string; value: string | number }) { return <div><p className="font-mono text-lg font-semibold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div> }

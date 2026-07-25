'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  Apple,
  BookOpen,
  CalendarDays,
  Copy,
  Database,
  Heart,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  FoodFavoriteRow,
  FoodItemRow,
  FoodPortionRow,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AdminPageHeader } from './AdminPageHeader'
import { FoodSearchPanel } from './nutrition/FoodSearchPanel'
import { NutritionDiary } from './nutrition/NutritionDiary'
import { ReusableFoodPlans, type ReusableItemDraft } from './nutrition/ReusableFoodPlans'
import {
  buildSnapshotPreservingEdit,
  copyEntrySnapshot,
} from './nutrition/diary-utils'
import { cn } from '@/lib/utils'

type View = 'diary' | 'foods'
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
const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  other: 'Other',
}

export function NutritionHub({ userId, initialDate }: { userId: string; initialDate: string }) {
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, [])
  const [view, setView] = useState<View>('diary')
  const [date, setDate] = useState(initialDate)
  const [targets, setTargets] = useState<NutritionTargetRow>({ user_id: userId, calories: 2500, protein_g: 180, carbs_g: 250, fat_g: 75, fiber_g: 30, sodium_mg: 2300, created_at: '', updated_at: '' })
  const [entries, setEntries] = useState<NutritionEntryRow[]>([])
  const [weekEntries, setWeekEntries] = useState<NutritionEntryRow[]>([])
  const [historyEntries, setHistoryEntries] = useState<NutritionEntryRow[]>([])
  const [foods, setFoods] = useState<FoodItemRow[]>([])
  const [portions, setPortions] = useState<FoodPortionRow[]>([])
  const [favorites, setFavorites] = useState<FoodFavoriteRow[]>([])
  const [savedMeals, setSavedMeals] = useState<SavedMealRow[]>([])
  const [savedMealItems, setSavedMealItems] = useState<SavedMealItemRow[]>([])
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientRow[]>([])
  const [showTargets, setShowTargets] = useState(false)
  const [showFood, setShowFood] = useState(false)
  const [showPlans, setShowPlans] = useState(false)
  const [foodMealType, setFoodMealType] = useState<MealType>('other')
  const [quick, setQuick] = useState<QuickDraft | null>(null)
  const [mealTools, setMealTools] = useState<MealType | null>(null)
  const [entryTools, setEntryTools] = useState<NutritionEntryRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const weekStart = format(subDays(new Date(`${date}T12:00:00`), 6), 'yyyy-MM-dd')
    const historyStart = format(subDays(new Date(`${date}T12:00:00`), 89), 'yyyy-MM-dd')
    const [targetRes, dayRes, historyRes, foodRes, portionRes, favoriteRes, mealRes, mealItemRes, recipeRes, ingredientRes] = await Promise.all([
      supabase.from('nutrition_targets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('nutrition_entries').select('*').eq('user_id', userId).eq('entry_date', date).order('created_at'),
      supabase.from('nutrition_entries').select('*').eq('user_id', userId).gte('entry_date', historyStart).lte('entry_date', date).order('entry_date', { ascending: false }),
      supabase.from('food_items').select('*').eq('user_id', userId).eq('is_archived', false).order('updated_at', { ascending: false }),
      supabase.from('food_portions').select('*').order('is_default', { ascending: false }),
      supabase.from('food_favorites').select('*').eq('user_id', userId),
      supabase.from('saved_meals').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabase.from('saved_meal_items').select('*').order('sort_order'),
      supabase.from('recipes').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      supabase.from('recipe_ingredients').select('*').order('sort_order'),
    ])
    const firstError = targetRes.error ?? dayRes.error ?? historyRes.error ?? foodRes.error ?? portionRes.error ?? favoriteRes.error ?? mealRes.error ?? mealItemRes.error ?? recipeRes.error ?? ingredientRes.error
    if (firstError) setError(firstError.message)
    if (targetRes.data) setTargets(targetRes.data as NutritionTargetRow)
    setEntries((dayRes.data ?? []) as NutritionEntryRow[])
    const history = (historyRes.data ?? []) as NutritionEntryRow[]
    setHistoryEntries(history)
    setWeekEntries(history.filter((entry) => entry.entry_date >= weekStart))
    setFoods((foodRes.data ?? []) as FoodItemRow[])
    setPortions((portionRes.data ?? []) as FoodPortionRow[])
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

  async function logFood(food: FoodItemRow, servingGrams: number, servingCount: number, mealType: MealType, servingLabel?: string) {
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
        serving_label: servingLabel
          ? `${servingCount} × ${servingLabel}`
          : `${servingCount} × ${servingGrams} g`,
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
      const editableSnapshot = buildSnapshotPreservingEdit({
        meal_type: quick.meal_type,
        name: quick.name.trim(),
        calories: quick.calories,
        protein_g: quick.protein_g,
        carbs_g: quick.carbs_g,
        fat_g: quick.fat_g,
        fiber_g: quick.fiber_g,
        sugar_g: quick.sugar_g,
        sodium_mg: quick.sodium_mg,
        notes: quick.notes,
      })
      const result = quick.id
        ? await supabase.from('nutrition_entries').update(editableSnapshot).eq('id', quick.id).eq('user_id', userId)
        : await supabase.from('nutrition_entries').insert({
          ...editableSnapshot,
          user_id: userId,
          entry_date: date,
          entry_kind: 'quick_add',
        })
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

  async function copyEntry(entry: NutritionEntryRow, destination: string, mealType = entry.meal_type) {
    await execute(async () => {
      const snapshot = copyEntrySnapshot(entry, { entry_date: destination, meal_type: mealType })
      const { error: copyError } = await supabase.from('nutrition_entries').insert(snapshot)
      if (copyError) throw copyError
      if (destination === date) await load()
    })
  }

  async function copyMeal(sourceMeal: MealType, destination: string, destinationMeal = sourceMeal) {
    const mealEntries = entries.filter((entry) => entry.meal_type === sourceMeal)
    if (!mealEntries.length) return
    await execute(async () => {
      const snapshots = mealEntries.map((entry) => copyEntrySnapshot(entry, {
        entry_date: destination,
        meal_type: destinationMeal,
      }))
      const { error: copyError } = await supabase.from('nutrition_entries').insert(snapshots)
      if (copyError) throw copyError
      setMealTools(null)
      if (destination === date) await load()
    })
  }

  async function moveEntry(entry: NutritionEntryRow, destinationMeal: MealType) {
    await execute(async () => {
      const { error: moveError } = await supabase.from('nutrition_entries')
        .update({ meal_type: destinationMeal, updated_at: new Date().toISOString() })
        .eq('id', entry.id)
        .eq('user_id', userId)
      if (moveError) throw moveError
      setEntryTools(null)
      await load()
    })
  }

  async function moveMeal(sourceMeal: MealType, destinationMeal: MealType) {
    const ids = entries.filter((entry) => entry.meal_type === sourceMeal).map((entry) => entry.id)
    if (!ids.length) return
    await execute(async () => {
      const { error: moveError } = await supabase.from('nutrition_entries')
        .update({ meal_type: destinationMeal, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('user_id', userId)
      if (moveError) throw moveError
      setMealTools(null)
      await load()
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
    <AdminPageHeader
      eyebrow="Fuel and recovery"
      title="Nutrition diary"
      description="Log food quickly, keep reliable nutrient snapshots, and understand the balance of your day."
      actions={<div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="outline" onClick={() => setShowPlans(true)}><BookOpen /> Meals</Button>
        <Button variant="outline" onClick={() => setShowTargets(true)}><Settings2 /> Targets</Button>
        <Button className="col-span-2" onClick={() => { setFoodMealType('other'); setShowFood(true) }}><Plus /> Add food</Button>
      </div>}
    />
    {error && <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><span className="flex-1">{error}</span><Button size="sm" variant="ghost" onClick={() => load()}><RefreshCw /> Retry</Button></div>}
    <nav className="flex rounded-2xl bg-muted/50 p-1">{([['diary', Apple, 'Diary'], ['foods', Database, 'My foods']] as const).map(([item, Icon, label]) => <button key={item} onClick={() => setView(item)} className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm', view === item ? 'bg-card shadow-sm' : 'text-muted-foreground')}><Icon className="size-4" />{label}</button>)}</nav>

    <Dialog open={showTargets} onOpenChange={(open) => !working && setShowTargets(open)}>
      <DialogContent className="bottom-0 top-auto max-h-[92svh] max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl p-5 sm:bottom-auto sm:top-1/2 sm:max-w-3xl sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader><DialogTitle>Daily nutrition targets</DialogTitle><DialogDescription>Set the calorie and macro goals used throughout the diary.</DialogDescription></DialogHeader>
        <TargetEditor targets={targets} setTargets={setTargets} onSave={saveTargets} onClose={() => setShowTargets(false)} />
      </DialogContent>
    </Dialog>

    <Dialog open={showFood} onOpenChange={(open) => !working && setShowFood(open)}>
      <DialogContent className="bottom-0 top-auto h-[94svh] max-h-[94svh] max-w-none translate-y-0 gap-0 overflow-hidden rounded-b-none rounded-t-3xl p-0 sm:bottom-auto sm:top-1/2 sm:h-auto sm:max-h-[88svh] sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-xl" showCloseButton>
        <DialogHeader className="sr-only"><DialogTitle>Add food</DialogTitle><DialogDescription>Search saved foods, provider foods, meals and recipes.</DialogDescription></DialogHeader>
        <FoodSearchPanel
          foods={foods}
          portions={portions}
          historyEntries={historyEntries}
          favoriteIds={favoriteIds}
          savedMeals={savedMeals}
          recipes={recipes}
          initialMealType={foodMealType}
          onClose={() => setShowFood(false)}
          onLog={logFood}
          onLogSavedMeal={logSavedMeal}
          onLogRecipe={logRecipe}
          onFavorite={toggleFavorite}
        />
      </DialogContent>
    </Dialog>

    <Dialog open={quick !== null} onOpenChange={(open) => !working && !open && setQuick(null)}>
      <DialogContent className="bottom-0 top-auto max-h-[92svh] max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl p-5 sm:bottom-auto sm:top-1/2 sm:max-w-3xl sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader><DialogTitle>{quick?.id ? 'Edit diary entry' : 'Quick add'}</DialogTitle><DialogDescription>{quick?.id ? 'Adjust this saved snapshot without changing its food identity.' : 'Enter calories and macros without creating a food.'}</DialogDescription></DialogHeader>
        {quick && <QuickEditor draft={quick} setDraft={setQuick} onSave={saveQuick} onClose={() => setQuick(null)} />}
      </DialogContent>
    </Dialog>

    <Dialog open={showPlans} onOpenChange={(open) => !working && setShowPlans(open)}>
      <DialogContent className="bottom-0 top-auto h-[94svh] max-h-[94svh] max-w-none translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl p-5 sm:bottom-auto sm:top-1/2 sm:h-auto sm:max-h-[88svh] sm:max-w-4xl sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader><DialogTitle>Saved meals & recipes</DialogTitle><DialogDescription>Build reusable combinations from the foods already in your library.</DialogDescription></DialogHeader>
        <ReusableFoodPlans
          foods={foods}
          savedMeals={savedMeals}
          savedMealItems={savedMealItems}
          recipes={recipes}
          recipeIngredients={recipeIngredients}
          onCreateMeal={createSavedMeal}
          onCreateRecipe={createRecipe}
          onLogMeal={async (id, mealType) => { await logSavedMeal(id, mealType); setShowPlans(false) }}
          onLogRecipe={async (id, servingCount, mealType) => { await logRecipe(id, servingCount, mealType); setShowPlans(false) }}
          onDeleteMeal={deleteSavedMeal}
          onDeleteRecipe={deleteRecipe}
        />
      </DialogContent>
    </Dialog>

    <Dialog open={mealTools !== null} onOpenChange={(open) => !working && !open && setMealTools(null)}>
      <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-b-none rounded-t-3xl p-5 sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader><DialogTitle>{mealTools ? `${mealLabels[mealTools]} quick tools` : 'Meal quick tools'}</DialogTitle><DialogDescription>Reuse or reorganize every diary item in this meal.</DialogDescription></DialogHeader>
        {mealTools && <MealTools
          mealType={mealTools}
          date={date}
          working={working}
          onQuickAdd={() => { setQuick({ ...blankQuick, meal_type: mealTools }); setMealTools(null) }}
          onDuplicate={() => copyMeal(mealTools, date)}
          onMove={(destination) => moveMeal(mealTools, destination)}
          onCopy={(destination) => copyMeal(mealTools, destination)}
        />}
      </DialogContent>
    </Dialog>

    <Dialog open={entryTools !== null} onOpenChange={(open) => !working && !open && setEntryTools(null)}>
      <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-b-none rounded-t-3xl p-5 sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader><DialogTitle>{entryTools?.name ?? 'Diary item'}</DialogTitle><DialogDescription>Edit, move, copy, duplicate or delete this saved nutrient snapshot.</DialogDescription></DialogHeader>
        {entryTools && <EntryTools
          entry={entryTools}
          date={date}
          working={working}
          onEdit={() => { editEntry(entryTools); setEntryTools(null) }}
          onDuplicate={async () => { await copyEntry(entryTools, date); setEntryTools(null) }}
          onMove={(destination) => moveEntry(entryTools, destination)}
          onCopy={async (destination) => { await copyEntry(entryTools, destination); setEntryTools(null) }}
          onDelete={async () => { await deleteEntry(entryTools.id); setEntryTools(null) }}
        />}
      </DialogContent>
    </Dialog>

    {loading ? <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading nutrition data…</div> : <>
      {view === 'diary' && <NutritionDiary
        date={date}
        setDate={setDate}
        entries={entries}
        totals={totals}
        targets={targets}
        days={days}
        averageCalories={averageCalories}
        averageProtein={averageProtein}
        adherence={adherence}
        working={working}
        onAddFood={(type) => { setFoodMealType(type); setShowFood(true) }}
        onQuick={(type) => setQuick({ ...blankQuick, meal_type: type })}
        onEdit={editEntry}
        onDuplicate={(entry) => copyEntry(entry, date)}
        onEntryTools={setEntryTools}
        onMealTools={setMealTools}
      />}
      {view === 'foods' && <FoodLibrary foods={foods} favoriteIds={favoriteIds} onFavorite={toggleFavorite} onCreate={createCustomFood} />}
    </>}
  </div>
}

function MealTools({ mealType, date, working, onQuickAdd, onDuplicate, onMove, onCopy }: {
  mealType: MealType
  date: string
  working: boolean
  onQuickAdd: () => void
  onDuplicate: () => Promise<void>
  onMove: (destination: MealType) => Promise<void>
  onCopy: (destination: string) => Promise<void>
}) {
  const [destinationMeal, setDestinationMeal] = useState<MealType>(mealType === 'other' ? 'snack' : 'other')
  const [destinationDate, setDestinationDate] = useState(date)

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="h-12 justify-start" onClick={onQuickAdd}><Plus /> Quick add</Button>
      <Button variant="outline" className="h-12 justify-start" disabled={working} onClick={onDuplicate}><Copy /> Duplicate meal</Button>
    </div>
    <div className="rounded-2xl bg-muted/45 p-4">
      <label>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Move all items to</span>
        <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={destinationMeal} onChange={(event) => setDestinationMeal(event.target.value as MealType)}>
          {mealTypes.filter((type) => type !== mealType).map((type) => <option key={type} value={type}>{mealLabels[type]}</option>)}
        </select>
      </label>
      <Button className="mt-3 w-full" variant="secondary" disabled={working} onClick={() => onMove(destinationMeal)}><Utensils /> Move meal</Button>
    </div>
    <div className="rounded-2xl bg-muted/45 p-4">
      <label>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Copy all items to date</span>
        <Input className="h-11 rounded-xl" type="date" value={destinationDate} onChange={(event) => setDestinationDate(event.target.value)} />
      </label>
      <Button className="mt-3 w-full" variant="secondary" disabled={working || !destinationDate} onClick={() => onCopy(destinationDate)}><CalendarDays /> Copy meal</Button>
    </div>
  </div>
}

function EntryTools({ entry, date, working, onEdit, onDuplicate, onMove, onCopy, onDelete }: {
  entry: NutritionEntryRow
  date: string
  working: boolean
  onEdit: () => void
  onDuplicate: () => Promise<void>
  onMove: (destination: MealType) => Promise<void>
  onCopy: (destination: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [destinationMeal, setDestinationMeal] = useState<MealType>(entry.meal_type === 'other' ? 'snack' : 'other')
  const [destinationDate, setDestinationDate] = useState(date)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="h-12 justify-start" onClick={onEdit}><Pencil /> Edit snapshot</Button>
      <Button variant="outline" className="h-12 justify-start" disabled={working} onClick={onDuplicate}><Copy /> Duplicate</Button>
    </div>
    <div className="rounded-2xl bg-muted/45 p-4">
      <label>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Move to meal</span>
        <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={destinationMeal} onChange={(event) => setDestinationMeal(event.target.value as MealType)}>
          {mealTypes.filter((type) => type !== entry.meal_type).map((type) => <option key={type} value={type}>{mealLabels[type]}</option>)}
        </select>
      </label>
      <Button className="mt-3 w-full" variant="secondary" disabled={working} onClick={() => onMove(destinationMeal)}><Utensils /> Move item</Button>
    </div>
    <div className="rounded-2xl bg-muted/45 p-4">
      <label>
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Copy to date</span>
        <Input className="h-11 rounded-xl" type="date" value={destinationDate} onChange={(event) => setDestinationDate(event.target.value)} />
      </label>
      <Button className="mt-3 w-full" variant="secondary" disabled={working || !destinationDate} onClick={() => onCopy(destinationDate)}><CalendarDays /> Copy item</Button>
    </div>
    {!confirmDelete
      ? <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete item</Button>
      : <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium">Delete this diary item?</p>
        <p className="mt-1 text-xs text-muted-foreground">This only removes the selected snapshot.</p>
        <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setConfirmDelete(false)}>Keep</Button><Button variant="destructive" disabled={working} onClick={onDelete}>Delete</Button></div>
      </div>}
  </div>
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

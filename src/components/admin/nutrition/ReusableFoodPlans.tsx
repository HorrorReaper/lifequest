'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Plus, Save, Trash2, Utensils, X } from 'lucide-react'
import type {
  FoodItemRow,
  MealType,
  RecipeIngredientRow,
  RecipeRow,
  SavedMealItemRow,
  SavedMealRow,
} from '@/lib/supabase/database.types'
import { recipePerServing } from '@/lib/nutrition/calculations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type ReusableItemDraft = { foodId: string; grams: number }

export function ReusableFoodPlans({
  foods,
  savedMeals,
  savedMealItems,
  recipes,
  recipeIngredients,
  onCreateMeal,
  onCreateRecipe,
  onLogMeal,
  onLogRecipe,
  onDeleteMeal,
  onDeleteRecipe,
}: {
  foods: FoodItemRow[]
  savedMeals: SavedMealRow[]
  savedMealItems: SavedMealItemRow[]
  recipes: RecipeRow[]
  recipeIngredients: RecipeIngredientRow[]
  onCreateMeal: (name: string, items: ReusableItemDraft[]) => Promise<void>
  onCreateRecipe: (name: string, servings: number, yieldWeight: number | null, items: ReusableItemDraft[]) => Promise<void>
  onLogMeal: (id: string, mealType: MealType) => Promise<void>
  onLogRecipe: (id: string, servings: number, mealType: MealType) => Promise<void>
  onDeleteMeal: (id: string) => Promise<void>
  onDeleteRecipe: (id: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'meals' | 'recipes'>('meals')
  const [builder, setBuilder] = useState<'meal' | 'recipe' | null>(null)
  const [name, setName] = useState('')
  const [servings, setServings] = useState(4)
  const [yieldWeight, setYieldWeight] = useState('')
  const [items, setItems] = useState<ReusableItemDraft[]>([])
  const [mealType, setMealType] = useState<MealType>('dinner')
  const [logServings, setLogServings] = useState(1)
  const [busy, setBusy] = useState(false)
  const foodMap = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods])

  function reset() {
    setBuilder(null)
    setName('')
    setServings(4)
    setYieldWeight('')
    setItems([])
  }

  function addFood(foodId: string) {
    if (!foodId || items.some((item) => item.foodId === foodId)) return
    const food = foodMap.get(foodId)
    setItems([...items, { foodId, grams: Number(food?.default_serving_grams ?? 100) }])
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !items.length || busy) return
    setBusy(true)
    try {
      if (builder === 'meal') await onCreateMeal(name.trim(), items)
      if (builder === 'recipe') await onCreateRecipe(name.trim(), servings, yieldWeight ? Number(yieldWeight) : null, items)
      reset()
    } finally {
      setBusy(false)
    }
  }

  if (builder) {
    const nutrition = builder === 'recipe'
      ? recipePerServing(items.map((item) => ({ food: foodMap.get(item.foodId)!, grams: item.grams })).filter((item) => item.food), servings)
      : null
    return <form onSubmit={save} className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
      <div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{builder === 'meal' ? 'Reusable group' : 'Ingredient-based nutrition'}</p><h2 className="text-xl font-semibold">New {builder}</h2></div><Button size="icon" variant="ghost" type="button" onClick={reset}><X /></Button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={builder === 'meal' ? 'Post-workout breakfast' : 'Protein pasta'} required />{builder === 'recipe' && <><NumberField label="Recipe servings" value={servings} onChange={setServings} /><label><span className="mb-1 block text-xs text-muted-foreground">Yield weight (optional)</span><Input type="number" min="0" value={yieldWeight} onChange={(event) => setYieldWeight(event.target.value)} placeholder="grams" /></label></>}</div>
      <select className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm" value="" onChange={(event) => addFood(event.target.value)}><option value="">Add ingredient…</option>{foods.filter((food) => !items.some((item) => item.foodId === food.id)).map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select>
      <div className="mt-4 space-y-2">{items.map((item, index) => <div key={item.foodId} className="flex items-center gap-3 rounded-xl bg-muted/45 p-3"><span className="min-w-0 flex-1 truncate text-sm font-medium">{foodMap.get(item.foodId)?.name}</span><Input className="w-28" type="number" min="0.01" step="0.1" value={item.grams} onChange={(event) => setItems(items.map((candidate, itemIndex) => itemIndex === index ? { ...candidate, grams: Math.max(0, Number(event.target.value)) } : candidate))} /><span className="text-xs text-muted-foreground">g</span><Button size="icon" variant="ghost" type="button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button></div>)}</div>
      {nutrition && <p className="mt-4 rounded-xl bg-primary/5 p-3 text-sm">Per serving: <strong>{Math.round(nutrition.calories)} kcal</strong> · {Math.round(nutrition.protein)}g protein · {Math.round(nutrition.carbs)}g carbs · {Math.round(nutrition.fat)}g fat</p>}
      <Button className="mt-5" type="submit" disabled={busy || !items.length}><Save /> {busy ? 'Saving…' : `Save ${builder}`}</Button>
    </form>
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Log repeat meals in seconds</p><h2 className="text-xl font-semibold">Saved meals & recipes</h2></div><div className="flex gap-2"><Button variant="outline" onClick={() => setBuilder('meal')}><Utensils /> New meal</Button><Button onClick={() => setBuilder('recipe')}><BookOpen /> New recipe</Button></div></div>
    <div className="flex rounded-xl bg-muted p-1"><button className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === 'meals' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`} onClick={() => setMode('meals')}>Saved meals</button><button className={`flex-1 rounded-lg px-3 py-2 text-sm ${mode === 'recipes' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`} onClick={() => setMode('recipes')}>Recipes</button></div>
    <div className="grid gap-3 lg:grid-cols-2">{mode === 'meals' ? savedMeals.map((meal) => {
      const components = savedMealItems.filter((item) => item.saved_meal_id === meal.id)
      return <article key={meal.id} className="rounded-2xl bg-card p-4 ring-1 ring-border"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="font-semibold">{meal.name}</h3><p className="mt-1 text-xs text-muted-foreground">{components.length} foods · {components.map((item) => foodMap.get(item.food_item_id)?.name).filter(Boolean).join(', ')}</p></div><Button size="icon" variant="ghost" onClick={() => onDeleteMeal(meal.id)}><Trash2 /></Button></div><LogControls mealType={mealType} setMealType={setMealType} onLog={() => onLogMeal(meal.id, mealType)} /></article>
    }) : recipes.map((recipe) => {
      const ingredients = recipeIngredients.filter((item) => item.recipe_id === recipe.id)
      return <article key={recipe.id} className="rounded-2xl bg-card p-4 ring-1 ring-border"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><h3 className="font-semibold">{recipe.name}</h3><p className="mt-1 text-xs text-muted-foreground">{ingredients.length} ingredients · {recipe.servings} recipe servings</p></div><Button size="icon" variant="ghost" onClick={() => onDeleteRecipe(recipe.id)}><Trash2 /></Button></div><div className="mt-3 flex items-end gap-2"><NumberField label="Servings" value={logServings} onChange={setLogServings} /><select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>{mealTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><Button onClick={() => onLogRecipe(recipe.id, logServings, mealType)}><Plus /> Log</Button></div></article>
    })}</div>
  </section>
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span className="mb-1 block text-xs text-muted-foreground">{label}</span><Input type="number" min="0.01" step="0.25" value={value} onChange={(event) => onChange(Math.max(0.01, Number(event.target.value)))} /></label>
}
function LogControls({ mealType, setMealType, onLog }: { mealType: MealType; setMealType: (type: MealType) => void; onLog: () => Promise<void> }) {
  return <div className="mt-3 flex gap-2"><select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>{mealTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><Button onClick={onLog}><Plus /> Log meal</Button></div>
}

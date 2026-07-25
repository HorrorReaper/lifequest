'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Barcode,
  BookOpen,
  Camera,
  ChevronLeft,
  Heart,
  Loader2,
  Plus,
  Search,
  Utensils,
} from 'lucide-react'
import type {
  FoodItemRow,
  FoodPortionRow,
  MealType,
  NutritionEntryRow,
  RecipeRow,
  SavedMealRow,
} from '@/lib/supabase/database.types'
import type { NormalizedFood, ProviderStatus } from '@/lib/nutrition/food-types'
import { scaleNutrients } from '@/lib/nutrition/calculations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  defaultFoodPortion,
  rankDiaryFoods,
  type FoodSearchTab,
} from './diary-utils'

type ScannerControls = { stop: () => void }
type SearchTab = FoodSearchTab | 'saved_meals' | 'recipes'

const searchTabs: Array<{ value: SearchTab; label: string }> = [
  { value: 'recent', label: 'Recent' },
  { value: 'frequent', label: 'Frequent' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'my_foods', label: 'My Foods' },
  { value: 'saved_meals', label: 'Saved Meals' },
  { value: 'recipes', label: 'Recipes' },
]

export function FoodSearchPanel({
  foods,
  portions,
  historyEntries,
  favoriteIds,
  savedMeals,
  recipes,
  initialMealType,
  onClose,
  onLog,
  onLogSavedMeal,
  onLogRecipe,
  onFavorite,
}: {
  foods: FoodItemRow[]
  portions: FoodPortionRow[]
  historyEntries: NutritionEntryRow[]
  favoriteIds: Set<string>
  savedMeals: SavedMealRow[]
  recipes: RecipeRow[]
  initialMealType: MealType
  onClose: () => void
  onLog: (food: FoodItemRow, servingGrams: number, servingCount: number, mealType: MealType, servingLabel?: string) => Promise<void>
  onLogSavedMeal: (id: string, mealType: MealType) => Promise<void>
  onLogRecipe: (id: string, servingCount: number, mealType: MealType) => Promise<void>
  onFavorite: (food: FoodItemRow) => Promise<void>
}) {
  const [tab, setTab] = useState<SearchTab>('recent')
  const [query, setQuery] = useState('')
  const [external, setExternal] = useState<NormalizedFood[]>([])
  const [providers, setProviders] = useState<ProviderStatus | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<FoodItemRow | null>(null)
  const [selectedPortionId, setSelectedPortionId] = useState('')
  const [servingGrams, setServingGrams] = useState(100)
  const [servingCount, setServingCount] = useState(1)
  const [mealType, setMealType] = useState<MealType>(initialMealType)
  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<ScannerControls | null>(null)
  const scanLockedRef = useRef(false)

  const local = useMemo(() => {
    if (tab === 'saved_meals' || tab === 'recipes') return []
    const needle = query.trim().toLowerCase()
    const ranked = rankDiaryFoods(foods, historyEntries, tab, favoriteIds)
    const fallback = tab === 'recent' && !ranked.length
      ? [...foods].sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      : ranked
    return (needle
      ? fallback.filter((food) => `${food.name} ${food.brand ?? ''} ${food.barcode ?? ''}`.toLowerCase().includes(needle))
      : fallback
    ).slice(0, 30)
  }, [favoriteIds, foods, historyEntries, query, tab])

  const matchingSavedMeals = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return savedMeals.filter((meal) => !needle || meal.name.toLowerCase().includes(needle))
  }, [query, savedMeals])

  const matchingRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return recipes.filter((recipe) => !needle || recipe.name.toLowerCase().includes(needle))
  }, [query, recipes])

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 2 || tab === 'saved_meals' || tab === 'recipes') {
      setExternal([])
      setProviders(null)
      setSearching(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        const response = await fetch(`/api/admin/nutrition/foods/search?q=${encodeURIComponent(needle)}`, { signal: controller.signal })
        const payload = await response.json() as { foods?: NormalizedFood[]; providers?: ProviderStatus; error?: string }
        if (!response.ok) throw new Error(payload.error || 'Food search failed.')
        setExternal(payload.foods ?? [])
        setProviders(payload.providers ?? null)
      } catch (caught) {
        if (!controller.signal.aborted) {
          setExternal([])
          setProviders(null)
          setError(`${caught instanceof Error ? caught.message : 'Food search failed.'} Your saved foods are still available.`)
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, tab])

  useEffect(() => () => scannerRef.current?.stop(), [])

  const selectedPortions = useMemo(() => {
    if (!selected) return []
    const stored = portions.filter((portion) => portion.food_item_id === selected.id)
    const fallback = defaultFoodPortion(selected, portions)
    return stored.length ? stored : [fallback]
  }, [portions, selected])

  function selectLocal(food: FoodItemRow) {
    const defaultPortion = defaultFoodPortion(food, portions)
    setSelected(food)
    setSelectedPortionId(defaultPortion.id)
    setServingGrams(Number(defaultPortion.grams))
    setServingCount(1)
  }

  async function quickLog(food: FoodItemRow) {
    if (busy) return
    const portion = defaultFoodPortion(food, portions)
    setBusy(true)
    setError(null)
    try {
      await onLog(food, Number(portion.grams), 1, mealType, portion.label)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Food could not be added.')
    } finally {
      setBusy(false)
    }
  }

  async function importExternal(food: NormalizedFood) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/nutrition/foods/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: food.source, externalId: food.externalId }),
      })
      const payload = await response.json() as { food?: FoodItemRow; error?: string }
      if (!response.ok || !payload.food) throw new Error(payload.error || 'Food could not be imported.')
      selectLocal(payload.food)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Food could not be imported.')
    } finally {
      setBusy(false)
    }
  }

  async function lookupBarcode(code = barcode) {
    if (scanLockedRef.current) return
    const normalized = code.replace(/\D/g, '')
    if (normalized.length < 8) {
      setError('Enter a valid 8–14 digit barcode.')
      return
    }
    scanLockedRef.current = true
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/nutrition/foods/barcode/${normalized}`)
      const payload = await response.json() as { food?: NormalizedFood; error?: string }
      if (!response.ok || !payload.food) throw new Error(payload.error || 'Barcode not found.')
      await importExternal(payload.food)
      stopScanner()
    } catch (caught) {
      setError(`${caught instanceof Error ? caught.message : 'Barcode not found.'} You can search or add it manually.`)
    } finally {
      scanLockedRef.current = false
      setBusy(false)
    }
  }

  async function startScanner() {
    setError(null)
    setScanning(true)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      scannerRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        const code = result?.getText()
        if (code) {
          setBarcode(code)
          void lookupBarcode(code)
        }
      })
    } catch {
      setScanning(false)
      setError('Camera scanning is unavailable. You can still type the barcode.')
    }
  }

  function stopScanner() {
    scannerRef.current?.stop()
    scannerRef.current = null
    setScanning(false)
  }

  async function logReusable(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This item could not be logged.')
    } finally {
      setBusy(false)
    }
  }

  const nutrients = selected ? scaleNutrients(selected, servingGrams, servingCount) : null
  const activePortion = selectedPortions.find((portion) => portion.id === selectedPortionId)

  return <section className="flex h-full min-h-0 flex-col">
    <div className="border-b px-5 pb-4 pt-5 sm:px-6">
      <div className="flex items-start gap-3">
        {selected && <Button size="icon" variant="ghost" onClick={() => setSelected(null)} aria-label="Back to food search"><ChevronLeft /></Button>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Food diary</p>
          <h2 className="truncate text-xl font-semibold">{selected ? 'Review portion' : 'Add food'}</h2>
        </div>
        <label className="w-32">
          <span className="sr-only">Meal</span>
          <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm capitalize" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>
            {mealTypes.map((type) => <option key={type} value={type}>{mealLabel(type)}</option>)}
          </select>
        </label>
      </div>
    </div>

    {error && <div role="alert" className="mx-5 mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive sm:mx-6">{error}</div>}

    {!selected ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-4 sm:px-6 sm:pb-6">
      <label className="relative block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 rounded-xl pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods, brands, or barcode" autoFocus />
      </label>

      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6">
        {searchTabs.map((item) => <button
          key={item.value}
          type="button"
          onClick={() => setTab(item.value)}
          className={cn(
            'shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-colors',
            tab === item.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >{item.label}</button>)}
      </div>

      {tab !== 'saved_meals' && tab !== 'recipes' && <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
        <Input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ''))} placeholder="Manual barcode" />
        <Button variant="outline" size="icon" onClick={() => lookupBarcode()} disabled={busy} aria-label="Look up barcode"><Barcode /></Button>
        <Button variant="outline" size="icon" onClick={scanning ? stopScanner : startScanner} aria-label={scanning ? 'Stop scanner' : 'Scan barcode'}><Camera /></Button>
      </div>}
      {scanning && <video ref={videoRef} className="mt-3 aspect-video w-full rounded-2xl bg-black object-cover" muted playsInline />}

      {providers && <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <ProviderPill label="USDA" status={providers.usda} />
        <ProviderPill label="Open Food Facts" status={providers.openFoodFacts} />
      </div>}

      <div className="mt-5 space-y-2">
        {local.map((food) => <FoodResult
          key={food.id}
          name={food.name}
          brand={food.brand}
          calories={Number(food.calories_per_100g)}
          source={defaultFoodPortion(food, portions).label}
          favorite={favoriteIds.has(food.id)}
          onOpen={() => selectLocal(food)}
          onQuickAdd={() => quickLog(food)}
          disabled={busy}
        />)}
        {searching && <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Searching providers…</div>}
        {external.map((food) => <FoodResult
          key={`${food.source}:${food.externalId}`}
          name={food.name}
          brand={food.brand}
          calories={food.caloriesPer100g}
          source={food.attribution}
          onOpen={() => importExternal(food)}
          disabled={busy}
        />)}
        {tab === 'saved_meals' && matchingSavedMeals.map((meal) => <ReusableResult
          key={meal.id}
          icon={<Utensils />}
          title={meal.name}
          description="Saved meal"
          disabled={busy}
          onLog={() => logReusable(() => onLogSavedMeal(meal.id, mealType))}
        />)}
        {tab === 'recipes' && matchingRecipes.map((recipe) => <ReusableResult
          key={recipe.id}
          icon={<BookOpen />}
          title={recipe.name}
          description={`${recipe.servings} recipe servings`}
          disabled={busy}
          onLog={() => logReusable(() => onLogRecipe(recipe.id, 1, mealType))}
        />)}
        {!local.length && !external.length && !searching && tab !== 'saved_meals' && tab !== 'recipes' && <EmptySearch tab={tab} query={query} />}
        {tab === 'saved_meals' && !matchingSavedMeals.length && <p className="py-8 text-center text-sm text-muted-foreground">No saved meals match this search.</p>}
        {tab === 'recipes' && !matchingRecipes.length && <p className="py-8 text-center text-sm text-muted-foreground">No recipes match this search.</p>}
      </div>
    </div> : <div className="overflow-y-auto px-5 pb-28 pt-5 sm:px-6 sm:pb-6">
      <div className="rounded-2xl bg-muted/45 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{selected.name}</h3>
            <p className="text-xs text-muted-foreground">{selected.brand || 'Generic'} · {selected.source.replaceAll('_', ' ')}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => onFavorite(selected)} aria-label={favoriteIds.has(selected.id) ? 'Remove favorite' : 'Add favorite'}>
            <Heart className={cn(favoriteIds.has(selected.id) && 'fill-current text-rose-500')} />
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Portion</span>
          <select
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
            value={selectedPortionId}
            onChange={(event) => {
              const portion = selectedPortions.find((candidate) => candidate.id === event.target.value)
              setSelectedPortionId(event.target.value)
              if (portion) setServingGrams(Number(portion.grams))
            }}
          >
            {selectedPortions.map((portion) => <option key={portion.id} value={portion.id}>{portion.label} · {portion.grams} g</option>)}
            <option value="custom">Custom grams</option>
          </select>
        </label>
        <NumberField label="Number of servings" value={servingCount} onChange={setServingCount} step={0.25} />
      </div>
      <div className="mt-4">
        <NumberField label="Grams per serving" value={servingGrams} onChange={(value) => {
          setSelectedPortionId('custom')
          setServingGrams(value)
        }} step={0.1} />
      </div>

      {nutrients && <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-primary/5 p-4 text-center">
        <Nutrient label="kcal" value={nutrients.calories} />
        <Nutrient label="protein" value={nutrients.protein} unit="g" />
        <Nutrient label="carbs" value={nutrients.carbs} unit="g" />
        <Nutrient label="fat" value={nutrients.fat} unit="g" />
      </div>}
      <p className="mt-3 text-xs text-muted-foreground">Nutrition is saved as a diary snapshot, so later food changes do not rewrite history.</p>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
        <Button className="h-12 w-full" disabled={busy || servingGrams <= 0 || servingCount <= 0} onClick={() => logReusable(() => onLog(selected, servingGrams, servingCount, mealType, activePortion?.label))}>
          {busy ? <><Loader2 className="animate-spin" /> Adding…</> : <><Plus /> Add to {mealLabel(mealType)}</>}
        </Button>
      </div>
    </div>}
  </section>
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  other: 'Other',
}

function mealLabel(value: MealType) {
  return mealLabels[value]
}

function FoodResult({ name, brand, calories, source, favorite, onOpen, onQuickAdd, disabled }: {
  name: string
  brand: string | null
  calories: number
  source: string
  favorite?: boolean
  onOpen: () => void
  onQuickAdd?: () => void
  disabled?: boolean
}) {
  return <div className="flex items-center gap-2 rounded-2xl border p-2 transition-colors hover:bg-muted/35">
    <button className="min-w-0 flex-1 px-2 py-1.5 text-left" onClick={onOpen} disabled={disabled}>
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        {favorite && <Heart className="size-3.5 shrink-0 fill-current text-rose-500" />}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{brand || 'Generic'} · {source}</span>
      <span className="mt-1 block font-mono text-[11px] text-muted-foreground">{Math.round(calories)} kcal / 100 g</span>
    </button>
    {onQuickAdd && <Button variant="secondary" size="sm" onClick={onQuickAdd} disabled={disabled}><Plus /> Add</Button>}
  </div>
}

function ReusableResult({ icon, title, description, disabled, onLog }: {
  icon: React.ReactNode
  title: string
  description: string
  disabled: boolean
  onLog: () => void
}) {
  return <div className="flex items-center gap-3 rounded-2xl border p-3">
    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:size-4">{icon}</span>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{description}</p></div>
    <Button size="sm" onClick={onLog} disabled={disabled}><Plus /> Log</Button>
  </div>
}

function EmptySearch({ tab, query }: { tab: SearchTab; query: string }) {
  const message = query.trim().length >= 2
    ? 'No matching saved or provider food found.'
    : tab === 'favorites'
      ? 'Favorite foods appear here for one-tap logging.'
      : tab === 'my_foods'
        ? 'Create a custom food in the food library.'
        : 'Log foods to build this list automatically.'
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
}

function ProviderPill({ label, status }: { label: string; status: string }) {
  return <span className={cn('rounded-full bg-muted px-2 py-1', status !== 'ok' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300')}>{label}: {status}</span>
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label><span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span><Input className="h-11 rounded-xl" type="number" min="0.01" step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} /></label>
}

function Nutrient({ label, value, unit = '' }: { label: string; value: number; unit?: string }) {
  return <div><p className="font-mono font-semibold">{Math.round(value)}{unit}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
}

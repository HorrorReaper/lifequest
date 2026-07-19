'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Barcode, Camera, Heart, Loader2, Search, X } from 'lucide-react'
import type { FoodItemRow, MealType } from '@/lib/supabase/database.types'
import type { NormalizedFood, ProviderStatus } from '@/lib/nutrition/food-types'
import { scaleNutrients } from '@/lib/nutrition/calculations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type ScannerControls = { stop: () => void }

export function FoodSearchPanel({
  foods,
  favoriteIds,
  initialMealType,
  onClose,
  onLog,
  onFavorite,
}: {
  foods: FoodItemRow[]
  favoriteIds: Set<string>
  initialMealType: MealType
  onClose: () => void
  onLog: (food: FoodItemRow, servingGrams: number, servingCount: number, mealType: MealType) => Promise<void>
  onFavorite: (food: FoodItemRow) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [external, setExternal] = useState<NormalizedFood[]>([])
  const [providers, setProviders] = useState<ProviderStatus | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<FoodItemRow | null>(null)
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
    const needle = query.trim().toLowerCase()
    const sorted = [...foods].sort((a, b) => Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)) || a.name.localeCompare(b.name))
    return needle ? sorted.filter((food) => `${food.name} ${food.brand ?? ''} ${food.barcode ?? ''}`.toLowerCase().includes(needle)).slice(0, 20) : sorted.slice(0, 12)
  }, [favoriteIds, foods, query])

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 2) {
      setExternal([])
      setProviders(null)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/admin/nutrition/foods/search?q=${encodeURIComponent(needle)}`, { signal: controller.signal })
        const payload = await response.json() as { foods?: NormalizedFood[]; providers?: ProviderStatus; error?: string }
        if (!response.ok) throw new Error(payload.error || 'Food search failed.')
        setExternal(payload.foods ?? [])
        setProviders(payload.providers ?? null)
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Food search failed.')
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => () => scannerRef.current?.stop(), [])

  function selectLocal(food: FoodItemRow) {
    setSelected(food)
    setServingGrams(Number(food.default_serving_grams))
    setServingCount(1)
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
      setError(caught instanceof Error ? caught.message : 'Barcode not found.')
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

  const nutrients = selected ? scaleNutrients(selected, servingGrams, servingCount) : null

  return <section className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
    <div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Food database</p><h2 className="text-xl font-semibold">Add food</h2></div><Button size="icon" variant="ghost" onClick={onClose}><X /></Button></div>
    {error && <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {!selected ? <>
      <label className="relative mt-5 block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search foods, brands, or a barcode" autoFocus /></label>
      <div className="mt-3 flex gap-2"><Input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ''))} placeholder="Enter barcode" /><Button variant="outline" onClick={() => lookupBarcode()} disabled={busy}><Barcode /> Look up</Button><Button variant="outline" onClick={scanning ? stopScanner : startScanner}><Camera /> {scanning ? 'Stop' : 'Scan'}</Button></div>
      {scanning && <video ref={videoRef} className="mt-3 aspect-video w-full rounded-2xl bg-black object-cover" muted playsInline />}
      {providers && <p className="mt-3 text-[11px] text-muted-foreground">USDA: {providers.usda} · Open Food Facts: {providers.openFoodFacts}. Community food data should be verified against the package.</p>}
      <div className="mt-5 space-y-2">
        {local.map((food) => <FoodResult key={food.id} name={food.name} brand={food.brand} calories={Number(food.calories_per_100g)} source={food.source} favorite={favoriteIds.has(food.id)} onClick={() => selectLocal(food)} />)}
        {searching && <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Searching providers…</div>}
        {external.map((food) => <FoodResult key={`${food.source}:${food.externalId}`} name={food.name} brand={food.brand} calories={food.caloriesPer100g} source={food.attribution} onClick={() => importExternal(food)} />)}
        {!local.length && !external.length && !searching && <p className="py-8 text-center text-sm text-muted-foreground">{query.length < 2 ? 'Recent and favorite foods will appear here.' : 'No matching food found.'}</p>}
      </div>
    </> : <>
      <div className="mt-5 rounded-2xl bg-muted/45 p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="font-semibold">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.brand || 'Generic'} · {selected.source.replaceAll('_', ' ')}</p></div><Button size="icon" variant="ghost" onClick={() => onFavorite(selected)}><Heart className={cn(favoriteIds.has(selected.id) && 'fill-current text-rose-500')} /></Button><Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Change</Button></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><NumberField label="Grams per serving" value={servingGrams} onChange={setServingGrams} /><NumberField label="Number of servings" value={servingCount} onChange={setServingCount} step={0.25} /><label><span className="mb-1 block text-xs text-muted-foreground">Meal</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>{mealTypes.map((type) => <option key={type} value={type}>{capitalize(type)}</option>)}</select></label></div>
      {nutrients && <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl bg-primary/5 p-4 text-center"><Nutrient label="kcal" value={nutrients.calories} /><Nutrient label="protein" value={nutrients.protein} unit="g" /><Nutrient label="carbs" value={nutrients.carbs} unit="g" /><Nutrient label="fat" value={nutrients.fat} unit="g" /></div>}
      <Button className="mt-4 w-full" disabled={busy || servingGrams <= 0 || servingCount <= 0} onClick={async () => { setBusy(true); try { await onLog(selected, servingGrams, servingCount, mealType); onClose() } finally { setBusy(false) } }}>{busy ? 'Adding…' : 'Add to diary'}</Button>
    </>}
  </section>
}

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
function capitalize(value: string) { return value[0].toUpperCase() + value.slice(1) }
function FoodResult({ name, brand, calories, source, favorite, onClick }: { name: string; brand: string | null; calories: number; source: string; favorite?: boolean; onClick: () => void }) {
  return <button className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/45" onClick={onClick}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{name}</p><p className="truncate text-xs text-muted-foreground">{brand || 'Generic'} · {source.replaceAll('_', ' ')}</p></div><span className="font-mono text-xs">{Math.round(calories)} kcal/100g</span>{favorite && <Heart className="size-4 fill-current text-rose-500" />}</button>
}
function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label><span className="mb-1 block text-xs text-muted-foreground">{label}</span><Input type="number" min="0.01" step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} /></label>
}
function Nutrient({ label, value, unit = '' }: { label: string; value: number; unit?: string }) {
  return <div><p className="font-mono font-semibold">{Math.round(value)}{unit}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
}

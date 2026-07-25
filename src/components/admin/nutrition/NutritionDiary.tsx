'use client'

import { addDays, format } from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Zap,
} from 'lucide-react'
import type {
  MealType,
  NutritionEntryRow,
  NutritionTargetRow,
} from '@/lib/supabase/database.types'
import type { NutrientValues } from '@/lib/nutrition/calculations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  other: 'Other',
}

export function NutritionDiary({
  date,
  setDate,
  entries,
  totals,
  targets,
  days,
  averageCalories,
  averageProtein,
  adherence,
  working,
  onAddFood,
  onQuick,
  onEdit,
  onDuplicate,
  onEntryTools,
  onMealTools,
}: {
  date: string
  setDate: (date: string) => void
  entries: NutritionEntryRow[]
  totals: NutrientValues
  targets: NutritionTargetRow
  days: Array<{ date: string; calories: number; protein: number }>
  averageCalories: number
  averageProtein: number
  adherence: number
  working: boolean
  onAddFood: (type: MealType) => void
  onQuick: (type: MealType) => void
  onEdit: (entry: NutritionEntryRow) => void
  onDuplicate: (entry: NutritionEntryRow) => Promise<void>
  onEntryTools: (entry: NutritionEntryRow) => void
  onMealTools: (type: MealType) => void
}) {
  const foodCalories = Math.round(totals.calories)
  const remainingCalories = Math.round(targets.calories - totals.calories)

  function shiftDate(amount: number) {
    setDate(format(addDays(new Date(`${date}T12:00:00`), amount), 'yyyy-MM-dd'))
  }

  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-border">
        <div className="flex items-center justify-between gap-2 border-b p-3 sm:px-5">
          <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)} aria-label="Previous day"><ChevronLeft /></Button>
          <label className="relative min-w-0 flex-1 text-center">
            <span className="block truncate text-sm font-semibold sm:text-base">{format(new Date(`${date}T12:00:00`), 'EEEE, d MMMM')}</span>
            <span className="text-[11px] text-muted-foreground">{date}</span>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Choose diary date"
            />
          </label>
          <Button variant="ghost" size="icon" onClick={() => shiftDate(1)} aria-label="Next day"><ChevronRight /></Button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center">
            <EquationValue value={targets.calories} label="Goal" />
            <span className="text-lg text-muted-foreground">−</span>
            <EquationValue value={foodCalories} label="Food" />
            <span className="text-lg text-muted-foreground">=</span>
            <EquationValue value={remainingCalories} label="Remaining" accent />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <MacroProgress label="Protein" value={totals.protein} target={Number(targets.protein_g)} />
            <MacroProgress label="Carbs" value={totals.carbs} target={Number(targets.carbs_g)} />
            <MacroProgress label="Fat" value={totals.fat} target={Number(targets.fat_g)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
            <span>Fiber {Math.round(totals.fiber)} g</span>
            <span>Sugar {Math.round(totals.sugar)} g</span>
            <span>Sodium {Math.round(totals.sodium)} mg</span>
          </div>
        </div>
      </div>

      {mealTypes.map((type) => {
        const mealEntries = entries.filter((entry) => entry.meal_type === type)
        const calories = mealEntries.reduce((sum, entry) => sum + entry.calories, 0)
        return <article key={type} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{mealLabels[type]}</h3>
              <p className="text-xs text-muted-foreground">{Math.round(calories)} kcal</p>
            </div>
            <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => onQuick(type)}><Zap /> Quick add</Button>
            <Button size="sm" variant="outline" onClick={() => onAddFood(type)}><Plus /> <span className="hidden min-[360px]:inline">Add food</span></Button>
            <Button size="icon" variant="ghost" onClick={() => onMealTools(type)} aria-label={`${mealLabels[type]} quick tools`}><MoreHorizontal /></Button>
          </div>

          <div className="divide-y">
            {mealEntries.map((entry) => <div key={entry.id} className="group flex items-center gap-2 px-4 py-3 sm:px-5">
              <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(entry)}>
                <span className="block truncate text-sm font-medium">{entry.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {entry.serving_label || entry.entry_kind.replaceAll('_', ' ')}
                </span>
                <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                  {entry.calories} kcal · {Math.round(Number(entry.protein_g))}P · {Math.round(Number(entry.carbs_g))}C · {Math.round(Number(entry.fat_g))}F
                </span>
              </button>
              <Button size="icon" variant="ghost" className="hidden sm:inline-flex" onClick={() => onEdit(entry)} aria-label={`Edit ${entry.name}`}><Pencil /></Button>
              <Button size="icon" variant="ghost" className="hidden sm:inline-flex" disabled={working} onClick={() => onDuplicate(entry)} aria-label={`Duplicate ${entry.name}`}><Copy /></Button>
              <Button size="icon" variant="ghost" onClick={() => onEntryTools(entry)} aria-label={`More actions for ${entry.name}`}><MoreHorizontal /></Button>
            </div>)}
            {!mealEntries.length && <button className="flex w-full items-center justify-center gap-2 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/35 hover:text-foreground" onClick={() => onAddFood(type)}><Plus className="size-4" /> Add your first item</button>}
          </div>
        </article>
      })}
    </div>

    <aside className="space-y-5">
      <div className="rounded-[1.75rem] bg-primary p-6 text-primary-foreground">
        <div className="flex items-center gap-2 text-sm opacity-75"><CalendarDays className="size-4" /> Daily balance</div>
        <p className="mt-4 font-mono text-5xl font-semibold tracking-[-0.07em]">{remainingCalories}</p>
        <p className="text-sm opacity-70">kilocalories remaining</p>
        <div className="mt-7 grid grid-cols-3 gap-2 text-center">
          <Remaining label="Protein" value={Number(targets.protein_g) - totals.protein} />
          <Remaining label="Carbs" value={Number(targets.carbs_g) - totals.carbs} />
          <Remaining label="Fat" value={Number(targets.fat_g) - totals.fat} />
        </div>
      </div>

      <div className="rounded-[1.75rem] bg-card p-5 ring-1 ring-border">
        <h2 className="font-semibold">Seven-day view</h2>
        <div className="mt-5 flex h-28 items-end gap-2">
          {days.map((day) => <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={cn('w-full rounded-t-md', day.calories > targets.calories * 1.1 ? 'bg-amber-500' : 'bg-primary/75')}
              style={{ height: `${Math.max(4, Math.min(88, day.calories / Math.max(1, targets.calories) * 72))}px` }}
              title={`${day.calories} kcal`}
            />
            <span className="text-[10px] text-muted-foreground">{format(new Date(`${day.date}T12:00:00`), 'EE')}</span>
          </div>)}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <WeeklyStat label="Avg kcal" value={averageCalories} />
          <WeeklyStat label="Avg protein" value={`${averageProtein}g`} />
          <WeeklyStat label="Adherence" value={`${adherence}%`} />
        </div>
      </div>
    </aside>
  </section>
}

function EquationValue({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return <div className={cn('min-w-0 rounded-2xl px-1 py-3', accent && 'bg-primary/10 text-primary')}>
    <p className="truncate font-mono text-xl font-semibold sm:text-2xl">{Math.round(value)}</p>
    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
  </div>
}

function MacroProgress({ label, value, target }: { label: string; value: number; target: number }) {
  const ratio = target ? value / target : 0
  return <div className="rounded-xl bg-muted/45 p-3">
    <div className="flex items-baseline justify-between gap-1">
      <p className="text-xs font-medium">{label}</p>
      <p className={cn('font-mono text-[10px]', ratio > 1.1 && 'text-amber-600')}>{Math.round(value)}/{Math.round(target)}g</p>
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
      <div className={cn('h-full rounded-full', ratio > 1.1 ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  </div>
}

function Remaining({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-primary-foreground/10 p-3"><p className="font-mono text-lg">{Math.round(value)}g</p><p className="text-[10px] opacity-65">{label}</p></div>
}

function WeeklyStat({ label, value }: { label: string; value: string | number }) {
  return <div><p className="font-mono text-lg font-semibold">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>
}

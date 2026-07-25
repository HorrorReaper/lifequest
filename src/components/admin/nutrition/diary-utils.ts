import type {
  FoodItemRow,
  FoodPortionRow,
  MealType,
  NutritionEntryRow,
} from '@/lib/supabase/database.types'

export type FoodSearchTab = 'recent' | 'frequent' | 'favorites' | 'my_foods'

type FoodUsage = {
  count: number
  lastUsedAt: string
}

export type EditableEntrySnapshot = {
  meal_type: MealType
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
  notes: string | null
  updated_at: string
}

export function foodUsageById(entries: NutritionEntryRow[]) {
  const usage = new Map<string, FoodUsage>()

  for (const entry of entries) {
    if (!entry.food_item_id) continue
    const usedAt = `${entry.entry_date}T${entry.created_at.split('T')[1] ?? '00:00:00'}`
    const current = usage.get(entry.food_item_id)
    usage.set(entry.food_item_id, {
      count: (current?.count ?? 0) + 1,
      lastUsedAt: current && current.lastUsedAt > usedAt ? current.lastUsedAt : usedAt,
    })
  }

  return usage
}

export function rankDiaryFoods(
  foods: FoodItemRow[],
  entries: NutritionEntryRow[],
  tab: FoodSearchTab,
  favoriteIds: Set<string>,
) {
  const usage = foodUsageById(entries)
  const filtered = foods.filter((food) => {
    if (tab === 'favorites') return favoriteIds.has(food.id)
    if (tab === 'my_foods') return food.source === 'custom'
    return usage.has(food.id)
  })

  return filtered.sort((left, right) => {
    const leftUsage = usage.get(left.id)
    const rightUsage = usage.get(right.id)

    if (tab === 'frequent') {
      const countDifference = (rightUsage?.count ?? 0) - (leftUsage?.count ?? 0)
      if (countDifference) return countDifference
    }

    const recencyDifference = (rightUsage?.lastUsedAt ?? '').localeCompare(leftUsage?.lastUsedAt ?? '')
    if (recencyDifference) return recencyDifference
    return left.name.localeCompare(right.name)
  })
}

export function defaultFoodPortion(food: FoodItemRow, portions: FoodPortionRow[]) {
  const foodPortions = portions.filter((portion) => portion.food_item_id === food.id)
  const portion = foodPortions.find((candidate) => candidate.is_default) ?? foodPortions[0]

  return portion ?? {
    id: `default:${food.id}`,
    food_item_id: food.id,
    label: food.default_serving_label || `${food.default_serving_grams} g`,
    grams: Number(food.default_serving_grams),
    is_default: true,
    created_at: food.created_at,
  }
}

export function buildSnapshotPreservingEdit(
  draft: Omit<EditableEntrySnapshot, 'updated_at'>,
  now = new Date().toISOString(),
): EditableEntrySnapshot {
  return {
    ...draft,
    name: draft.name.trim(),
    calories: Math.round(Math.max(0, draft.calories)),
    protein_g: Math.max(0, draft.protein_g),
    carbs_g: Math.max(0, draft.carbs_g),
    fat_g: Math.max(0, draft.fat_g),
    fiber_g: Math.max(0, draft.fiber_g),
    sugar_g: Math.max(0, draft.sugar_g),
    sodium_mg: Math.max(0, draft.sodium_mg),
    notes: draft.notes?.trim() || null,
    updated_at: now,
  }
}

export function copyEntrySnapshot(
  entry: NutritionEntryRow,
  overrides: Partial<Pick<NutritionEntryRow, 'entry_date' | 'meal_type'>> = {},
) {
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...snapshot } = entry
  void _id
  void _createdAt
  void _updatedAt

  return {
    ...snapshot,
    ...overrides,
  }
}

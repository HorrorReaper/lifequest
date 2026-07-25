import { describe, expect, it } from 'vitest'
import type {
  FoodItemRow,
  FoodPortionRow,
  NutritionEntryRow,
} from '@/lib/supabase/database.types'
import {
  buildSnapshotPreservingEdit,
  copyEntrySnapshot,
  defaultFoodPortion,
  rankDiaryFoods,
} from './diary-utils'

const food = (id: string, source: FoodItemRow['source'] = 'custom'): FoodItemRow => ({
  id,
  user_id: 'user',
  source,
  external_id: null,
  barcode: null,
  name: id,
  brand: null,
  calories_per_100g: 100,
  protein_per_100g: 10,
  carbs_per_100g: 10,
  fat_per_100g: 2,
  fiber_per_100g: 1,
  sugar_per_100g: 1,
  sodium_mg_per_100g: 20,
  default_serving_grams: 100,
  default_serving_label: '100 g',
  source_updated_at: null,
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

const entry = (
  id: string,
  foodItemId: string,
  date: string,
  createdAt = `${date}T12:00:00Z`,
): NutritionEntryRow => ({
  id,
  user_id: 'user',
  entry_date: date,
  meal_type: 'breakfast',
  name: foodItemId,
  entry_kind: 'food',
  food_item_id: foodItemId,
  serving_grams: 50,
  serving_count: 1,
  serving_label: '1 × 50 g',
  calories: 50,
  protein_g: 5,
  carbs_g: 5,
  fat_g: 1,
  fiber_g: 0.5,
  sugar_g: 0.5,
  sodium_mg: 10,
  source_id: null,
  source_details: { source: 'custom' },
  notes: null,
  created_at: createdAt,
  updated_at: createdAt,
})

describe('nutrition diary utilities', () => {
  it('ranks recent and frequent foods from diary history', () => {
    const foods = [food('oats'), food('yogurt'), food('banana')]
    const history = [
      entry('1', 'oats', '2026-07-20'),
      entry('2', 'oats', '2026-07-21'),
      entry('3', 'yogurt', '2026-07-24'),
    ]

    expect(rankDiaryFoods(foods, history, 'recent', new Set()).map((item) => item.id))
      .toEqual(['yogurt', 'oats'])
    expect(rankDiaryFoods(foods, history, 'frequent', new Set()).map((item) => item.id))
      .toEqual(['oats', 'yogurt'])
  })

  it('selects a stored default portion and falls back to the food serving', () => {
    const oats = food('oats')
    const portions: FoodPortionRow[] = [
      { id: 'cup', food_item_id: 'oats', label: '1 cup', grams: 80, is_default: true, created_at: '' },
    ]

    expect(defaultFoodPortion(oats, portions)).toMatchObject({ label: '1 cup', grams: 80 })
    expect(defaultFoodPortion(food('banana'), portions)).toMatchObject({ label: '100 g', grams: 100 })
  })

  it('builds an edit payload without food identity fields', () => {
    const payload = buildSnapshotPreservingEdit({
      meal_type: 'lunch',
      name: ' Oats ',
      calories: 49.6,
      protein_g: 5,
      carbs_g: 5,
      fat_g: 1,
      fiber_g: 0.5,
      sugar_g: 0.5,
      sodium_mg: 10,
      notes: ' snapshot correction ',
    }, '2026-07-25T10:00:00Z')

    expect(payload).toMatchObject({
      name: 'Oats',
      calories: 50,
      notes: 'snapshot correction',
    })
    expect(payload).not.toHaveProperty('entry_kind')
    expect(payload).not.toHaveProperty('food_item_id')
    expect(payload).not.toHaveProperty('source_details')
  })

  it('copies the complete nutrient snapshot while changing date and meal', () => {
    const original = entry('entry', 'oats', '2026-07-20')
    const copy = copyEntrySnapshot(original, { entry_date: '2026-07-25', meal_type: 'snack' })

    expect(copy).toMatchObject({
      entry_kind: 'food',
      food_item_id: 'oats',
      source_details: original.source_details,
      calories: 50,
      entry_date: '2026-07-25',
      meal_type: 'snack',
    })
    expect(copy).not.toHaveProperty('id')
    expect(copy).not.toHaveProperty('created_at')
  })
})

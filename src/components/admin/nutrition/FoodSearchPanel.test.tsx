import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  FoodItemRow,
  FoodPortionRow,
  NutritionEntryRow,
} from '@/lib/supabase/database.types'
import { FoodSearchPanel } from './FoodSearchPanel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const oats: FoodItemRow = {
  id: 'oats',
  user_id: 'user',
  source: 'custom',
  external_id: null,
  barcode: null,
  name: 'Rolled oats',
  brand: 'LifeQuest',
  calories_per_100g: 380,
  protein_per_100g: 13,
  carbs_per_100g: 68,
  fat_per_100g: 7,
  fiber_per_100g: 10,
  sugar_per_100g: 1,
  sodium_mg_per_100g: 5,
  default_serving_grams: 50,
  default_serving_label: '50 g',
  source_updated_at: null,
  is_archived: false,
  created_at: '',
  updated_at: '',
}

const portion: FoodPortionRow = {
  id: 'cup',
  food_item_id: oats.id,
  label: '1 cup',
  grams: 80,
  is_default: true,
  created_at: '',
}

const historyEntry: NutritionEntryRow = {
  id: 'history',
  user_id: 'user',
  entry_date: '2026-07-24',
  meal_type: 'breakfast',
  name: oats.name,
  entry_kind: 'food',
  food_item_id: oats.id,
  serving_grams: 80,
  serving_count: 1,
  serving_label: '1 × cup',
  calories: 304,
  protein_g: 10.4,
  carbs_g: 54.4,
  fat_g: 5.6,
  fiber_g: 8,
  sugar_g: 0.8,
  sodium_mg: 4,
  source_id: null,
  source_details: {},
  notes: null,
  created_at: '2026-07-24T12:00:00Z',
  updated_at: '2026-07-24T12:00:00Z',
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof FoodSearchPanel>> = {}) {
  const props: React.ComponentProps<typeof FoodSearchPanel> = {
    foods: [oats],
    portions: [portion],
    historyEntries: [historyEntry],
    favoriteIds: new Set(),
    savedMeals: [],
    recipes: [],
    initialMealType: 'breakfast',
    onClose: vi.fn(),
    onLog: vi.fn().mockResolvedValue(undefined),
    onLogSavedMeal: vi.fn().mockResolvedValue(undefined),
    onLogRecipe: vi.fn().mockResolvedValue(undefined),
    onFavorite: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<FoodSearchPanel {...props} />)
  return props
}

describe('FoodSearchPanel', () => {
  it('uses the saved default portion for one-tap logging', async () => {
    const props = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(props.onLog).toHaveBeenCalledWith(oats, 80, 1, 'breakfast', '1 cup'))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('keeps local foods available when provider search fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Provider timeout')))
    renderPanel()

    fireEvent.change(screen.getByPlaceholderText('Search foods, brands, or barcode'), { target: { value: 'rolled' } })

    expect(screen.getByText('Rolled oats')).toBeDefined()
    expect(await screen.findByText(/provider timeout.*saved foods are still available/i)).toBeDefined()
    expect(screen.getByText('Rolled oats')).toBeDefined()
  })

  it('keeps manual search available when barcode input is invalid', () => {
    renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Look up barcode' }))

    expect(screen.getByRole('alert').textContent).toContain('valid 8–14 digit barcode')
    expect(screen.getByText('Rolled oats')).toBeDefined()
  })
})

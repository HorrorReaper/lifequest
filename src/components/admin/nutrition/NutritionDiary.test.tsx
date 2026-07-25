import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NutritionEntryRow, NutritionTargetRow } from '@/lib/supabase/database.types'
import { NutritionDiary } from './NutritionDiary'

afterEach(cleanup)

const target: NutritionTargetRow = {
  user_id: 'user',
  calories: 2_000,
  protein_g: 160,
  carbs_g: 220,
  fat_g: 65,
  fiber_g: 30,
  sodium_mg: 2_300,
  created_at: '',
  updated_at: '',
}

const breakfast: NutritionEntryRow = {
  id: 'entry',
  user_id: 'user',
  entry_date: '2026-07-25',
  meal_type: 'breakfast',
  name: 'Greek yogurt',
  entry_kind: 'food',
  food_item_id: 'food',
  serving_grams: 200,
  serving_count: 1,
  serving_label: '1 × cup',
  calories: 250,
  protein_g: 30,
  carbs_g: 20,
  fat_g: 5,
  fiber_g: 0,
  sugar_g: 10,
  sodium_mg: 80,
  source_id: null,
  source_details: {},
  notes: null,
  created_at: '',
  updated_at: '',
}

function renderDiary(overrides: Partial<React.ComponentProps<typeof NutritionDiary>> = {}) {
  const props: React.ComponentProps<typeof NutritionDiary> = {
    date: '2026-07-25',
    setDate: vi.fn(),
    entries: [breakfast],
    totals: { calories: 250, protein: 30, carbs: 20, fat: 5, fiber: 0, sugar: 10, sodium: 80 },
    targets: target,
    days: [],
    averageCalories: 250,
    averageProtein: 30,
    adherence: 100,
    working: false,
    onAddFood: vi.fn(),
    onQuick: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onEntryTools: vi.fn(),
    onMealTools: vi.fn(),
    ...overrides,
  }
  render(<NutritionDiary {...props} />)
  return props
}

describe('NutritionDiary', () => {
  it('renders the diary equation, macros, and all five fixed meal sections', () => {
    renderDiary()

    expect(screen.getByText('2000')).toBeDefined()
    expect(screen.getAllByText('250').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1750').length).toBeGreaterThan(0)
    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Other']) {
      expect(screen.getByText(meal)).toBeDefined()
    }
    expect(screen.getByText('Greek yogurt')).toBeDefined()
    expect(screen.getByText('30/160g')).toBeDefined()
  })

  it('routes add-food and date-navigation actions without timezone date parsing', () => {
    const onAddFood = vi.fn()
    const setDate = vi.fn()
    renderDiary({ onAddFood, setDate })

    fireEvent.click(screen.getAllByRole('button', { name: /add your first item/i })[0])
    expect(onAddFood).toHaveBeenCalledWith('lunch')

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(setDate).toHaveBeenCalledWith('2026-07-26')
  })
})

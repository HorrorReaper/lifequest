import { describe, expect, it } from 'vitest'
import { recipePerServing, scaleNutrients, sumNutrients } from './calculations'

const oats = {
  calories_per_100g: 380,
  protein_per_100g: 13,
  carbs_per_100g: 68,
  fat_per_100g: 7,
  fiber_per_100g: 10,
  sugar_per_100g: 1,
  sodium_mg_per_100g: 5,
}

describe('nutrition calculations', () => {
  it('scales a food by grams and serving count without rounding the snapshot', () => {
    expect(scaleNutrients(oats, 50, 2)).toEqual({
      calories: 380,
      protein: 13,
      carbs: 68,
      fat: 7,
      fiber: 10,
      sugar: 1,
      sodium: 5,
    })
  })

  it('prevents negative serving inputs from creating negative nutrients', () => {
    expect(scaleNutrients(oats, -100, 1).calories).toBe(0)
    expect(scaleNutrients(oats, 100, -1).protein).toBe(0)
  })

  it('calculates a recipe per serving', () => {
    const result = recipePerServing([
      { food: oats, grams: 100 },
      { food: { ...oats, calories_per_100g: 120, protein_per_100g: 20 }, grams: 100 },
    ], 2)
    expect(result.calories).toBe(250)
    expect(result.protein).toBe(16.5)
  })

  it('sums diary snapshots', () => {
    const one = scaleNutrients(oats, 50)
    expect(sumNutrients([one, one]).calories).toBe(380)
  })
})

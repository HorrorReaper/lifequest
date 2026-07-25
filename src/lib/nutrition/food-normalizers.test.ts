import { describe, expect, it } from 'vitest'
import { deduplicateFoods, normalizeOpenFoodFactsFood, normalizeUsdaFood } from './food-normalizers'

describe('food provider normalization', () => {
  it('normalizes USDA nutrients and portions', () => {
    const food = normalizeUsdaFood({
      fdcId: 123,
      description: 'Greek yogurt',
      brandOwner: 'Test Dairy',
      gtinUpc: '001234567890',
      foodNutrients: [
        { nutrientName: 'Energy', value: 95 },
        { nutrientName: 'Protein', value: 9.5 },
        { nutrientName: 'Carbohydrate, by difference', value: 4 },
        { nutrientName: 'Total lipid (fat)', value: 3 },
      ],
      foodPortions: [{ amount: 1, gramWeight: 170, measureUnit: { name: 'cup' } }],
    })
    expect(food).toMatchObject({
      source: 'usda',
      externalId: '123',
      caloriesPer100g: 95,
      proteinPer100g: 9.5,
      defaultServingGrams: 170,
    })
  })

  it('converts Open Food Facts sodium from grams to milligrams', () => {
    const food = normalizeOpenFoodFactsFood({
      code: '4000000000000',
      product_name: 'Protein bar',
      brands: 'LifeQuest',
      serving_quantity: 50,
      serving_size: '1 bar (50 g)',
      nutriments: {
        'energy-kcal_100g': 360,
        'proteins_100g': 30,
        'carbohydrates_100g': 40,
        'fat_100g': 10,
        'sodium_100g': 0.25,
      },
    })
    expect(food?.sodiumMgPer100g).toBe(250)
    expect(food?.defaultServingLabel).toBe('1 bar (50 g)')
  })

  it('deduplicates provider results by normalized barcode', () => {
    const food = normalizeOpenFoodFactsFood({ code: '00123', product_name: 'One', nutriments: {} })!
    expect(deduplicateFoods([food, { ...food, source: 'usda', externalId: '2', barcode: '123' }])).toHaveLength(1)
  })

  it('rejects incomplete provider records', () => {
    expect(normalizeUsdaFood({ fdcId: 1 })).toBeNull()
    expect(normalizeOpenFoodFactsFood({ code: '123' })).toBeNull()
  })
})

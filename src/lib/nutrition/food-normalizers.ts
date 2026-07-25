import type { NormalizedFood, NormalizedPortion } from './food-types'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {}
}

function number(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function nutrientValue(nutrients: unknown, names: string[]) {
  if (Array.isArray(nutrients)) {
    for (const item of nutrients) {
      const nutrient = record(item)
      const descriptor = record(nutrient.nutrient)
      const name = text(nutrient.nutrientName || descriptor.name).toLowerCase()
      if (names.some((candidate) => name === candidate || name.includes(candidate))) {
        return number(nutrient.value ?? nutrient.amount)
      }
    }
  }
  return 0
}

function uniquePortions(portions: NormalizedPortion[]) {
  const seen = new Set<string>()
  return portions.filter((portion) => {
    const key = `${portion.label.toLowerCase()}:${portion.grams}`
    if (!portion.label || portion.grams <= 0 || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeUsdaFood(input: unknown): NormalizedFood | null {
  const food = record(input)
  const externalId = String(food.fdcId ?? '')
  const name = text(food.description)
  if (!externalId || !name) return null
  const nutrients = food.foodNutrients
  const portions = Array.isArray(food.foodPortions)
    ? food.foodPortions.map((value) => {
      const portion = record(value)
      const measure = record(portion.measureUnit)
      return {
        label: [portion.amount, measure.name || portion.modifier].filter(Boolean).join(' ') || 'Serving',
        grams: number(portion.gramWeight),
      }
    })
    : []
  const servingSize = number(food.servingSize)
  const servingUnit = text(food.servingSizeUnit)
  if (servingSize && servingUnit.toLowerCase() === 'g') portions.unshift({ label: `${servingSize} g`, grams: servingSize })
  const cleanedPortions = uniquePortions(portions)
  const defaultPortion = cleanedPortions[0] ?? { label: '100 g', grams: 100 }
  return {
    source: 'usda',
    externalId,
    barcode: text(food.gtinUpc) || null,
    name,
    brand: text(food.brandOwner || food.brandName) || null,
    caloriesPer100g: nutrientValue(nutrients, ['energy', 'energy (atwater general factors)']),
    proteinPer100g: nutrientValue(nutrients, ['protein']),
    carbsPer100g: nutrientValue(nutrients, ['carbohydrate, by difference', 'carbohydrate']),
    fatPer100g: nutrientValue(nutrients, ['total lipid (fat)', 'total fat']),
    fiberPer100g: nutrientValue(nutrients, ['fiber, total dietary', 'fiber']),
    sugarPer100g: nutrientValue(nutrients, ['sugars, total including nlea', 'total sugars']),
    sodiumMgPer100g: nutrientValue(nutrients, ['sodium, na', 'sodium']),
    defaultServingGrams: defaultPortion.grams,
    defaultServingLabel: defaultPortion.label,
    portions: cleanedPortions,
    attribution: 'USDA FoodData Central',
  }
}

export function normalizeOpenFoodFactsFood(input: unknown): NormalizedFood | null {
  const food = record(input)
  const externalId = text(food.code || food._id)
  const name = text(food.product_name || food.product_name_en)
  if (!externalId || !name) return null
  const nutrients = record(food.nutriments)
  const servingGrams = number(food.serving_quantity)
  const servingLabel = text(food.serving_size)
  const portions = uniquePortions(servingGrams ? [{ label: servingLabel || `${servingGrams} g`, grams: servingGrams }] : [])
  const defaultPortion = portions[0] ?? { label: '100 g', grams: 100 }
  const sodiumG = number(nutrients['sodium_100g'])
  return {
    source: 'open_food_facts',
    externalId,
    barcode: externalId,
    name,
    brand: text(food.brands) || null,
    caloriesPer100g: number(nutrients['energy-kcal_100g']) || number(nutrients['energy_100g']) / 4.184,
    proteinPer100g: number(nutrients['proteins_100g']),
    carbsPer100g: number(nutrients['carbohydrates_100g']),
    fatPer100g: number(nutrients['fat_100g']),
    fiberPer100g: number(nutrients['fiber_100g']),
    sugarPer100g: number(nutrients['sugars_100g']),
    sodiumMgPer100g: sodiumG * 1000,
    defaultServingGrams: defaultPortion.grams,
    defaultServingLabel: defaultPortion.label,
    portions,
    attribution: 'Open Food Facts contributors · ODbL',
  }
}

export function deduplicateFoods(foods: NormalizedFood[]) {
  const seen = new Set<string>()
  return foods.filter((food) => {
    const key = food.barcode
      ? `barcode:${food.barcode.replace(/^0+/, '')}`
      : `name:${food.brand?.toLowerCase() ?? ''}:${food.name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

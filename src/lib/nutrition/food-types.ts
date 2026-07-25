export type FoodSource = 'usda' | 'open_food_facts'

export type NormalizedPortion = {
  label: string
  grams: number
}

export type NormalizedFood = {
  source: FoodSource
  externalId: string
  barcode: string | null
  name: string
  brand: string | null
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
  sugarPer100g: number
  sodiumMgPer100g: number
  defaultServingGrams: number
  defaultServingLabel: string
  portions: NormalizedPortion[]
  attribution: string
}

export type ProviderStatus = {
  usda: 'ok' | 'disabled' | 'unavailable'
  openFoodFacts: 'ok' | 'unavailable'
}

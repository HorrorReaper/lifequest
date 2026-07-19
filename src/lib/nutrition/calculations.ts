export type NutrientValues = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
}

export type Per100gFood = {
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
  sugar_per_100g: number
  sodium_mg_per_100g: number
}

export function scaleNutrients(food: Per100gFood, servingGrams: number, servingCount = 1): NutrientValues {
  const ratio = Math.max(0, servingGrams) * Math.max(0, servingCount) / 100
  return {
    calories: Number(food.calories_per_100g) * ratio,
    protein: Number(food.protein_per_100g) * ratio,
    carbs: Number(food.carbs_per_100g) * ratio,
    fat: Number(food.fat_per_100g) * ratio,
    fiber: Number(food.fiber_per_100g) * ratio,
    sugar: Number(food.sugar_per_100g) * ratio,
    sodium: Number(food.sodium_mg_per_100g) * ratio,
  }
}

export function sumNutrients(values: NutrientValues[]): NutrientValues {
  return values.reduce((total, value) => ({
    calories: total.calories + value.calories,
    protein: total.protein + value.protein,
    carbs: total.carbs + value.carbs,
    fat: total.fat + value.fat,
    fiber: total.fiber + value.fiber,
    sugar: total.sugar + value.sugar,
    sodium: total.sodium + value.sodium,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 })
}

export function recipePerServing(ingredients: Array<{ food: Per100gFood; grams: number }>, servings: number) {
  const total = sumNutrients(ingredients.map((ingredient) => scaleNutrients(ingredient.food, ingredient.grams)))
  const divisor = Math.max(0.01, servings)
  return Object.fromEntries(Object.entries(total).map(([key, value]) => [key, value / divisor])) as unknown as NutrientValues
}

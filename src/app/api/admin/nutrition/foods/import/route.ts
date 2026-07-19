import { authenticatedFoodApi } from '@/lib/nutrition/admin-food-api'
import { fetchExternalFood } from '@/lib/nutrition/food-providers'
import type { FoodSource } from '@/lib/nutrition/food-types'

export async function POST(request: Request) {
  const auth = await authenticatedFoodApi()
  if (auth.response) return auth.response
  const body = await request.json().catch(() => null) as { source?: FoodSource; externalId?: string } | null
  if (!body?.externalId || !['usda', 'open_food_facts'].includes(body.source ?? '')) {
    return Response.json({ error: 'Invalid food import request.' }, { status: 400 })
  }
  try {
    const normalized = await fetchExternalFood(body.source!, body.externalId)
    if (!normalized) return Response.json({ error: 'Food data is incomplete.' }, { status: 422 })
    const payload = {
      user_id: auth.user.id,
      source: normalized.source,
      external_id: normalized.externalId,
      barcode: normalized.barcode,
      name: normalized.name,
      brand: normalized.brand,
      calories_per_100g: normalized.caloriesPer100g,
      protein_per_100g: normalized.proteinPer100g,
      carbs_per_100g: normalized.carbsPer100g,
      fat_per_100g: normalized.fatPer100g,
      fiber_per_100g: normalized.fiberPer100g,
      sugar_per_100g: normalized.sugarPer100g,
      sodium_mg_per_100g: normalized.sodiumMgPer100g,
      default_serving_grams: normalized.defaultServingGrams,
      default_serving_label: normalized.defaultServingLabel,
      source_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data: food, error } = await auth.supabase.from('food_items').upsert(payload, { onConflict: 'user_id,source,external_id' }).select('*').single()
    if (error) throw error
    await auth.supabase.from('food_portions').delete().eq('food_item_id', food.id)
    if (normalized.portions.length) {
      const { error: portionError } = await auth.supabase.from('food_portions').insert(normalized.portions.map((portion, index) => ({ food_item_id: food.id, label: portion.label, grams: portion.grams, is_default: index === 0 })))
      if (portionError) throw portionError
    }
    return Response.json({ food, attribution: normalized.attribution }, { status: 201 })
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : 'Food could not be imported.' }, { status: 502 })
  }
}

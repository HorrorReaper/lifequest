import { authenticatedFoodApi } from '@/lib/nutrition/admin-food-api'
import { searchExternalFoods } from '@/lib/nutrition/food-providers'

export async function GET(request: Request) {
  const auth = await authenticatedFoodApi()
  if (auth.response) return auth.response
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2 || query.length > 120) {
    return Response.json({ error: 'Search must contain between 2 and 120 characters.' }, { status: 400 })
  }
  const result = await searchExternalFoods(query)
  return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
}

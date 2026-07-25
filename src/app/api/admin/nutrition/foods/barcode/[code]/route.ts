import { authenticatedFoodApi } from '@/lib/nutrition/admin-food-api'
import { lookupExternalBarcode } from '@/lib/nutrition/food-providers'

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await authenticatedFoodApi()
  if (auth.response) return auth.response
  const { code } = await context.params
  if (!/^[0-9]{8,14}$/.test(code)) return Response.json({ error: 'Invalid barcode.' }, { status: 400 })
  try {
    const food = await lookupExternalBarcode(code)
    return food
      ? Response.json({ food }, { headers: { 'Cache-Control': 'private, no-store' } })
      : Response.json({ error: 'Barcode not found.' }, { status: 404 })
  } catch {
    return Response.json({ error: 'Barcode providers are currently unavailable.' }, { status: 503 })
  }
}

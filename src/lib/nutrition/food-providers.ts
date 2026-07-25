import 'server-only'

import { deduplicateFoods, normalizeOpenFoodFactsFood, normalizeUsdaFood } from './food-normalizers'
import type { NormalizedFood, ProviderStatus } from './food-types'

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'
const OFF_BASE = 'https://world.openfoodfacts.org'
const TIMEOUT_MS = 7000

function externalFetch(url: string, headers?: HeadersInit) {
  return fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
}

function offHeaders() {
  return { 'User-Agent': process.env.OPEN_FOOD_FACTS_USER_AGENT || 'LifeQuest/0.1 (admin food diary)' }
}

export async function searchExternalFoods(query: string) {
  const status: ProviderStatus = {
    usda: process.env.USDA_FDC_API_KEY ? 'ok' : 'disabled',
    openFoodFacts: 'ok',
  }
  const usdaPromise = process.env.USDA_FDC_API_KEY
    ? externalFetch(`${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=15&api_key=${encodeURIComponent(process.env.USDA_FDC_API_KEY)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`USDA ${response.status}`)
        const payload = await response.json() as { foods?: unknown[] }
        return (payload.foods ?? []).map(normalizeUsdaFood).filter((food): food is NormalizedFood => Boolean(food))
      })
    : Promise.resolve([] as NormalizedFood[])
  const offPromise = externalFetch(`${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity`, offHeaders())
    .then(async (response) => {
      if (!response.ok) throw new Error(`Open Food Facts ${response.status}`)
      const payload = await response.json() as { products?: unknown[] }
      return (payload.products ?? []).map(normalizeOpenFoodFactsFood).filter((food): food is NormalizedFood => Boolean(food))
    })

  const [usdaResult, offResult] = await Promise.allSettled([usdaPromise, offPromise])
  if (usdaResult.status === 'rejected') status.usda = 'unavailable'
  if (offResult.status === 'rejected') status.openFoodFacts = 'unavailable'
  const foods = deduplicateFoods([
    ...(usdaResult.status === 'fulfilled' ? usdaResult.value : []),
    ...(offResult.status === 'fulfilled' ? offResult.value : []),
  ])
  return { foods, providers: status }
}

export async function lookupExternalBarcode(barcode: string) {
  const response = await externalFetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity`, offHeaders())
  if (response.ok) {
    const payload = await response.json() as { product?: unknown }
    const food = normalizeOpenFoodFactsFood(payload.product)
    if (food) return food
  }
  if (!process.env.USDA_FDC_API_KEY) return null
  const usda = await externalFetch(`${USDA_BASE}/foods/search?query=${encodeURIComponent(barcode)}&pageSize=5&api_key=${encodeURIComponent(process.env.USDA_FDC_API_KEY)}`)
  if (!usda.ok) return null
  const payload = await usda.json() as { foods?: unknown[] }
  return (payload.foods ?? []).map(normalizeUsdaFood).find((food) => food?.barcode?.replace(/^0+/, '') === barcode.replace(/^0+/, '')) ?? null
}

export async function fetchExternalFood(source: NormalizedFood['source'], externalId: string) {
  if (source === 'usda') {
    if (!process.env.USDA_FDC_API_KEY) throw new Error('USDA search is not configured.')
    const response = await externalFetch(`${USDA_BASE}/food/${encodeURIComponent(externalId)}?api_key=${encodeURIComponent(process.env.USDA_FDC_API_KEY)}`)
    if (!response.ok) throw new Error(`USDA returned ${response.status}.`)
    return normalizeUsdaFood(await response.json())
  }
  const response = await externalFetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(externalId)}.json?fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity`, offHeaders())
  if (!response.ok) throw new Error(`Open Food Facts returned ${response.status}.`)
  const payload = await response.json() as { product?: unknown }
  return normalizeOpenFoodFactsFood(payload.product)
}

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authenticatedFoodApi, searchExternalFoods } = vi.hoisted(() => ({
  authenticatedFoodApi: vi.fn(),
  searchExternalFoods: vi.fn(),
}))

vi.mock('@/lib/nutrition/admin-food-api', () => ({ authenticatedFoodApi }))
vi.mock('@/lib/nutrition/food-providers', () => ({ searchExternalFoods }))

import { GET } from './route'

describe('food search route', () => {
  beforeEach(() => {
    authenticatedFoodApi.mockResolvedValue({ user: { id: 'admin' }, supabase: {} })
    searchExternalFoods.mockResolvedValue({ foods: [], providers: { usda: 'ok', openFoodFacts: 'ok' } })
  })

  it('passes through authentication failures', async () => {
    authenticatedFoodApi.mockResolvedValue({ response: Response.json({ error: 'Authentication required.' }, { status: 401 }) })
    const response = await GET(new Request('http://localhost/api/admin/nutrition/foods/search?q=oats'))
    expect(response.status).toBe(401)
  })

  it('validates short queries before calling providers', async () => {
    const response = await GET(new Request('http://localhost/api/admin/nutrition/foods/search?q=a'))
    expect(response.status).toBe(400)
    expect(searchExternalFoods).not.toHaveBeenCalled()
  })

  it('returns normalized provider results without caching', async () => {
    searchExternalFoods.mockResolvedValue({ foods: [{ name: 'Oats' }], providers: { usda: 'ok', openFoodFacts: 'unavailable' } })
    const response = await GET(new Request('http://localhost/api/admin/nutrition/foods/search?q=oats'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toMatchObject({ foods: [{ name: 'Oats' }] })
  })
})

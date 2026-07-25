import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260719074413_workout_nutrition_daily_drivers.sql'), 'utf8')

describe('tracker migration security contract', () => {
  it('ships a substantial owned exercise catalog', () => {
    const seedBlock = migration.match(/with exercise_seed[\s\S]+?from exercise_seed seed/)?.[0] ?? ''
    expect(seedBlock.match(/^\s+\('/gm)?.length).toBeGreaterThanOrEqual(150)
  })

  it('enables RLS on every newly exposed table', () => {
    const tables = [
      'workout_preferences',
      'exercise_preferences',
      'workout_template_sets',
      'food_items',
      'food_portions',
      'food_favorites',
      'saved_meals',
      'saved_meal_items',
      'recipes',
      'recipe_ingredients',
    ]
    for (const table of tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`)
      expect(migration).toContain(`grant select, insert, update, delete on public.${table} to authenticated;`)
    }
  })

  it('uses trusted app metadata and optimized auth calls in policies', () => {
    expect(migration).not.toContain('user_metadata')
    expect(migration).toContain("(select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'")
    expect(migration).toContain('(select auth.uid())')
  })

  it('keeps tracker functions invoker-secured with fixed search paths and explicit grants', () => {
    const functions = ['start_workout', 'finish_workout', 'clone_workout_template', 'save_workout_template', 'log_saved_meal', 'log_recipe']
    expect(migration.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(functions.length)
    expect(migration.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(functions.length)
    for (const name of functions) {
      expect(migration).toContain(`revoke all on function public.${name}`)
      expect(migration).toContain(`grant execute on function public.${name}`)
    }
  })
})

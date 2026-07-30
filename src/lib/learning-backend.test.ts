import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const backendMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260726180730_interactive_learning_paths_backend.sql'),
  'utf8'
)
const advisorMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260726182058_learning_paths_covering_indexes.sql'),
  'utf8'
)

describe('interactive learning backend contract', () => {
  const tables = [
    'learning_paths',
    'learning_path_versions',
    'learning_units',
    'learning_lessons',
    'learning_exercises',
    'learning_enrollments',
    'learning_lesson_progress',
    'learning_attempts',
    'learning_exercise_responses',
  ]

  it('enables RLS and uses explicit Data API grants', () => {
    for (const table of tables) {
      expect(backendMigration).toContain(`alter table public.${table} enable row level security;`)
      expect(backendMigration).toContain(`revoke all on table public.${table} from anon, authenticated;`)
    }
  })

  it('keeps answer keys behind the authenticated RPC boundary', () => {
    expect(backendMigration).toContain('p_include_answers')
    expect(backendMigration).toContain("v_exercise.answer_key ->> 'correctIndex'")
    expect(backendMigration).toContain("p_response -> 'items' = v_exercise.answer_key -> 'items'")
    expect(backendMigration).toContain(
      'revoke all on function public.learning_build_catalog(uuid, boolean, boolean) from public, anon, authenticated;'
    )
  })

  it('requires trusted app metadata for every admin operation', () => {
    expect(backendMigration).not.toContain('user_metadata')
    expect(
      backendMigration.match(/auth\.jwt\(\) -> 'app_metadata' ->> 'role'/g)?.length
    ).toBeGreaterThanOrEqual(3)
    for (const functionName of [
      'admin_get_learning_catalog',
      'admin_save_learning_catalog',
      'admin_publish_learning_catalog',
    ]) {
      expect(backendMigration).toContain(`grant execute on function public.${functionName}`)
    }
  })

  it('makes completion and rewards idempotent', () => {
    expect(backendMigration).toContain('learning_attempts_one_active_per_user_lesson')
    expect(backendMigration).toContain("and status <> 'completed'")
    expect(backendMigration).toContain('pg_advisory_xact_lock')
    expect(backendMigration).toContain("'learning_path_lesson'")
  })

  it('seeds the complete authored catalog and adds advisor indexes', () => {
    expect(backendMigration).toContain('$learning_catalog$')
    expect(backendMigration).toContain('"id":"social-skills"')
    expect(backendMigration).toContain('"id":"entrepreneurship"')
    expect(backendMigration).toContain('"id":"fitness"')
    expect(advisorMigration.match(/^create index learning_/gm)?.length).toBe(10)
    expect(advisorMigration.match(/^create policy "Learning/gm)?.length).toBe(5)
  })
})

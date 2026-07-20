import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260720160333_create_knowledge_projects.sql'),
  'utf8'
)

describe('knowledge and project migration contract', () => {
  const tables = [
    'knowledge_folders',
    'knowledge_notes',
    'projects',
    'project_milestones',
    'knowledge_note_links',
    'knowledge_note_versions',
    'knowledge_note_templates',
    'knowledge_note_projects',
    'knowledge_note_tasks',
  ]

  it('enables RLS and explicit Data API grants for every new table', () => {
    for (const table of tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`)
      expect(migration).toContain(`grant select, insert, update, delete on public.${table} to authenticated;`)
    }
  })

  it('uses trusted app metadata, owned records, and optimized auth calls', () => {
    expect(migration).not.toContain('user_metadata')
    expect(migration).toContain("auth.jwt() -> 'app_metadata' ->> 'role'")
    expect(migration).toContain('(select auth.uid()) = user_id')
    expect(migration).not.toContain('service_role')
  })

  it('uses invoker-secured atomic functions with explicit grants', () => {
    for (const name of ['save_knowledge_note', 'create_project_with_home_note']) {
      expect(migration).toContain(`function public.${name}`)
      expect(migration).toContain(`revoke all on function public.${name}`)
      expect(migration).toContain(`grant execute on function public.${name}`)
    }
    expect(migration.match(/security invoker/g)?.length).toBeGreaterThanOrEqual(3)
    expect(migration.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the journal task contract compatible', () => {
    expect(migration).toContain("case when is_completed then 'done' else 'todo' end")
    expect(migration).toContain('tasks_sync_project_status')
    expect(migration).toContain("new.status := case")
  })

  it('migrates legacy admin notes without deleting the source', () => {
    expect(migration).toContain('from public.admin_notes legacy')
    expect(migration).toContain("'migrated_from', 'admin_notes'")
    expect(migration).not.toMatch(/drop table\s+public\.admin_notes/i)
  })

  it('indexes search, ownership joins, and project task queries', () => {
    expect(migration).toContain('knowledge_notes_search_idx')
    expect(migration).toContain('using gin (search_vector)')
    expect(migration).toContain('tasks_project_status_idx')
    expect(migration).toContain('knowledge_note_links_target_idx')
  })
})

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateBuilder } from '@/components/template-builder/template-builder'
import type { BuilderField } from '@/components/template-builder/sortable-field-item'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, back: vi.fn() }),
}))

/**
 * A Supabase stand-in that records which table/operation pairs were reached,
 * in order. The bug these tests cover is one of ordering, so the order of
 * `calls` is the thing under test, not just the fact that a call happened.
 */
const db = vi.hoisted(() => {
  const calls: string[] = []
  const results: Record<string, unknown> = {}
  return { calls, results }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from(table: string) {
      let key = ''
      const builder: Record<string, unknown> = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') {
              const result = db.results[key] ?? { data: null, error: null }
              return (resolve: (value: unknown) => void) => resolve(result)
            }
            return () => {
              if (!key) {
                key = `${table}.${String(prop)}`
                db.calls.push(key)
              }
              return builder
            }
          },
        }
      )
      return builder
    },
  }),
}))

function field(overrides: Partial<BuilderField> = {}): BuilderField {
  return {
    id: 'f1',
    field_type: 'text',
    label: 'What went well?',
    description: null,
    placeholder: null,
    is_required: false,
    sort_order: 0,
    config: {},
    xp_rules: [],
    ...overrides,
  }
}

function renderEditor() {
  return render(
    <TemplateBuilder
      templateId="template-1"
      initialName="Evening Review"
      initialFields={[field()]}
    />
  )
}

afterEach(cleanup)

beforeEach(() => {
  db.calls.length = 0
  for (const key of Object.keys(db.results)) delete db.results[key]
  db.results['template_fields.select'] = { data: [{ id: 'existing-field' }], error: null }
  db.results['template_fields.delete'] = { data: null, error: null }
  db.results['template_fields.insert'] = { data: null, error: null }
  db.results['journal_templates.update'] = { data: null, error: null }
  push.mockReset()
})

describe('TemplateBuilder, saving an existing template', () => {
  it('writes nothing at all when responses already reference the fields', async () => {
    db.results['journal_responses.select'] = { count: 3, error: null }
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(screen.getByText(/existing responses/i)).toBeTruthy())

    // The refusal has to come before anything is written, or the name and
    // icon end up changed while the fields the user asked about stay put.
    expect(db.calls).not.toContain('journal_templates.update')
    expect(db.calls).not.toContain('template_fields.delete')
    expect(push).not.toHaveBeenCalled()
  })

  it('checks for responses before touching the template', async () => {
    db.results['journal_responses.select'] = { count: 0, error: null }
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/journal/templates'))

    expect(db.calls.indexOf('journal_responses.select')).toBeLessThan(
      db.calls.indexOf('journal_templates.update')
    )
  })

  it('saves the template once nothing references its fields', async () => {
    db.results['journal_responses.select'] = { count: 0, error: null }
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/journal/templates'))

    expect(db.calls).toContain('journal_templates.update')
    expect(db.calls).toContain('template_fields.delete')
    expect(db.calls).toContain('template_fields.insert')
  })

  it('keeps quiet in the console while saving', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    db.results['journal_responses.select'] = { count: 0, error: null }
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(push).toHaveBeenCalled())

    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})

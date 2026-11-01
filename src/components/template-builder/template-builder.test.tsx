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
  // Every chained call with its arguments, e.g. `metrics.update` -> [{ ... }].
  const args: { call: string; args: unknown[] }[] = []
  return { calls, results, args }
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
            return (...args: unknown[]) => {
              if (!key) {
                key = `${table}.${String(prop)}`
                db.calls.push(key)
              }
              db.args.push({ call: `${table}.${String(prop)}`, args })
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

function updatesOf(table: string) {
  return db.args.filter((entry) => entry.call === `${table}.update`).map((entry) => entry.args[0])
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
  db.args.length = 0
  for (const key of Object.keys(db.results)) delete db.results[key]
  db.results['template_fields.select'] = {
    data: [{ id: 'existing-field', label: 'What went well?' }],
    error: null,
  }
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

describe('TemplateBuilder, metric links', () => {
  function weightFieldEditor() {
    return render(
      <TemplateBuilder
        templateId="template-1"
        initialName="Evening Review"
        initialFields={[field({ id: 'old-weight', label: 'Weight', field_type: 'number' })]}
      />
    )
  }

  beforeEach(() => {
    db.results['journal_responses.select'] = { count: 0, error: null }
    db.results['template_fields.select'] = {
      data: [{ id: 'old-weight', label: 'Weight' }],
      error: null,
    }
    db.results['template_fields.insert'] = {
      data: [{ id: 'new-weight', label: 'Weight' }],
      error: null,
    }
    db.results['metrics.select'] = {
      data: [
        { id: 'm-1', name: 'Weight', template_id: 'template-1', source_field_id: 'old-weight' },
      ],
      error: null,
    }
    db.results['metrics.update'] = { data: null, error: null }
  })

  it('lists the metrics the template also asks for', async () => {
    db.results['metrics.select'] = {
      data: [
        { id: 'm-1', name: 'Weight', template_id: 'template-1', source_field_id: null },
        { id: 'm-2', name: 'Sleep', template_id: 'template-1', source_field_id: null },
      ],
      error: null,
    }
    renderEditor()

    expect(await screen.findByText('Also asks for: Weight, Sleep')).toBeTruthy()
  })

  it('shows no "Also asks for" line without linked metrics', async () => {
    db.results['metrics.select'] = { data: [], error: null }
    renderEditor()

    await waitFor(() => expect(db.calls).toContain('metrics.select'))
    expect(screen.queryByText(/Also asks for/)).toBeNull()
  })

  it('points the metric at the re-inserted field with the same label', async () => {
    weightFieldEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/journal/templates'))

    expect(updatesOf('metrics')).toEqual([
      expect.objectContaining({ source_field_id: 'new-weight' }),
    ])
    // The metric is read before the old field is deleted, while its
    // source_field_id still names that field.
    expect(db.calls.lastIndexOf('metrics.select')).toBeLessThan(
      db.calls.indexOf('template_fields.delete')
    )
    expect(db.calls.indexOf('template_fields.insert')).toBeLessThan(
      db.calls.lastIndexOf('metrics.update')
    )
  })

  it('leaves the link empty when its field is gone from the template', async () => {
    db.results['template_fields.insert'] = {
      data: [{ id: 'new-notes', label: 'Notes' }],
      error: null,
    }
    weightFieldEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/journal/templates'))

    expect(updatesOf('metrics')).toEqual([expect.objectContaining({ source_field_id: null })])
  })

  it('says the template was saved when a link could not be restored', async () => {
    db.results['metrics.update'] = { data: null, error: { message: 'boom' } }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    weightFieldEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/template was saved, but/i)).toBeTruthy()
    expect(screen.getByText(/Weight/, { selector: 'p.text-destructive' })).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('does not touch metrics when none feeds from a field', async () => {
    db.results['metrics.select'] = { data: [], error: null }
    weightFieldEditor()

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/journal/templates'))

    expect(db.calls).not.toContain('metrics.update')
  })
})

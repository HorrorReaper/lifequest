import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FieldConfigEditor } from '@/components/template-builder/field-config-editor'
import type { BuilderField } from '@/components/template-builder/sortable-field-item'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

function numberField(overrides: Partial<BuilderField> = {}): BuilderField {
  return {
    id: 'field-1',
    field_type: 'number',
    label: 'Weight',
    description: null,
    placeholder: null,
    is_required: false,
    sort_order: 0,
    config: {},
    xp_rules: [],
    ...overrides,
  }
}

function renderEditor(feedsMetricByFieldId: Record<string, string>) {
  return render(
    <FieldConfigEditor
      field={numberField()}
      open
      onClose={vi.fn()}
      onSave={vi.fn()}
      feedsMetricByFieldId={feedsMetricByFieldId}
    />
  )
}

afterEach(cleanup)

describe('FieldConfigEditor, metric link', () => {
  it('no longer offers to track a number field as a metric', () => {
    renderEditor({})

    expect(screen.queryByText(/Track as metric/i)).toBeNull()
    expect(screen.queryByText(/Unit \(optional\)/i)).toBeNull()
  })

  it('names the metric a field feeds', () => {
    renderEditor({ 'field-1': 'Weight' })

    expect(screen.getByText('Feeds metric: Weight')).toBeTruthy()
    expect(screen.getByText('Renaming this field unlinks it from the metric.')).toBeTruthy()
  })

  it('says nothing about metrics for a field that feeds none', () => {
    renderEditor({ 'other-field': 'Sleep' })

    expect(screen.queryByText(/Feeds metric/)).toBeNull()
    expect(screen.queryByText(/Renaming this field/)).toBeNull()
  })
})

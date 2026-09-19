import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TemplatePreview } from '@/components/template-builder/template-preview'
import type { BuilderField } from '@/components/template-builder/sortable-field-item'
import type { FieldType } from '@/lib/types'

function field(overrides: Partial<BuilderField> = {}): BuilderField {
  return {
    id: 'field-1',
    field_type: 'text' as FieldType,
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

afterEach(cleanup)

describe('TemplatePreview', () => {
  it('shows the template the way the entry page will', () => {
    render(
      <TemplatePreview icon="🌅" name="Morning Review" description="Start the day" fields={[field()]} />
    )

    expect(screen.getByText('Morning Review')).toBeTruthy()
    expect(screen.getByText('Start the day')).toBeTruthy()
    expect(screen.getByText('🌅')).toBeTruthy()
    expect(screen.getByText('What went well?')).toBeTruthy()
  })

  it('names an unlabelled field after its type, never the raw enum', () => {
    render(
      <TemplatePreview
        icon="📓"
        name="Draft"
        description=""
        fields={[field({ label: '', field_type: 'textarea' as FieldType })]}
      />
    )

    expect(screen.getByText('Long Text')).toBeTruthy()
    expect(screen.queryByText('textarea')).toBeNull()
  })

  it('falls back to a placeholder name while the template is unnamed', () => {
    render(<TemplatePreview icon="📓" name="" description="" fields={[field()]} />)

    expect(screen.getByText(/untitled template/i)).toBeTruthy()
  })

  it('explains itself while there is nothing to show yet', () => {
    render(<TemplatePreview icon="📓" name="Draft" description="" fields={[]} />)

    expect(screen.getByText(/add a field/i)).toBeTruthy()
  })

  it('keeps every field in the order they were added', () => {
    render(
      <TemplatePreview
        icon="📓"
        name="Draft"
        description=""
        fields={[
          field({ id: 'a', label: 'First' }),
          field({ id: 'b', label: 'Second' }),
          field({ id: 'c', label: 'Third' }),
        ]}
      />
    )

    const labels = screen
      .getAllByText(/First|Second|Third/)
      .map((node) => node.textContent)

    expect(labels).toEqual(['First', 'Second', 'Third'])
  })
})

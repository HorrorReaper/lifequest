import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TemplatePicker } from '@/components/journal/template-picker'
import type { JournalTemplate } from '@/lib/types'

function template(overrides: Partial<JournalTemplate> = {}): JournalTemplate {
  return {
    id: 'template-1',
    user_id: null,
    name: 'Morning Review',
    description: 'Set the tone for the day.',
    entry_type: 'morning',
    icon: '🌅',
    is_default: true,
    is_system: true,
    xp_reward: 25,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

afterEach(cleanup)

describe('TemplatePicker', () => {
  it('offers a way out of the preset templates into a new one', () => {
    render(
      <TemplatePicker
        templates={[template(), template({ id: 'template-2', name: 'Evening Review' })]}
      />
    )

    const create = screen.getByRole('link', { name: /or create a new template/i })
    expect(create.getAttribute('href')).toBe('/journal/templates/new')
  })

  it('puts the create link last, after every template', () => {
    render(
      <TemplatePicker
        templates={[template(), template({ id: 'template-2', name: 'Evening Review' })]}
      />
    )

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(hrefs).toEqual([
      '/journal/new/template-1',
      '/journal/new/template-2',
      '/journal/templates/new',
    ])
  })

  it('does not dead-end when there are no templates yet', () => {
    render(<TemplatePicker templates={[]} />)

    // The empty state has always told people to create a template; before this
    // it gave them nothing to click.
    const create = screen.getByRole('link', { name: /create a template/i })
    expect(create.getAttribute('href')).toBe('/journal/templates/new')
  })
})

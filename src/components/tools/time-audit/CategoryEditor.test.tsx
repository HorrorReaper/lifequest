import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CategoryEditor } from './CategoryEditor'
import type { TimeAuditCategory } from './time-audit'

afterEach(cleanup)

const categories: TimeAuditCategory[] = [
  { id: 'deep-work', label: 'Deep work', color: 'emerald', value: 'worth_it' },
  { id: 'scrolling', label: 'Scrolling', color: 'rose', value: 'wasted' },
]

function setup(overrides: Partial<React.ComponentProps<typeof CategoryEditor>> = {}) {
  const props = {
    categories,
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  }
  render(<CategoryEditor {...props} />)
  return props
}

describe('CategoryEditor', () => {
  it('lists the categories currently in use', () => {
    setup()
    expect(screen.getByDisplayValue('Deep work')).toBeTruthy()
    expect(screen.getByDisplayValue('Scrolling')).toBeTruthy()
  })

  it('adds a category from the label typed in', () => {
    const { onAdd } = setup()
    fireEvent.change(screen.getByLabelText('New category'), { target: { value: 'Reading' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onAdd).toHaveBeenCalledWith('Reading', expect.any(String), expect.any(String))
  })

  it('refuses to add a category with no name', () => {
    const { onAdd } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('clears the field after adding, so the next one starts empty', () => {
    setup()
    const field = screen.getByLabelText('New category') as HTMLInputElement
    fireEvent.change(field, { target: { value: 'Reading' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(field.value).toBe('')
  })

  it('renames a category without changing its identity', () => {
    // The summary merges days by id, so a rename must travel as a label
    // patch rather than as a remove plus an add.
    const { onUpdate } = setup()
    fireEvent.change(screen.getByDisplayValue('Scrolling'), { target: { value: 'Doomscrolling' } })
    expect(onUpdate).toHaveBeenCalledWith('scrolling', { label: 'Doomscrolling' })
  })

  it('retags what a category is worth', () => {
    const { onUpdate } = setup()
    fireEvent.change(screen.getByLabelText(/value of deep work/i), { target: { value: 'wasted' } })
    expect(onUpdate).toHaveBeenCalledWith('deep-work', { value: 'wasted' })
  })

  it('removes a category', () => {
    const { onRemove } = setup()
    fireEvent.click(screen.getByRole('button', { name: /remove scrolling/i }))
    expect(onRemove).toHaveBeenCalledWith('scrolling')
  })
})

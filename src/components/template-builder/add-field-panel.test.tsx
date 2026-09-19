import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddFieldPanel } from '@/components/template-builder/add-field-panel'
import { FIELD_REGISTRY } from '@/lib/field-registry'

afterEach(cleanup)

describe('AddFieldPanel', () => {
  it('offers every field type as a real button, so the palette is keyboard reachable', () => {
    render(<AddFieldPanel onAdd={vi.fn()} />)

    const offered = FIELD_REGISTRY.filter((definition) => definition.type !== 'learning')

    for (const definition of offered) {
      const tile = screen.getByRole('button', { name: new RegExp(definition.label, 'i') })
      expect(tile.tagName).toBe('BUTTON')
    }
  })

  it('says what each field does instead of leaving the name to speak for itself', () => {
    render(<AddFieldPanel onAdd={vi.fn()} />)

    // The registry has carried a description for every type all along.
    const slider = FIELD_REGISTRY.find((definition) => definition.type === 'slider')!
    expect(screen.getByText(slider.description)).toBeTruthy()
  })

  it('sorts the palette into groups rather than one undifferentiated wall', () => {
    render(<AddFieldPanel onAdd={vi.fn()} />)

    expect(screen.getByText(/^text$/i)).toBeTruthy()
    expect(screen.getByText(/scales & choice/i)).toBeTruthy()
    expect(screen.getByText(/structure/i)).toBeTruthy()
    expect(screen.getByText(/integrations/i)).toBeTruthy()
  })

  it('places every offered field type in exactly one group', () => {
    render(<AddFieldPanel onAdd={vi.fn()} />)

    const offered = FIELD_REGISTRY.filter((definition) => definition.type !== 'learning')
    expect(screen.getAllByRole('button')).toHaveLength(offered.length)
  })

  it('hands the whole definition back when a tile is picked', () => {
    const onAdd = vi.fn()
    render(<AddFieldPanel onAdd={onAdd} />)

    fireEvent.click(screen.getByRole('button', { name: /star rating/i }))

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'rating' })
    )
  })

  it('leaves the learning field out, as it always has', () => {
    render(<AddFieldPanel onAdd={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /^learning$/i })).toBeNull()
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DecimalInput } from './decimal-input'

afterEach(cleanup)

describe('DecimalInput', () => {
  it('reports a comma decimal as a number and keeps the text as typed', () => {
    const onValueChange = vi.fn()
    render(<DecimalInput aria-label="Weight" value={null} onValueChange={onValueChange} />)
    const input = screen.getByLabelText('Weight') as HTMLInputElement

    fireEvent.change(input, { target: { value: '72,' } })
    expect(input.value).toBe('72,')
    fireEvent.change(input, { target: { value: '72,5' } })

    expect(onValueChange).toHaveBeenLastCalledWith(72.5)
    expect(input.value).toBe('72,5')
    expect(input.getAttribute('inputmode')).toBe('decimal')
  })

  it('ignores keystrokes that cannot become a number', () => {
    const onValueChange = vi.fn()
    render(<DecimalInput aria-label="Weight" value={72} onValueChange={onValueChange} />)
    const input = screen.getByLabelText('Weight') as HTMLInputElement

    fireEvent.change(input, { target: { value: '72kg' } })

    expect(input.value).toBe('72')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('reports null when cleared', () => {
    const onValueChange = vi.fn()
    render(<DecimalInput aria-label="Weight" value={72.5} onValueChange={onValueChange} />)

    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '' } })
    expect(onValueChange).toHaveBeenLastCalledWith(null)
  })

  it('shows a value set from outside, such as a restored draft', () => {
    const { rerender } = render(<DecimalInput aria-label="Weight" value={null} onValueChange={() => {}} />)
    rerender(<DecimalInput aria-label="Weight" value={81.4} onValueChange={() => {}} />)
    expect((screen.getByLabelText('Weight') as HTMLInputElement).value).toBe('81.4')
  })
})

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MetricStepper } from '@/components/metrics/MetricStepper'

afterEach(cleanup)

function setup(value: string, step: number) {
  const onChange = vi.fn()
  render(<MetricStepper value={value} onChange={onChange} step={step} unit="kg" label="Weight" />)
  return onChange
}

describe('MetricStepper', () => {
  it('steps up from the current value without float drift', () => {
    const onChange = setup('81.6', 0.1)

    fireEvent.click(screen.getByRole('button', { name: 'Increase Weight' }))

    expect(onChange).toHaveBeenCalledWith('81.7')
  })

  it('steps down without float drift', () => {
    const onChange = setup('81.6', 0.1)

    fireEvent.click(screen.getByRole('button', { name: 'Decrease Weight' }))

    expect(onChange).toHaveBeenCalledWith('81.5')
  })

  it('steps from 0 when the value is empty', () => {
    const onChange = setup('', 1)

    fireEvent.click(screen.getByRole('button', { name: 'Increase Weight' }))

    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('steps a comma decimal', () => {
    const onChange = setup('81,6', 0.1)

    fireEvent.click(screen.getByRole('button', { name: 'Increase Weight' }))

    expect(onChange).toHaveBeenCalledWith('81.7')
  })

  it('passes typed text through, comma included', () => {
    const onChange = setup('', 0.1)

    fireEvent.change(screen.getByRole('textbox', { name: 'Weight' }), { target: { value: '81,2' } })

    expect(onChange).toHaveBeenCalledWith('81,2')
  })

  it('ignores text that cannot become a number', () => {
    const onChange = setup('', 0.1)

    fireEvent.change(screen.getByRole('textbox', { name: 'Weight' }), { target: { value: 'abc' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the unit', () => {
    setup('81.6', 0.1)

    expect(screen.getByText('kg')).toBeTruthy()
  })
})

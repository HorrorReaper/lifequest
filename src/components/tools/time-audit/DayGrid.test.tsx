import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DayGrid } from './DayGrid'
import { BLOCKS_PER_DAY, seedCategories, type TimeAuditCategory } from './time-audit'

afterEach(cleanup)

const categories: TimeAuditCategory[] = seedCategories()

function blocks(): (string | null)[] {
  return Array.from({ length: BLOCKS_PER_DAY }, () => null)
}

function setup(overrides: Partial<React.ComponentProps<typeof DayGrid>> = {}) {
  const onPaint = vi.fn()
  render(
    <DayGrid
      blocks={overrides.blocks ?? blocks()}
      categories={categories}
      brush={'brush' in overrides ? overrides.brush : 'deep-work'}
      onPaint={overrides.onPaint ?? onPaint}
    />
  )
  return { onPaint: overrides.onPaint ?? onPaint }
}

function block(time: string) {
  return screen.getByRole('button', { name: new RegExp(`^${time}`) })
}

describe('DayGrid', () => {
  it('renders one control per quarter hour of the day', () => {
    setup()
    expect(screen.getAllByRole('button')).toHaveLength(BLOCKS_PER_DAY)
  })

  it('names each block by the time span it covers', () => {
    setup()
    expect(screen.getByRole('button', { name: /09:15 – 09:30/ })).toBeTruthy()
  })

  it('describes an unpainted block as unlogged, so the gap is audible', () => {
    setup()
    expect(block('09:15').getAttribute('aria-label')).toContain('unlogged')
  })

  it('names a painted block by its category', () => {
    const painted = blocks()
    painted[37] = 'deep-work'
    setup({ blocks: painted })
    expect(block('09:15').getAttribute('aria-label')).toContain('Deep work')
  })

  it('paints a single block when one is clicked', () => {
    const { onPaint } = setup()
    fireEvent.click(block('09:15'))
    expect(onPaint).toHaveBeenCalledWith(37, 37)
  })

  it('paints a range when dragged across blocks', () => {
    const { onPaint } = setup()
    fireEvent.pointerDown(block('09:00'))
    fireEvent.pointerEnter(block('09:45'))
    fireEvent.pointerUp(block('09:45'))
    expect(onPaint).toHaveBeenCalledWith(36, 39)
  })

  it('paints the range when dragged upwards', () => {
    const { onPaint } = setup()
    fireEvent.pointerDown(block('09:45'))
    fireEvent.pointerEnter(block('09:00'))
    fireEvent.pointerUp(block('09:00'))
    expect(onPaint).toHaveBeenCalledWith(39, 36)
  })

  it('paints a range from the last block when shift-clicking, the keyboard equivalent of a drag', () => {
    // Dragging is unavailable to keyboard and screen-reader users, so the
    // range has to be reachable without a pointer.
    const { onPaint } = setup()
    fireEvent.click(block('09:00'))
    fireEvent.click(block('10:00'), { shiftKey: true })
    expect(onPaint).toHaveBeenLastCalledWith(36, 40)
  })

  it('does not paint when no brush is selected', () => {
    const { onPaint } = setup({ brush: undefined })
    fireEvent.click(block('09:15'))
    expect(onPaint).not.toHaveBeenCalled()
  })

  it('paints with the eraser brush, which is a selection rather than no selection', () => {
    const { onPaint } = setup({ brush: null })
    fireEvent.click(block('09:15'))
    expect(onPaint).toHaveBeenCalledWith(37, 37)
  })
})

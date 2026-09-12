import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, describe, it, vi } from 'vitest'
import { CardRail } from '@/components/learn/CardRail'

// jsdom ships no ResizeObserver; the rail only uses it to re-measure.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

afterEach(cleanup)

/** jsdom lays nothing out, so the track has to be told how wide it is. */
function measureTrack({ scrollWidth = 900, clientWidth = 300, scrollLeft = 0 } = {}) {
  const track = screen.getByTestId('rail-track')
  Object.defineProperty(track, 'scrollWidth', { value: scrollWidth, configurable: true })
  Object.defineProperty(track, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(track, 'scrollLeft', { value: scrollLeft, writable: true, configurable: true })
  const scrollBy = vi.fn()
  track.scrollBy = scrollBy
  fireEvent.scroll(track)
  return { track, scrollBy }
}

describe('CardRail', () => {
  it('names the rail and shows how much is in it', () => {
    render(<CardRail title="Habits" count={3}><p>card</p></CardRail>)

    expect(screen.getByRole('region', { name: /habits/i })).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('puts every child in its own snap item', () => {
    render(
      <CardRail title="Habits">
        <p>first</p>
        <p>second</p>
      </CardRail>
    )

    const items = screen.getByTestId('rail-track').children
    expect(items).toHaveLength(2)
    expect(items[0].className).toContain('snap-start')
    expect(items[0].textContent).toBe('first')
  })

  it('pages the track forward', () => {
    render(<CardRail title="Habits"><p>card</p></CardRail>)
    const { scrollBy } = measureTrack()

    fireEvent.click(screen.getByRole('button', { name: /scroll habits right/i }))

    expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' })
  })

  it('pages the track back', () => {
    render(<CardRail title="Habits"><p>card</p></CardRail>)
    const { scrollBy } = measureTrack({ scrollLeft: 300 })

    fireEvent.click(screen.getByRole('button', { name: /scroll habits left/i }))

    expect(scrollBy).toHaveBeenCalledWith({ left: -240, behavior: 'smooth' })
  })

  it('disables the back arrow at the start and the forward arrow at the end', () => {
    render(<CardRail title="Habits"><p>card</p></CardRail>)
    measureTrack({ scrollLeft: 0 })

    const back = screen.getByRole('button', { name: /scroll habits left/i }) as HTMLButtonElement
    const forward = screen.getByRole('button', { name: /scroll habits right/i }) as HTMLButtonElement
    expect(back.disabled).toBe(true)
    expect(forward.disabled).toBe(false)

    measureTrack({ scrollLeft: 600 })
    expect((screen.getByRole('button', { name: /scroll habits left/i }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: /scroll habits right/i }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers no arrows when everything already fits', () => {
    render(<CardRail title="Habits"><p>card</p></CardRail>)
    measureTrack({ scrollWidth: 300, clientWidth: 300 })

    expect(screen.queryByRole('button', { name: /scroll habits/i })).toBeNull()
  })
})

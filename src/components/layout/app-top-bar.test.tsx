import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getDefaultShellStats } from '@/lib/shell-stats'
import { AppTopBar } from './app-top-bar'

afterEach(cleanup)

describe('AppTopBar', () => {
  it('shows level, XP, coins and streak', () => {
    render(<AppTopBar stats={{ ...getDefaultShellStats(), totalXp: 640, coins: 120, streak: 5 }} />)

    expect(screen.getByText(/^Lv \d+$/)).toBeTruthy()
    // The XP number sits in its own span (for the pulse), so match the line as a whole.
    expect(screen.getByRole('group', { name: 'Your progress' }).textContent).toMatch(/640 \/ \d+ XP/)
    expect(screen.getByLabelText('120 coins')).toBeTruthy()
    expect(screen.getByLabelText('5 days streak')).toBeTruthy()
  })

  it('says "day" for a streak of one', () => {
    render(<AppTopBar stats={{ ...getDefaultShellStats(), streak: 1 }} />)
    expect(screen.getByLabelText('1 day streak')).toBeTruthy()
  })

  it('starts a new account at level 1 with an empty bar', () => {
    render(<AppTopBar stats={getDefaultShellStats()} />)

    expect(screen.getByText('Lv 1')).toBeTruthy()
    const bar = screen.getByRole('progressbar', { name: 'XP progress to level 2' })
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
  })

  it('sticks beneath the preview banner rather than at the top edge', () => {
    render(<AppTopBar stats={getDefaultShellStats()} />)
    expect(screen.getByRole('group', { name: 'Your progress' }).className).toContain(
      'top-[var(--preview-banner-height,0px)]'
    )
  })

  it('shows nothing extra on first render, however large the values', () => {
    render(<AppTopBar stats={{ ...getDefaultShellStats(), totalXp: 5000, coins: 900 }} />)
    expect(screen.queryAllByTestId('gain-float')).toHaveLength(0)
  })

  it('floats a "+N" for XP and coins when they go up', () => {
    const base = { ...getDefaultShellStats(), totalXp: 640, coins: 120 }
    const { rerender } = render(<AppTopBar stats={base} />)

    rerender(<AppTopBar stats={{ ...base, totalXp: 690, coins: 123 }} />)

    const floats = screen.getAllByTestId('gain-float').map((node) => node.textContent)
    expect(floats).toEqual(expect.arrayContaining(['+50 XP', '+3']))
  })

  it('stays quiet when a value goes down, as when a check-in is undone', () => {
    const base = { ...getDefaultShellStats(), totalXp: 640, coins: 120 }
    const { rerender } = render(<AppTopBar stats={base} />)

    rerender(<AppTopBar stats={{ ...base, totalXp: 630, coins: 117 }} />)

    expect(screen.queryAllByTestId('gain-float')).toHaveLength(0)
  })
})

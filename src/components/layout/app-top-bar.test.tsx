import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { getDefaultShellStats } from '@/lib/shell-stats'
import { AppTopBar } from './app-top-bar'

afterEach(cleanup)

describe('AppTopBar', () => {
  it('shows level, XP, coins and streak', () => {
    render(<AppTopBar stats={{ ...getDefaultShellStats(), totalXp: 640, coins: 120, streak: 5 }} />)

    expect(screen.getByText(/^Lv \d+$/)).toBeTruthy()
    expect(screen.getByText(/^640 \/ \d+ XP$/)).toBeTruthy()
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
})

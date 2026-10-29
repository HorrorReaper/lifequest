import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultAvatarState } from '@/lib/avatar'

const theme = vi.hoisted(() => ({ current: 'dark' }))

vi.mock('next/font/google', () => ({ Fraunces: () => ({ className: 'font-fraunces' }) }))
vi.mock('@/components/providers/theme-provider', () => ({
  useTheme: () => ({ theme: theme.current, setTheme: () => {} }),
}))

import { DashboardGreeting, greetingFor } from './DashboardGreeting'

const bare = getDefaultAvatarState().equippedItems

afterEach(() => {
  cleanup()
  theme.current = 'dark'
})

describe('DashboardGreeting', () => {
  it('shows the avatar and a welcome by name, with no status chips', () => {
    render(<DashboardGreeting username="Patrick" equippedItems={{ ...bare, hat: 'trail-cap' }} />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome back, Patrick 👋')
    expect(screen.getByTestId('avatar-figure')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(document.querySelector('[data-avatar-item="trail-cap"]')).toBeTruthy()
  })

  it('falls back to Adventurer without a username', () => {
    render(<DashboardGreeting username={null} equippedItems={bare} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Adventurer')
  })

  it('greets by the time of day in the profile timezone', () => {
    const at = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    render(<DashboardGreeting username="Patrick" equippedItems={bare} nowMinutes={at('17:40')} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Good afternoon, Patrick 👋')

    expect(greetingFor(at('04:59'))).toBe('Good evening')
    expect(greetingFor(at('05:00'))).toBe('Good morning')
    expect(greetingFor(at('11:59'))).toBe('Good morning')
    expect(greetingFor(at('12:00'))).toBe('Good afternoon')
    expect(greetingFor(at('18:00'))).toBe('Good evening')
    expect(greetingFor(undefined)).toBe('Welcome back')
  })

  it('grows the scene with the day and says so in words', () => {
    const { rerender } = render(<DashboardGreeting username="Patrick" equippedItems={bare} />)
    const scene = () => document.querySelector('[data-slot="hero-scene"]') as SVGElement
    expect(scene().getAttribute('data-stage')).toBe('0')
    expect(scene().getAttribute('aria-hidden')).toBe('true')

    rerender(
      <DashboardGreeting
        username="Patrick"
        equippedItems={bare}
        progress={{ done: 5, total: 7, stage: 2 }}
      />
    )
    expect(scene().getAttribute('data-stage')).toBe('2')
    expect(screen.getByText('Your day so far: 5 of 7 steps done.')).toBeTruthy()
  })

  it('says nothing about progress on a day with nothing on it', () => {
    render(
      <DashboardGreeting
        username="Patrick"
        equippedItems={bare}
        progress={{ done: 0, total: 0, stage: 0 }}
      />
    )
    expect(screen.queryByText(/Your day so far/)).toBeNull()
  })

  it('uses the Trail heading style and punctuation under the Trail theme', () => {
    theme.current = 'trail'
    render(<DashboardGreeting username="Patrick" equippedItems={bare} nowMinutes={19 * 60} />)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toBe('Good evening, Patrick.')
    expect(heading.className).toContain('font-fraunces')
  })
})

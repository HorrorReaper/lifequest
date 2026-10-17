import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultAvatarState } from '@/lib/avatar'

const pathname = vi.hoisted(() => ({ current: '/dashboard' }))

vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/components/layout/quick-action-button', () => ({ QuickActionButton: () => null }))

import { BottomNav } from './bottom-nav'

const bare = getDefaultAvatarState().equippedItems

afterEach(() => {
  cleanup()
  pathname.current = '/dashboard'
})

describe('BottomNav', () => {
  it('has Home, Journal, Library and Avatar, and no separate Settings tab', () => {
    render(<BottomNav equippedItems={bare} />)
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/dashboard',
      '/journal',
      '/learn',
      '/profile',
    ])
    expect(screen.queryByRole('link', { name: /settings/i })).toBeNull()
  })

  it('keeps the Library tab highlighted on the pages under /learn', () => {
    pathname.current = '/learn/tools/wheel-of-life'
    render(<BottomNav equippedItems={bare} />)
    expect(screen.getByRole('link', { name: 'Library' }).className).toContain('text-primary')
    expect(screen.getByRole('link', { name: 'Home' }).className).not.toContain('text-primary')
  })

  it('keeps the Avatar tab highlighted on settings, which opens from it', () => {
    pathname.current = '/settings'
    render(<BottomNav equippedItems={bare} />)
    const avatarTab = screen.getByRole('link', { name: /avatar/i })
    expect(avatarTab.className).toContain('text-primary')
    expect(screen.getByRole('link', { name: 'Home' }).className).not.toContain('text-primary')
  })

  it("shows the player's own head, with the equipped hat, as the Avatar icon", () => {
    const { container } = render(
      <BottomNav equippedItems={{ ...bare, hat: 'sun-hat', jacket: 'rain-jacket' }} />
    )
    const avatarTab = screen.getByRole('link', { name: /avatar/i })

    expect(avatarTab.querySelector('[data-testid="avatar-head"]')).toBeTruthy()
    // Head only: the hat shows, the jacket (a body item) does not.
    expect(container.querySelector('[data-avatar-item="sun-hat"]')).toBeTruthy()
    expect(container.querySelector('[data-avatar-item="rain-jacket"]')).toBeNull()
  })

  it('rings the avatar head only while its tab is active', () => {
    const { rerender } = render(<BottomNav equippedItems={bare} />)
    const ring = () =>
      screen.getByRole('link', { name: /avatar/i }).querySelector('[data-testid="avatar-head"]')
        ?.parentElement

    expect(ring()?.className).toContain('ring-transparent')

    pathname.current = '/profile'
    rerender(<BottomNav equippedItems={bare} />)
    expect(ring()?.className).toContain('ring-primary')
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pathname = vi.hoisted(() => ({ current: '/dashboard' }))

vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('@/components/layout/quick-action-button', () => ({ QuickActionButton: () => null }))

import { BottomNav } from './bottom-nav'

afterEach(cleanup)

describe('BottomNav', () => {
  it('has Home, Journal, Library and Avatar, and no separate Settings tab', () => {
    render(<BottomNav />)
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
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Library' }).className).toContain('text-primary')
    expect(screen.getByRole('link', { name: 'Home' }).className).not.toContain('text-primary')
  })

  it('keeps the Avatar tab highlighted on settings, which opens from it', () => {
    pathname.current = '/settings'
    render(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Avatar' }).className).toContain('text-primary')
    expect(screen.getByRole('link', { name: 'Home' }).className).not.toContain('text-primary')
  })
})

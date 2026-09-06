import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardSectionsCard } from '@/components/settings/DashboardSectionsCard'

const update = vi.fn()

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ client: true }) }))
vi.mock('@/lib/supabase/helpers', () => ({
  supabaseUpdateWhere: (...args: unknown[]) => update(...args),
}))

beforeEach(() => {
  update.mockReset().mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DashboardSectionsCard', () => {
  it('offers a switch for each section the user can see', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    expect(screen.getAllByRole('switch')).toHaveLength(5)
    expect(screen.getByRole('switch', { name: /habits/i })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: /routines/i })).toBeNull()
  })

  it('offers the admin-only section to an admin', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin initial={{}} />)

    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(screen.getByRole('switch', { name: /routines/i })).toBeTruthy()
  })

  it('shows a section with no stored preference as on', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    expect(
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
    ).toBe('true')
  })

  it('shows a section that was turned off as off', () => {
    render(
      <DashboardSectionsCard
        userId="user-1"
        isAdmin={false}
        initial={{ habits: false }}
      />
    )

    expect(
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
    ).toBe('false')
  })

  it('writes the whole map, not just the switch that moved', async () => {
    render(
      <DashboardSectionsCard
        userId="user-1"
        isAdmin={false}
        initial={{ quests: false }}
      />
    )

    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    // A patch of just { habits: false } would silently switch quests back on.
    expect(update.mock.calls[0][2]).toMatchObject({
      dashboard_sections: { quests: false, habits: false },
    })
    expect(update.mock.calls[0][1]).toBe('profiles')
    expect(update.mock.calls[0][4]).toBe('user-1')
  })

  it('moves the switch straight away rather than after the round trip', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))

    expect(
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
    ).toBe('false')
  })

  it('puts the switch back and explains when the write fails', async () => {
    update.mockResolvedValue({ error: { message: 'offline' } })
    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))

    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
      ).toBe('true')
    )
    expect(screen.getByText(/could not save/i)).toBeTruthy()
  })
})

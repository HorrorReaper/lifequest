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

    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(screen.getByRole('switch', { name: /habits/i })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: /routines/i })).toBeNull()
  })

  it('offers the admin-only section to an admin', () => {
    render(<DashboardSectionsCard userId="user-1" isAdmin initial={{}} />)

    expect(screen.getAllByRole('switch')).toHaveLength(7)
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

  it('keeps a later toggle that already saved when an earlier toggle fails after it', async () => {
    let resolveFirst!: (value: { error: unknown }) => void
    let resolveSecond!: (value: { error: unknown }) => void
    const firstCall = new Promise<{ error: unknown }>((resolve) => {
      resolveFirst = resolve
    })
    const secondCall = new Promise<{ error: unknown }>((resolve) => {
      resolveSecond = resolve
    })
    update
      .mockReset()
      .mockImplementationOnce(() => firstCall)
      .mockImplementationOnce(() => secondCall)

    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    // habits is clicked first but its write is the slow one; tasks is
    // clicked second but its write resolves first.
    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))
    fireEvent.click(screen.getByRole('switch', { name: /tasks/i }))

    resolveSecond({ error: null })
    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: /tasks/i }).getAttribute('aria-checked')
      ).toBe('false')
    )

    resolveFirst({ error: { message: 'offline' } })
    await waitFor(() => expect(screen.getByText(/could not save/i)).toBeTruthy())

    // The failed switch rolls back...
    expect(
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
    ).toBe('true')
    // ...but the other switch, already saved, must not be reverted too.
    expect(
      screen.getByRole('switch', { name: /tasks/i }).getAttribute('aria-checked')
    ).toBe('false')
  })

  it('does not let a write that already succeeded persist a value the rolled-back UI no longer shows', async () => {
    let resolveFirst!: (value: { error: unknown }) => void
    let resolveSecond!: (value: { error: unknown }) => void
    const firstCall = new Promise<{ error: unknown }>((resolve) => {
      resolveFirst = resolve
    })
    const secondCall = new Promise<{ error: unknown }>((resolve) => {
      resolveSecond = resolve
    })
    update
      .mockReset()
      .mockImplementationOnce(() => firstCall)
      .mockImplementationOnce(() => secondCall)

    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    // habits is clicked first (its write ends up failing); tasks is
    // clicked second, before habits' write resolves.
    fireEvent.click(screen.getByRole('switch', { name: /habits/i }))
    fireEvent.click(screen.getByRole('switch', { name: /tasks/i }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    resolveFirst({ error: { message: 'offline' } })
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    resolveSecond({ error: null })

    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked')
      ).toBe('true')
    )

    const habitsIsOnInUI =
      screen.getByRole('switch', { name: /habits/i }).getAttribute('aria-checked') ===
      'true'

    // The write that actually succeeded (and is therefore what the row now
    // holds) must agree with what the UI ended up showing after the other
    // write's rollback, not with a value that was rolled back out from
    // under it. Checked against the recorded payload, not the switches,
    // because the bug is exactly that the database and the UI can diverge.
    const persistedPayload = update.mock.calls[update.mock.calls.length - 1][2] as {
      dashboard_sections: Record<string, boolean>
    }
    expect(persistedPayload.dashboard_sections.habits).toBe(habitsIsOnInUI)
  })

  it('keeps the database in sync with the switch when the same section is toggled twice before either write lands', async () => {
    let resolveFirst!: (value: { error: unknown }) => void
    let resolveSecond!: (value: { error: unknown }) => void
    const firstCall = new Promise<{ error: unknown }>((resolve) => {
      resolveFirst = resolve
    })
    const secondCall = new Promise<{ error: unknown }>((resolve) => {
      resolveSecond = resolve
    })

    // Simulates the row: each write, once it resolves successfully,
    // overwrites this with whatever payload it carried -- whichever write
    // resolves last "wins", exactly like a real last-write-wins update.
    let dbSections: Record<string, boolean> | null = null
    update.mockReset()
    update.mockImplementationOnce((...args: unknown[]) => {
      const payload = args[2] as { dashboard_sections: Record<string, boolean> }
      return firstCall.then((result) => {
        if (!result.error) dbSections = payload.dashboard_sections
        return result
      })
    })
    update.mockImplementationOnce((...args: unknown[]) => {
      const payload = args[2] as { dashboard_sections: Record<string, boolean> }
      return secondCall.then((result) => {
        if (!result.error) dbSections = payload.dashboard_sections
        return result
      })
    })

    render(<DashboardSectionsCard userId="user-1" isAdmin={false} initial={{}} />)

    const habitsSwitch = screen.getByRole('switch', { name: /habits/i })
    fireEvent.click(habitsSwitch) // off
    fireEvent.click(habitsSwitch) // back on, before the first write resolves

    await waitFor(() => expect(update).toHaveBeenCalled())

    // Resolve out of order: the second (correct, "on") write lands first,
    // then the first (stale, "off") write lands after it -- the race the
    // reviewer described.
    resolveSecond({ error: null })
    resolveFirst({ error: null })

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(habitsSwitch.getAttribute('aria-checked')).toBe('true')
    )

    // The last payload the database actually received must match where the
    // switch ended up, not a stale value from the first click.
    expect(dbSections).toEqual({ habits: true })
  })
})

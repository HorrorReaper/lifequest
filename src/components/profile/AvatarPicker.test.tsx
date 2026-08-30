import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvatarPicker } from '@/components/profile/AvatarPicker'
import { getDefaultAvatarState } from '@/lib/avatar'

afterEach(cleanup)

const unlockAvatarItem = vi.fn()
const equipAvatarItem = vi.fn()

vi.mock('@/lib/avatar', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatar')>('@/lib/avatar')
  return {
    ...actual,
    unlockAvatarItem: (...args: unknown[]) => unlockAvatarItem(...args),
    equipAvatarItem: (...args: unknown[]) => equipAvatarItem(...args),
  }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

describe('AvatarPicker', () => {
  it('shows the XP requirement for a locked item and disables it', () => {
    render(
      <AvatarPicker
        userId="user-1"
        initialAvatarState={getDefaultAvatarState()}
        initialCoins={100}
        currentXp={0}
      />
    )

    const sunHat = screen.getByRole('button', { name: /sun hat/i })
    expect(sunHat).toHaveProperty('disabled', true)
    expect(sunHat.textContent).toContain('150')
    expect(sunHat.textContent).toContain('XP')
  })

  it('unlocks an affordable, XP-eligible item on click', async () => {
    unlockAvatarItem.mockResolvedValue({
      unlockedItemIds: ['trail-cap'],
      coins: 90,
    })

    render(
      <AvatarPicker
        userId="user-1"
        initialAvatarState={getDefaultAvatarState()}
        initialCoins={100}
        currentXp={0}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /trail cap/i }))

    await waitFor(() => expect(unlockAvatarItem).toHaveBeenCalledWith(expect.anything(), 'trail-cap'))
    await waitFor(() => expect(screen.getByText('90 coins')).toBeTruthy())
  })

  it('shows an error message when unlocking fails', async () => {
    unlockAvatarItem.mockRejectedValue(new Error('Not enough coins'))

    render(
      <AvatarPicker
        userId="user-1"
        initialAvatarState={getDefaultAvatarState()}
        initialCoins={0}
        currentXp={0}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /trail cap/i }))

    await waitFor(() => expect(screen.getByText('Not enough coins')).toBeTruthy())
  })

  it('toggles an owned item between equipped and unequipped', async () => {
    const owned = {
      ...getDefaultAvatarState(),
      unlockedItemIds: ['trail-cap'],
    }
    equipAvatarItem.mockResolvedValue({ ...owned.equippedItems, hat: 'trail-cap' })

    render(
      <AvatarPicker
        userId="user-1"
        initialAvatarState={owned}
        initialCoins={0}
        currentXp={0}
      />
    )

    const trailCap = screen.getByRole('button', { name: /trail cap/i })
    fireEvent.click(trailCap)

    await waitFor(() =>
      expect(equipAvatarItem).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'hat',
        'trail-cap',
        owned.equippedItems
      )
    )
    await waitFor(() => expect(trailCap.getAttribute('aria-pressed')).toBe('true'))
  })
})

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AvatarFigure, AvatarHead, AvatarItemArt } from '@/components/profile/AvatarFigure'
import { AVATAR_ITEM_CATALOG, getDefaultAvatarState } from '@/lib/avatar'

afterEach(cleanup)

describe('AvatarFigure', () => {
  it('draws the bare figure when nothing is equipped', () => {
    const { container } = render(
      <AvatarFigure equippedItems={getDefaultAvatarState().equippedItems} />
    )

    expect(screen.getByRole('img', { name: 'Your avatar' })).toBeTruthy()
    expect(container.querySelectorAll('[data-avatar-item]')).toHaveLength(0)
  })

  it('draws art for each equipped item and nothing for empty slots', () => {
    const { container } = render(
      <AvatarFigure
        equippedItems={{
          hat: 'sun-hat',
          jacket: 'rain-jacket',
          backpack: null,
          boots: 'hiking-boots',
        }}
      />
    )

    expect(container.querySelector('[data-avatar-item="sun-hat"]')).toBeTruthy()
    expect(container.querySelector('[data-avatar-item="rain-jacket"]')).toBeTruthy()
    expect(container.querySelector('[data-avatar-item="hiking-boots"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-avatar-item]')).toHaveLength(3)
  })

  it('replaces the bare feet with boots rather than drawing both', () => {
    const bare = render(
      <AvatarFigure equippedItems={getDefaultAvatarState().equippedItems} />
    )
    const bareFeet = bare.container.querySelectorAll('ellipse').length
    cleanup()

    const booted = render(
      <AvatarFigure
        equippedItems={{ hat: null, jacket: null, backpack: null, boots: 'trail-shoes' }}
      />
    )

    expect(booted.container.querySelectorAll('ellipse').length).toBeLessThan(bareFeet)
  })

  it('ignores an equipped id that has no art instead of crashing', () => {
    const { container } = render(
      <AvatarFigure
        equippedItems={{ hat: 'not-a-real-item', jacket: null, backpack: null, boots: null }}
      />
    )

    expect(container.querySelector('[data-testid="avatar-figure"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-avatar-item]')).toHaveLength(0)
  })
})

describe('AvatarItemArt', () => {
  it('renders art for every item in the catalog', () => {
    for (const item of AVATAR_ITEM_CATALOG) {
      const { container, unmount } = render(<AvatarItemArt item={item} />)
      expect(
        container.querySelector(`[data-avatar-item-preview="${item.id}"]`)
      ).toBeTruthy()
      unmount()
    }
  })

  it('falls back to the catalog emoji for an item without art', () => {
    render(
      <AvatarItemArt
        item={{
          id: 'unknown-item',
          slot: 'hat',
          name: 'Unknown',
          emoji: '🎩',
          cost: 1,
          xpRequired: 0,
        }}
      />
    )

    expect(screen.getByText('🎩')).toBeTruthy()
  })
})

describe('AvatarHead', () => {
  it('shows the head with the hat that is worn', () => {
    const { container } = render(
      <AvatarHead
        equippedItems={{ hat: 'sun-hat', jacket: 'rain-jacket', backpack: null, boots: null }}
      />
    )

    expect(container.querySelector('[data-avatar-item="sun-hat"]')).toBeTruthy()
  })

  it('leaves out gear that is not worn on the head', () => {
    const { container } = render(
      <AvatarHead
        equippedItems={{ hat: null, jacket: 'rain-jacket', backpack: 'day-pack', boots: 'trail-shoes' }}
      />
    )

    expect(container.querySelector('[data-testid="avatar-head"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-avatar-item]')).toHaveLength(0)
  })
})

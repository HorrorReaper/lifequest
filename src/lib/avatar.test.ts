import { describe, expect, it } from 'vitest'
import {
  AVATAR_ITEM_CATALOG,
  AVATAR_SLOTS,
  getDefaultAvatarState,
  getItemsBySlot,
  getLockedItems,
  getNextUnlock,
  getUnlockedItems,
  isItemUnlocked,
} from '@/lib/avatar'

describe('AVATAR_ITEM_CATALOG', () => {
  it('has at least one item for every slot', () => {
    for (const slot of AVATAR_SLOTS) {
      expect(AVATAR_ITEM_CATALOG.some((item) => item.slot === slot)).toBe(true)
    }
  })

  it('has no duplicate item ids', () => {
    const ids = AVATAR_ITEM_CATALOG.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getItemsBySlot', () => {
  it('returns only items belonging to the given slot', () => {
    const items = getItemsBySlot('hat')
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.slot === 'hat')).toBe(true)
  })
})

describe('isItemUnlocked', () => {
  it('is unlocked once XP meets the requirement', () => {
    const item = { id: 'x', slot: 'hat' as const, name: 'X', emoji: '🧢', cost: 10, xpRequired: 150 }
    expect(isItemUnlocked(item, 149)).toBe(false)
    expect(isItemUnlocked(item, 150)).toBe(true)
    expect(isItemUnlocked(item, 151)).toBe(true)
  })
})

describe('getLockedItems / getUnlockedItems', () => {
  it('partitions the whole catalog by XP threshold', () => {
    const xp = 200
    const locked = getLockedItems(xp)
    const unlocked = getUnlockedItems(xp)

    expect(locked.length + unlocked.length).toBe(AVATAR_ITEM_CATALOG.length)
    expect(locked.every((item) => item.xpRequired > xp)).toBe(true)
    expect(unlocked.every((item) => item.xpRequired <= xp)).toBe(true)
  })

  it('unlocks everything with 0 xpRequired at zero XP', () => {
    const unlocked = getUnlockedItems(0)
    expect(unlocked.length).toBe(
      AVATAR_ITEM_CATALOG.filter((item) => item.xpRequired === 0).length
    )
  })
})

describe('getNextUnlock', () => {
  it('returns the cheapest-XP locked item', () => {
    const next = getNextUnlock(0)
    const cheapestLockedXp = Math.min(
      ...AVATAR_ITEM_CATALOG.filter((item) => item.xpRequired > 0).map((item) => item.xpRequired)
    )
    expect(next?.xpRequired).toBe(cheapestLockedXp)
  })

  it('returns null once every item is unlocked', () => {
    const maxXp = Math.max(...AVATAR_ITEM_CATALOG.map((item) => item.xpRequired))
    expect(getNextUnlock(maxXp)).toBeNull()
  })
})

describe('getDefaultAvatarState', () => {
  it('starts with nothing unlocked or equipped', () => {
    const state = getDefaultAvatarState()
    expect(state.unlockedItemIds).toEqual([])
    for (const slot of AVATAR_SLOTS) {
      expect(state.equippedItems[slot]).toBeNull()
    }
  })
})

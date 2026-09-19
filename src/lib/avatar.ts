import type { SupabaseClient } from '@supabase/supabase-js'

// Avatar customization: a small, coin-funded feature independent of City.
// See docs/superpowers/specs/2026-08-30-avatar-nature-redesign-design.md.
//
// The catalog here is display data only. Cost and XP eligibility are
// re-validated (and hard-coded) server-side in unlock_avatar_item — see
// supabase/migrations/20260830120000_create_avatar_states.sql — the same way
// claim_system_quest_reward hard-codes its quest catalog rather than trusting
// a client-supplied reward amount. Keep the two in sync when editing either.

export const AVATAR_SLOTS = ['hat', 'jacket', 'backpack', 'boots'] as const
export type AvatarSlot = (typeof AVATAR_SLOTS)[number]

export interface AvatarItem {
  id: string
  slot: AvatarSlot
  name: string
  emoji: string
  cost: number
  xpRequired: number
}

export const AVATAR_ITEM_CATALOG: AvatarItem[] = [
  { id: 'trail-cap', slot: 'hat', name: 'Trail Cap', emoji: '🧢', cost: 10, xpRequired: 0 },
  { id: 'sun-hat', slot: 'hat', name: 'Sun Hat', emoji: '👒', cost: 25, xpRequired: 150 },
  { id: 'winter-hood', slot: 'hat', name: 'Winter Hood', emoji: '🧣', cost: 40, xpRequired: 500 },

  { id: 'rain-jacket', slot: 'jacket', name: 'Rain Jacket', emoji: '🧥', cost: 15, xpRequired: 0 },
  { id: 'trail-vest', slot: 'jacket', name: 'Trail Vest', emoji: '🦺', cost: 30, xpRequired: 150 },
  { id: 'down-jacket', slot: 'jacket', name: 'Down Jacket', emoji: '🧥', cost: 50, xpRequired: 500 },

  { id: 'day-pack', slot: 'backpack', name: 'Day Pack', emoji: '🎒', cost: 15, xpRequired: 0 },
  { id: 'hiking-pack', slot: 'backpack', name: 'Hiking Pack', emoji: '🎒', cost: 35, xpRequired: 300 },
  { id: 'expedition-pack', slot: 'backpack', name: 'Expedition Pack', emoji: '🎒', cost: 60, xpRequired: 750 },

  { id: 'trail-shoes', slot: 'boots', name: 'Trail Shoes', emoji: '👟', cost: 10, xpRequired: 0 },
  { id: 'hiking-boots', slot: 'boots', name: 'Hiking Boots', emoji: '🥾', cost: 30, xpRequired: 300 },
  { id: 'expedition-boots', slot: 'boots', name: 'Expedition Boots', emoji: '🥾', cost: 55, xpRequired: 750 },
]

export interface AvatarState {
  unlockedItemIds: string[]
  equippedItems: Record<AvatarSlot, string | null>
}

export function getDefaultAvatarState(): AvatarState {
  return {
    unlockedItemIds: [],
    equippedItems: {
      hat: null,
      jacket: null,
      backpack: null,
      boots: null,
    },
  }
}

export function getItemsBySlot(slot: AvatarSlot): AvatarItem[] {
  return AVATAR_ITEM_CATALOG.filter((item) => item.slot === slot)
}

export function isItemUnlocked(item: AvatarItem, currentXp: number): boolean {
  return currentXp >= item.xpRequired
}

export function getLockedItems(currentXp: number): AvatarItem[] {
  return AVATAR_ITEM_CATALOG.filter((item) => !isItemUnlocked(item, currentXp))
}

export function getUnlockedItems(currentXp: number): AvatarItem[] {
  return AVATAR_ITEM_CATALOG.filter((item) => isItemUnlocked(item, currentXp))
}

/** The next locked item the player is closest to reaching, or null once every item is unlocked. */
export function getNextUnlock(currentXp: number): AvatarItem | null {
  const locked = getLockedItems(currentXp)
  if (locked.length === 0) return null
  return [...locked].sort((a, b) => a.xpRequired - b.xpRequired)[0]
}

interface AvatarStateRow {
  unlocked_item_ids: string[] | null
  equipped_items: Record<string, string | null> | null
}

function toAvatarState(row: AvatarStateRow | null): AvatarState {
  const defaults = getDefaultAvatarState()
  if (!row) return defaults

  return {
    unlockedItemIds: row.unlocked_item_ids ?? [],
    equippedItems: { ...defaults.equippedItems, ...(row.equipped_items ?? {}) },
  }
}

export async function fetchAvatarState(
  supabase: SupabaseClient,
  userId: string
): Promise<AvatarState> {
  const { data, error } = await supabase
    .from('avatar_states')
    .select('unlocked_item_ids, equipped_items')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return toAvatarState(data as AvatarStateRow | null)
}

export interface UnlockAvatarItemResult {
  unlockedItemIds: string[]
  coins: number
}

/** Calls the server-authoritative unlock_avatar_item RPC; never trusts a client-side cost. */
export async function unlockAvatarItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<UnlockAvatarItemResult> {
  const { data, error } = await supabase.rpc('unlock_avatar_item', { p_item_id: itemId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    unlockedItemIds: row.unlocked_item_ids ?? [],
    coins: row.coins ?? 0,
  }
}

/**
 * Equips (or unequips, via `itemId: null`) an already-unlocked item in one
 * slot. A plain upsert, not an RPC: it moves no coins and only ever touches
 * the caller's own row under RLS.
 */
export async function equipAvatarItem(
  supabase: SupabaseClient,
  userId: string,
  slot: AvatarSlot,
  itemId: string | null,
  currentEquipped: Record<AvatarSlot, string | null>
): Promise<Record<AvatarSlot, string | null>> {
  const nextEquipped = { ...currentEquipped, [slot]: itemId }

  const { error } = await supabase
    .from('avatar_states')
    .upsert(
      { user_id: userId, equipped_items: nextEquipped },
      { onConflict: 'user_id' }
    )

  if (error) throw error
  return nextEquipped
}

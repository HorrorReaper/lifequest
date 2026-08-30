'use client'

import { useState } from 'react'
import { Check, Coins, Lock } from 'lucide-react'
import {
  AVATAR_SLOTS,
  equipAvatarItem,
  getItemsBySlot,
  isItemUnlocked,
  unlockAvatarItem,
  type AvatarItem,
  type AvatarSlot,
  type AvatarState,
} from '@/lib/avatar'
import { AvatarFigure, AvatarItemArt } from '@/components/profile/AvatarFigure'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/lib/stores/user-store'
import { cn } from '@/lib/utils'

const SLOT_LABELS: Record<AvatarSlot, string> = {
  hat: 'Hat',
  jacket: 'Jacket',
  backpack: 'Backpack',
  boots: 'Boots',
}

interface AvatarPickerProps {
  userId: string
  initialAvatarState: AvatarState
  initialCoins: number
  currentXp: number
}

export function AvatarPicker({
  userId,
  initialAvatarState,
  initialCoins,
  currentXp,
}: AvatarPickerProps) {
  const supabase = createClient()
  const setStoreCoins = useUserStore((state) => state.setCoins)
  const [avatarState, setAvatarState] = useState(initialAvatarState)
  const [coins, setCoins] = useState(initialCoins)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUnlock(item: AvatarItem) {
    if (busyItemId) return
    setBusyItemId(item.id)
    setError(null)
    try {
      const result = await unlockAvatarItem(supabase, item.id)
      setAvatarState((prev) => ({ ...prev, unlockedItemIds: result.unlockedItemIds }))
      setCoins(result.coins)
      setStoreCoins(result.coins)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock this item.')
    } finally {
      setBusyItemId(null)
    }
  }

  async function handleEquipToggle(item: AvatarItem) {
    if (busyItemId) return
    const isEquipped = avatarState.equippedItems[item.slot] === item.id
    setBusyItemId(item.id)
    setError(null)
    try {
      const nextEquipped = await equipAvatarItem(
        supabase,
        userId,
        item.slot,
        isEquipped ? null : item.id,
        avatarState.equippedItems
      )
      setAvatarState((prev) => ({ ...prev, equippedItems: nextEquipped }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your avatar.')
    } finally {
      setBusyItemId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <AvatarFigure equippedItems={avatarState.equippedItems} className="h-44 w-auto" />
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Coins className="size-4 text-yellow-600 dark:text-yellow-400" />
          <span>{coins} coins</span>
        </div>
      </div>

      {AVATAR_SLOTS.map((slot) => (
        <div key={slot} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {SLOT_LABELS[slot]}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {getItemsBySlot(slot).map((item) => {
              const unlockedByXp = isItemUnlocked(item, currentXp)
              const owned = avatarState.unlockedItemIds.includes(item.id)
              const equipped = avatarState.equippedItems[slot] === item.id
              const affordable = coins >= item.cost
              const busy = busyItemId === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy || (!owned && !unlockedByXp)}
                  onClick={() => (owned ? handleEquipToggle(item) : handleUnlock(item))}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-all disabled:opacity-50',
                    equipped
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/15'
                      : 'border-border/60 bg-background hover:border-foreground/30'
                  )}
                  aria-pressed={equipped}
                >
                  <span className="relative flex size-10 items-center justify-center">
                    <AvatarItemArt item={item} className="size-10 text-2xl" />
                    {equipped && (
                      <Check className="absolute -right-1 -top-1 size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                    )}
                  </span>
                  <span className="text-xs font-medium leading-tight">{item.name}</span>
                  {!owned && unlockedByXp && (
                    <span
                      className={cn(
                        'text-[11px]',
                        affordable ? 'text-muted-foreground' : 'text-destructive'
                      )}
                    >
                      {item.cost} coins
                    </span>
                  )}
                  {!unlockedByXp && (
                    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                      <Lock className="size-3" />
                      {item.xpRequired} XP
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

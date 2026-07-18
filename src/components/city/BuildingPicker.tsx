'use client'

import { useState } from 'react'
import { Coins, LockKeyhole } from 'lucide-react'
import type { BuildingType } from '@/lib/city/city'
import { getLockedBuildings, getUnlockedBuildings } from '@/lib/city/city'
import { BuildingSprite } from '@/components/city/BuildingSprite'
import { cn } from '@/lib/utils'

interface BuildingPickerProps {
  xp: number
  coins: number
  selected: BuildingType | null
  onSelect: (building: BuildingType) => void
  className?: string
}

type Category = 'all' | BuildingType['category']

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'residential', label: 'Homes' },
  { value: 'nature', label: 'Nature' },
  { value: 'commercial', label: 'Shops' },
  { value: 'civic', label: 'Civic' },
  { value: 'landmark', label: 'Landmarks' },
]

export function BuildingPicker({ xp, coins, selected, onSelect, className }: BuildingPickerProps) {
  const [category, setCategory] = useState<Category>('all')
  const unlocked = getUnlockedBuildings(xp)
  const locked = getLockedBuildings(xp)
  const visibleUnlocked = unlocked.filter((building) => category === 'all' || building.category === category)
  const visibleLocked = locked.filter((building) => category === 'all' || building.category === category).slice(0, 4)

  return (
    <section
      aria-label="Building catalog"
      className={cn(
        'sticky bottom-[calc(var(--bottom-nav-height)+var(--safe-area-bottom)+0.5rem)] z-30 overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/95 shadow-[0_18px_60px_rgb(26_47_34_/_0.2)] backdrop-blur-xl sm:bottom-4',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Build dock</h2>
          <p className="text-xs text-muted-foreground">
            {selected ? `${selected.name} selected` : 'Choose something for your city'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#f4e1a8]/55 px-3 py-1.5 text-sm font-semibold tabular-nums text-[#765719] dark:bg-[#6f561d]/35 dark:text-[#f2d77e]">
          <Coins className="size-4" />
          {coins}
        </div>
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-2.5" role="tablist" aria-label="Building categories">
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={category === item.value}
            onClick={() => setCategory(item.value)}
            className={cn(
              'min-h-10 shrink-0 rounded-full px-4 text-xs font-medium transition active:scale-[0.97]',
              category === item.value
                ? 'bg-foreground text-background'
                : 'bg-muted/70 text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="scrollbar-none flex snap-x gap-2.5 overflow-x-auto px-4 pb-4">
        {visibleUnlocked.map((building) => {
          const affordable = coins >= building.cost
          const isSelected = selected?.id === building.id

          return (
            <button
              key={building.id}
              type="button"
              onClick={() => onSelect(building)}
              disabled={!affordable}
              aria-pressed={isSelected}
              className={cn(
                'relative min-h-32 w-[7.2rem] shrink-0 snap-start rounded-2xl border p-2 text-left transition duration-200 active:scale-[0.97]',
                isSelected
                  ? 'border-primary bg-primary/8 ring-2 ring-primary/25'
                  : 'border-border/65 bg-background/75 hover:-translate-y-0.5 hover:border-foreground/25',
                !affordable && 'cursor-not-allowed opacity-45'
              )}
            >
              <BuildingSprite building={building} className="mx-auto size-[4.5rem]" />
              <span className="block truncate text-xs font-semibold">{building.name}</span>
              <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Coins className="size-3 text-[#b98921]" />
                {building.cost}
              </span>
            </button>
          )
        })}

        {visibleLocked.map((building) => (
          <div
            key={building.id}
            className="relative min-h-32 w-[7.2rem] shrink-0 snap-start rounded-2xl border border-dashed border-border/70 bg-muted/25 p-2 text-left"
          >
            <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm">
              <LockKeyhole className="size-3" />
            </span>
            <BuildingSprite building={building} muted className="mx-auto size-[4.5rem]" />
            <span className="block truncate text-xs font-semibold text-muted-foreground">{building.name}</span>
            <span className="mt-1 block text-[10px] text-muted-foreground">{building.xpRequired} XP</span>
          </div>
        ))}

        {visibleUnlocked.length === 0 && visibleLocked.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">No buildings in this category.</p>
        )}
      </div>
    </section>
  )
}

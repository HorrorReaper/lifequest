'use client'

import { motion } from 'framer-motion'
import { Lock, PartyPopper } from 'lucide-react'
import type { BuildingType } from '@/lib/city/city'
import { BuildingSprite } from '@/components/city/BuildingSprite'

interface NextUnlockCardProps {
  building: BuildingType | null
  currentXp: number
}

export function NextUnlockCard({ building, currentXp }: NextUnlockCardProps) {
  if (!building) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur-xl">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <PartyPopper className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">All buildings unlocked!</p>
          <p className="text-xs text-muted-foreground">
            You&apos;ve unlocked every building in the city.
          </p>
        </div>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((currentXp / building.xpRequired) * 100))
  const xpToGo = Math.max(0, building.xpRequired - currentXp)

  return (
    <div className="rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Lock className="size-3" />
        Next Unlock
      </div>
      <div className="flex items-center gap-3">
        <BuildingSprite building={building} muted className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{building.name}</p>
          <p className="truncate text-xs text-muted-foreground">{building.description}</p>
        </div>
        <p className="shrink-0 text-sm font-bold text-primary">{xpToGo} XP to go</p>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

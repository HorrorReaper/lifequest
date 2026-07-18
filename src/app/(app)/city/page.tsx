'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  Eye,
  Hammer,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Building, BuildingType, CityState } from '@/lib/city/city'
import {
  claimRewards,
  fetchCityState,
  getDefaultCityState,
  isCellOccupied,
  placeBuilding,
} from '@/lib/city/city'
import { CityGrid, type CityCell } from '@/components/city/CityGrid'
import { BuildingPicker } from '@/components/city/BuildingPicker'
import { BuildingSprite } from '@/components/city/BuildingSprite'
import { RewardsClaimer } from '@/components/city/RewardsClaimer'
import { Button } from '@/components/ui/button'
import { useUserStore } from '@/lib/stores/user-store'
import { cn } from '@/lib/utils'

const CELL_SIZES = [44, 52, 60]

export default function CityPage() {
  const [supabase] = useState(() => createClient())
  const [city, setCity] = useState<CityState>(getDefaultCityState())
  const [userId, setUserId] = useState<string | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null)
  const [previewCell, setPreviewCell] = useState<CityCell | null>(null)
  const [inspectedBuilding, setInspectedBuilding] = useState<Building | null>(null)
  const [mode, setMode] = useState<'view' | 'build'>('view')
  const [zoomIndex, setZoomIndex] = useState(1)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const setStoreCoins = useUserStore((state) => state.setCoins)

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Sign in again to load your city.')
        setLoading(false)
        return
      }

      setUserId(user.id)
      try {
        const state = await fetchCityState(supabase, user.id)
        setCity(state)
        setStoreCoins(state.coins)
      } catch (loadError) {
        console.error('Failed to load city:', loadError)
        setError('Your city could not be loaded. Please try again.')
      }
      setLoading(false)
    }

    void init()
  }, [loadAttempt, supabase, setStoreCoins])

  async function handleClaim(newCoins: number, newXp: number, ids: string[]) {
    if (!userId) return
    setError(null)
    try {
      const updated = await claimRewards(supabase, userId, newCoins, newXp, ids)
      setCity(updated)
      setStoreCoins(updated.coins)
    } catch (claimError) {
      console.error('Claim failed:', claimError)
      setError('Rewards could not be claimed. Your balance was not changed.')
    }
  }

  function selectMode(nextMode: 'view' | 'build') {
    setMode(nextMode)
    setPreviewCell(null)
    setInspectedBuilding(null)
    if (nextMode === 'view') setSelectedBuilding(null)
  }

  function handleBuildingSelect(building: BuildingType) {
    setSelectedBuilding(building)
    setPreviewCell(null)
    setInspectedBuilding(null)
  }

  function handleCellClick(row: number, col: number, building: Building | null) {
    setError(null)

    if (building) {
      setInspectedBuilding(building)
      setPreviewCell(null)
      return
    }

    setInspectedBuilding(null)
    if (mode !== 'build' || !selectedBuilding) return

    if (city.coins < selectedBuilding.cost) {
      setError(`You need ${selectedBuilding.cost - city.coins} more coins for ${selectedBuilding.name}.`)
      return
    }

    setPreviewCell({ row, col })
  }

  async function confirmPlacement() {
    if (!previewCell || !selectedBuilding || !userId || placing) return
    if (isCellOccupied(city.buildings, previewCell.row, previewCell.col)) {
      setError('That city space is already occupied.')
      setPreviewCell(null)
      return
    }

    setPlacing(true)
    setError(null)
    try {
      const updated = await placeBuilding(
        supabase,
        userId,
        selectedBuilding,
        previewCell.row,
        previewCell.col
      )
      setCity(updated)
      setStoreCoins(updated.coins)
      setPreviewCell(null)
    } catch (placementError) {
      console.error('Place failed:', placementError)
      setError('The building could not be placed. Your coins were not changed.')
    } finally {
      setPlacing(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6 sm:py-8" aria-busy="true">
        <div className="h-10 w-44 animate-pulse rounded-xl bg-muted" />
        <div className="h-[65dvh] animate-pulse rounded-[2rem] bg-muted/70" />
        <span className="sr-only">Loading your city</span>
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-7xl space-y-3 px-3 py-4 sm:space-y-4 sm:px-6 sm:py-8">
      <header className="flex items-end justify-between gap-4 px-1">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Your world</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My city</h1>
        </div>
        <p className="hidden max-w-md text-right text-sm text-muted-foreground sm:block">
          Turn your daily progress into a place that feels like yours.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-sm sm:flex-row sm:items-center"
        >
          <AlertCircle className="size-5 shrink-0 text-destructive" />
          <p className="min-w-0 flex-1 text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            <RefreshCw className="size-4" />
            Reload
          </Button>
        </div>
      )}

      {userId && (
        <RewardsClaimer
          userId={userId}
          claimedIds={city.claimedEntryIds}
          onClaim={handleClaim}
        />
      )}

      <section className="relative overflow-hidden rounded-[2rem] border border-[#91b8bd]/35 bg-[linear-gradient(180deg,#b9dde1_0%,#d8ebdc_38%,#9fc487_100%)] shadow-[0_24px_80px_rgb(35_70_59_/_0.16)] dark:bg-[linear-gradient(180deg,#183744_0%,#24483d_42%,#193a29_100%)]">
        <div className="pointer-events-none absolute -left-12 top-20 size-40 rounded-full bg-white/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-72 bg-[radial-gradient(circle_at_center,rgb(255_255_255_/_0.35),transparent_68%)]" />

        <div className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-3">
          <div className="flex rounded-2xl border border-white/45 bg-background/85 p-1 shadow-sm backdrop-blur-md">
            {(['view', 'build'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => selectMode(item)}
                className={cn(
                  'flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold capitalize transition active:scale-[0.97]',
                  mode === item ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground'
                )}
                aria-pressed={mode === item}
              >
                {item === 'view' ? <Eye className="size-4" /> : <Hammer className="size-4" />}
                {item}
              </button>
            ))}
          </div>

          <div className="flex rounded-2xl border border-white/45 bg-background/85 p-1 shadow-sm backdrop-blur-md">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
              disabled={zoomIndex === 0}
              aria-label="Zoom city out"
            >
              <Minus className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setZoomIndex((index) => Math.min(CELL_SIZES.length - 1, index + 1))}
              disabled={zoomIndex === CELL_SIZES.length - 1}
              aria-label="Zoom city in"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="h-[58dvh] min-h-[25rem] max-h-[44rem] overflow-auto overscroll-contain px-8 pb-24 pt-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full min-w-full items-center justify-center">
            <CityGrid
              buildings={city.buildings}
              selectedBuilding={selectedBuilding}
              previewCell={previewCell}
              onCellClick={handleCellClick}
              mode={mode}
              cellSize={CELL_SIZES[zoomIndex]}
            />
          </div>
        </div>

        {mode === 'build' && !selectedBuilding && !previewCell && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 mx-auto max-w-sm rounded-2xl border border-white/40 bg-background/85 px-4 py-3 text-center text-sm shadow-lg backdrop-blur-md">
            Choose a building from the dock, then tap an empty tile.
          </div>
        )}

        {city.buildings.length === 0 && mode === 'view' && (
          <div className="absolute inset-x-4 bottom-4 z-10 mx-auto max-w-sm rounded-2xl border border-white/40 bg-background/85 px-4 py-3 text-center text-sm shadow-lg backdrop-blur-md">
            Your first plot is ready. Switch to Build and shape the beginning of your city.
          </div>
        )}

        {previewCell && selectedBuilding && (
          <div className="absolute inset-x-3 bottom-3 z-20 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/50 bg-background/95 p-2.5 shadow-xl backdrop-blur-xl">
            <BuildingSprite building={selectedBuilding} className="size-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Place {selectedBuilding.name}?</p>
              <p className="text-xs text-muted-foreground">This uses {selectedBuilding.cost} coins.</p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setPreviewCell(null)}
              aria-label="Cancel building placement"
            >
              <X className="size-4" />
            </Button>
            <Button type="button" size="sm" onClick={confirmPlacement} disabled={placing}>
              {placing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Place
            </Button>
          </div>
        )}

        {inspectedBuilding && !previewCell && (
          <div className="absolute inset-x-3 bottom-3 z-20 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/50 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
            <BuildingSprite building={inspectedBuilding.type} className="size-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{inspectedBuilding.type.name}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{inspectedBuilding.type.description}</p>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setInspectedBuilding(null)}
              aria-label="Close building details"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </section>

      {mode === 'build' && (
        <BuildingPicker
          xp={city.xp}
          coins={city.coins}
          selected={selectedBuilding}
          onSelect={handleBuildingSelect}
        />
      )}
    </main>
  )
}

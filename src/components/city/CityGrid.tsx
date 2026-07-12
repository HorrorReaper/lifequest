'use client'

import type { Building, BuildingType } from '@/lib/city/city'
import { GRID_SIZE } from '@/lib/city/city'
import { BuildingSprite } from '@/components/city/BuildingSprite'
import { cn } from '@/lib/utils'

export interface CityCell {
  row: number
  col: number
}

interface CityGridProps {
  buildings: Building[]
  selectedBuilding: BuildingType | null
  previewCell: CityCell | null
  onCellClick: (row: number, col: number, building: Building | null) => void
  mode: 'view' | 'build'
  cellSize: number
}

function terrainTone(row: number, col: number) {
  const variant = (row * 3 + col * 5) % 4
  return [
    'bg-[#b9d9a5]',
    'bg-[#b1d29e]',
    'bg-[#c0dda9]',
    'bg-[#acd09a]',
  ][variant]
}

export function CityGrid({
  buildings,
  selectedBuilding,
  previewCell,
  onCellClick,
  mode,
  cellSize,
}: CityGridProps) {
  const buildingMap = new Map(buildings.map((building) => [`${building.row}:${building.col}`, building]))

  return (
    <div
      className="relative isolate grid rounded-[1.75rem] border-[6px] border-[#d7e8c8] bg-[#9fc38c] p-1 shadow-[inset_0_0_0_1px_rgb(55_91_62_/_0.12),0_24px_60px_rgb(36_64_46_/_0.18)] dark:border-[#294535] dark:bg-[#1c3828]"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
        width: `${GRID_SIZE * cellSize + 20}px`,
      }}
      aria-label="Your city building grid"
    >
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
        const row = Math.floor(index / GRID_SIZE)
        const col = index % GRID_SIZE
        const building = buildingMap.get(`${row}:${col}`) ?? null
        const isPreview = previewCell?.row === row && previewCell.col === col
        const canPreview = mode === 'build' && selectedBuilding && !building
        const isBoulevard = row === 4 || col === 5

        return (
          <button
            key={`${row}:${col}`}
            type="button"
            onClick={() => onCellClick(row, col, building)}
            className={cn(
              'group relative flex aspect-square items-center justify-center overflow-visible border border-[#8db77c]/35 outline-none transition duration-150 active:scale-[0.96] focus-visible:z-[120] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              terrainTone(row, col),
              isBoulevard && 'after:absolute after:inset-0 after:bg-[#d8cba8]/55 after:content-[\'\']',
              mode === 'build' && !building && 'cursor-crosshair hover:z-[110] hover:brightness-105',
              mode === 'view' && !building && 'cursor-grab',
              isPreview && 'z-[115] ring-2 ring-primary ring-inset'
            )}
            style={{ zIndex: isPreview ? 115 : row * GRID_SIZE + col + 1 }}
            aria-label={
              building
                ? `${building.type.name}, row ${row + 1}, column ${col + 1}`
                : canPreview
                  ? `Preview ${selectedBuilding.name} at row ${row + 1}, column ${col + 1}`
                  : `Empty land, row ${row + 1}, column ${col + 1}`
            }
          >
            <span className="pointer-events-none absolute inset-x-1 bottom-1 h-1 rounded-full bg-[#466d4d]/10" />
            {building && (
              <BuildingSprite
                building={building.type}
                className="pointer-events-none relative z-10 size-[118%] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105"
              />
            )}
            {isPreview && selectedBuilding && (
              <BuildingSprite
                building={selectedBuilding}
                className="pointer-events-none relative z-20 size-[118%] animate-pulse opacity-75"
              />
            )}
            {canPreview && !isPreview && (
              <span className="pointer-events-none relative z-10 size-2 rounded-full bg-[#527b57]/0 transition group-hover:bg-[#527b57]/35" />
            )}
          </button>
        )
      })}
    </div>
  )
}

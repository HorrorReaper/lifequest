"use client";

import { Building, GRID_SIZE, isCellOccupied, BuildingType } from "@/lib/city";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CityGridProps {
  buildings: Building[];
  selectedBuilding: BuildingType | null;
  onCellClick: (row: number, col: number) => void;
  mode: "view" | "build";
}

export function CityGrid({ buildings, selectedBuilding, onCellClick, mode }: CityGridProps) {
  const grid = Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => {
      return buildings.find((b) => b.row === row && b.col === col) ?? null;
    })
  );

  return (
    <TooltipProvider>
      <div
        className="inline-grid gap-0.5 rounded-xl border-2 border-primary/20 p-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        }}
      >
        {grid.flat().map((building, idx) => {
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          const occupied = building !== null;
          const canPlace = mode === "build" && selectedBuilding && !occupied;

          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCellClick(row, col)}
                  disabled={mode === "view" && !occupied}
                  className={cn(
                    "h-10 w-10 sm:h-12 sm:w-12 rounded-md text-xl flex items-center justify-center transition-all duration-150",
                    occupied
                      ? "bg-white dark:bg-gray-800 shadow-sm"
                      : "bg-green-100/60 dark:bg-green-900/20",
                    canPlace &&
                      "cursor-pointer ring-2 ring-primary/40 hover:ring-primary hover:bg-primary/10",
                    mode === "build" && !canPlace && !occupied && "cursor-not-allowed opacity-50",
                    mode === "view" && !occupied && "cursor-default"
                  )}
                >
                  {building ? building.type.emoji : ""}
                </button>
              </TooltipTrigger>
              {occupied && building && (
                <TooltipContent>
                  <p className="font-semibold">{building.type.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {building.type.description}
                  </p>
                </TooltipContent>
              )}
              {canPlace && (
                <TooltipContent>
                  <p className="text-xs">Click to place {selectedBuilding?.name}</p>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

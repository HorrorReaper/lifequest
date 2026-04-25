"use client";

import { useState, useCallback } from "react";
import {
  BuildingType,
  CityState,
  loadCityState,
  saveCityState,
  isCellOccupied,
  getLevel,
} from "@/lib/city";
import { CityGrid } from "@/components/city/CityGrid";
import { BuildingPicker } from "@/components/city/BuildingPicker";
import { RewardsClaimer } from "@/components/city/RewardsClaimer";
import { LevelProgress } from "@/components/city/LevelProgress";
import { Button } from "@/components/ui/button";
import { Eye, Hammer } from "lucide-react";

export default function CityPage() {
  const [city, setCity] = useState<CityState>(loadCityState);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null);
  const [mode, setMode] = useState<"view" | "build">("view");
  const [justPlaced, setJustPlaced] = useState<string | null>(null);

  const persist = useCallback((next: CityState) => {
    setCity(next);
    saveCityState(next);
  }, []);

  const handleClaim = (newCoins: number, newXp: number, ids: string[]) => {
    const next: CityState = {
      ...city,
      coins: city.coins + newCoins,
      xp: city.xp + newXp,
      level: getLevel(city.xp + newXp),
      lastClaimedEntryIds: [...city.lastClaimedEntryIds, ...ids],
    };
    persist(next);
  };

  const handleCellClick = (row: number, col: number) => {
    if (mode !== "build" || !selectedBuilding) return;
    if (isCellOccupied(city.buildings, row, col)) return;
    if (city.coins < selectedBuilding.cost) return;

    const newBuilding = {
      id: `${selectedBuilding.id}-${Date.now()}`,
      type: selectedBuilding,
      row,
      col,
      placedAt: new Date().toISOString(),
    };

    const next: CityState = {
      ...city,
      coins: city.coins - selectedBuilding.cost,
      buildings: [...city.buildings, newBuilding],
    };

    persist(next);
    setJustPlaced(newBuilding.id);
    setTimeout(() => setJustPlaced(null), 600);
  };

  const population = city.buildings.filter(
    (b) => b.type.category === "residential"
  ).length * 12 +
    city.buildings.filter((b) => b.type.category === "commercial").length * 5;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🏙️ My City</h1>
          <p className="text-muted-foreground mt-1">
            Journal to earn coins & XP, then build your dream city.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={mode === "view" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setMode("view");
              setSelectedBuilding(null);
            }}
          >
            <Eye className="h-4 w-4 mr-1" /> View
          </Button>
          <Button
            variant={mode === "build" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("build")}
          >
            <Hammer className="h-4 w-4 mr-1" /> Build
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid md:grid-cols-3 gap-4">
        <LevelProgress xp={city.xp} coins={city.coins} />
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <span className="text-3xl">🏗️</span>
          <div>
            <p className="text-2xl font-bold">{city.buildings.length}</p>
            <p className="text-xs text-muted-foreground">Buildings</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <span className="text-3xl">👥</span>
          <div>
            <p className="text-2xl font-bold">{population}</p>
            <p className="text-xs text-muted-foreground">Population</p>
          </div>
        </div>
      </div>

      {/* Rewards */}
      <RewardsClaimer
        claimedIds={city.lastClaimedEntryIds}
        onClaim={handleClaim}
      />

      {/* Grid + Picker */}
      <div className="grid lg:grid-cols-[auto_1fr] gap-6 items-start">
        <div className="flex justify-center">
          <CityGrid
            buildings={city.buildings}
            selectedBuilding={selectedBuilding}
            onCellClick={handleCellClick}
            mode={mode}
          />
        </div>

        {mode === "build" && (
          <BuildingPicker
            xp={city.xp}
            coins={city.coins}
            selected={selectedBuilding}
            onSelect={setSelectedBuilding}
          />
        )}

        {mode === "view" && city.buildings.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Your city is empty! Switch to Build mode and place your first building.
          </div>
        )}

        {mode === "view" && city.buildings.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              City Inventory
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(
                city.buildings.reduce<Record<string, { type: BuildingType; count: number }>>(
                  (acc, b) => {
                    if (!acc[b.type.id]) acc[b.type.id] = { type: b.type, count: 0 };
                    acc[b.type.id].count++;
                    return acc;
                  },
                  {}
                )
              ).map(([id, { type, count }]) => (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="text-lg">{type.emoji}</span>
                  <span>{type.name}</span>
                  <span className="ml-auto text-muted-foreground">×{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

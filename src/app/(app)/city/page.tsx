"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BuildingType,
  CityState,
  fetchCityState,
  claimRewards,
  placeBuilding,
  getDefaultCityState,
  isCellOccupied,
} from "@/lib/city/city";
import { CityGrid } from "@/components/city/CityGrid";
import { BuildingPicker } from "@/components/city/BuildingPicker";
import { RewardsClaimer } from "@/components/city/RewardsClaimer";
import { Button } from "@/components/ui/button";
import { Eye, Hammer } from "lucide-react";
import { useUserStore } from "@/lib/stores/user-store";

export default function CityPage() {
  const [supabase] = useState(() => createClient());
  const [city, setCity] = useState<CityState>(getDefaultCityState());
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingType | null>(null);
  const [mode, setMode] = useState<"view" | "build">("view");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const setStoreCoins = useUserStore((s) => s.setCoins);

  // Load user + city state
  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      try {
        const state = await fetchCityState(supabase, user.id);
        setCity(state);
        setStoreCoins(state.coins);
      } catch (err) {
        console.error("Failed to load city:", err);
      }
      setLoading(false);
    }
    init();
  }, [supabase, setStoreCoins]);

  // Claim rewards handler
  async function handleClaim(newCoins: number, newXp: number, ids: string[]) {
    if (!userId) return;
    try {
      const updated = await claimRewards(supabase, userId, newCoins, newXp, ids);
      setCity(updated);
      setStoreCoins(updated.coins);
    } catch (err) {
      console.error("Claim failed:", err);
    }
  }

  // Place building handler
  async function handleCellClick(row: number, col: number) {
    if (mode !== "build" || !selectedBuilding || !userId || placing) return;
    if (isCellOccupied(city.buildings, row, col)) return;
    if (city.coins < selectedBuilding.cost) return;

    setPlacing(true);
    try {
      const updated = await placeBuilding(supabase, userId, selectedBuilding, row, col);
      setCity(updated);
      setStoreCoins(updated.coins);
    } catch (err) {
      console.error("Place failed:", err);
    }
    setPlacing(false);
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl text-center">
        <p className="text-muted-foreground">Loading your city...</p>
      </div>
    );
  }

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

      {/* Rewards */}
      {userId && (
        <RewardsClaimer
          userId={userId}
          claimedIds={city.claimedEntryIds}
          onClaim={handleClaim}
        />
      )}

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

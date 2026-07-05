"use client";

import { BuildingType, getUnlockedBuildings, getLockedBuildings } from "@/lib/city";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface BuildingPickerProps {
  xp: number;
  coins: number;
  selected: BuildingType | null;
  onSelect: (building: BuildingType) => void;
}

export function BuildingPicker({ xp, coins, selected, onSelect }: BuildingPickerProps) {
  const unlocked = getUnlockedBuildings(xp);
  const locked = getLockedBuildings(xp);

  const categories = ["nature", "residential", "commercial", "civic", "landmark"] as const;
  const categoryEmoji: Record<string, string> = {
    nature: "🌿",
    residential: "🏘️",
    commercial: "🛍️",
    civic: "🏛️",
    landmark: "⭐",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Buildings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((cat) => {
          const available = unlocked.filter((b) => b.category === cat);
          const lockedInCat = locked.filter((b) => b.category === cat);
          if (available.length === 0 && lockedInCat.length === 0) return null;

          return (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {categoryEmoji[cat]} {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {available.map((b) => {
                  const affordable = coins >= b.cost;
                  const isSelected = selected?.id === b.id;

                  return (
                    <button
                      key={b.id}
                      onClick={() => onSelect(b)}
                      disabled={!affordable}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all hover:cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary"
                          : "hover:border-primary/50",
                        !affordable && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <span className="text-lg">{b.emoji}</span>
                      <span>{b.name}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">
                        <Coins className="h-3.5 w-3.5 text-yellow-500" /> {b.cost} 
                      </Badge>
                    </button>
                  );
                })}
                {lockedInCat.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm opacity-30"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>{b.name}</span>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {b.xpRequired} XP
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

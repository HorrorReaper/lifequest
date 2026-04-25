"use client";

import { getLevelProgress, getLevel } from "@/lib/city";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Coins } from "lucide-react";

interface LevelProgressProps {
  xp: number;
  coins: number;
}

export function LevelProgress({ xp, coins }: LevelProgressProps) {
  const level = getLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
              {level}
            </div>
            <div>
              <p className="font-semibold text-sm">Level {level}</p>
              <p className="text-xs text-muted-foreground">
                {xp} / {progress.next} XP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-yellow-500" />
              <span className="font-bold">{coins}</span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="font-bold">{xp}</span>
            </div>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress.pct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {progress.next - xp} XP to level {level + 1}
        </p>
      </CardContent>
    </Card>
  );
}

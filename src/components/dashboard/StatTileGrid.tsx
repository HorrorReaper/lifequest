"use client";

import { motion } from "framer-motion";
import { Flame, Zap, Coins, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileGridProps {
  streak: number;
  bestStreak: number;
  totalXp: number;
  coins: number;
  level: number;
}

interface Tile {
  icon: LucideIcon;
  label: string;
  value: number;
  iconBgClass: string;
  caption?: string;
}

export function StatTileGrid({ streak, bestStreak, totalXp, coins, level }: StatTileGridProps) {
  const tiles: Tile[] = [
    {
      icon: Flame,
      label: "Day Streak",
      value: streak,
      iconBgClass: "bg-orange-500/15 text-orange-500",
      caption: streak > 0 && streak >= bestStreak ? "Best ever!" : undefined,
    },
    {
      icon: Zap,
      label: "Total XP",
      value: totalXp,
      iconBgClass: "bg-blue-500/15 text-blue-500",
    },
    {
      icon: Coins,
      label: "Coins",
      value: coins,
      iconBgClass: "bg-yellow-500/15 text-yellow-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((tile, index) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06, duration: 0.35 }}
          whileHover={{ scale: 1.03 }}
          className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
        >
          <div className={cn("flex size-9 items-center justify-center rounded-full", tile.iconBgClass)}>
            <tile.icon className="size-4.5" />
          </div>
          <p className="text-xl font-bold font-heading">{tile.value}</p>
          <p className="text-xs text-muted-foreground">{tile.label}</p>
          {tile.caption && <p className="text-[10px] text-primary">{tile.caption}</p>}
        </motion.div>
      ))}
    </div>
  );
}

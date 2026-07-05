"use client";

import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { XpRing } from "./XpRing";

interface DashboardHeroProps {
  username: string | null;
  level: number;
  cityTierLabel: string;
  xpNext: number;
  totalXp: number;
  pct: number;
  coins: number;
}

export function DashboardHero({
  username,
  level,
  cityTierLabel,
  xpNext,
  totalXp,
  pct,
  coins,
}: DashboardHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl bg-card p-5 ring-1 ring-foreground/10"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-chart-4/10" />
      <div className="relative flex items-center gap-4">
        <XpRing pct={pct} level={level} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold font-heading sm:text-2xl">
            Welcome back, {username ?? "Adventurer"} 👋
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              {cityTierLabel}
            </Badge>
            <Badge variant="outline" className="gap-1 border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
              <Coins className="size-3.5" />
              {coins}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {Math.max(0, xpNext - totalXp)} XP to Level {level + 1}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

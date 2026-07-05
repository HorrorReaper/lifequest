"use client";

import { motion } from "framer-motion";
import { Lock, PartyPopper } from "lucide-react";

interface NextRewardBuilding {
  id: string;
  name: string;
  emoji: string;
  description: string;
  xpRequired: number;
  cost: number;
}

interface NextRewardCardProps {
  building: NextRewardBuilding | null;
  currentXp: number;
}

export function NextRewardCard({ building, currentXp }: NextRewardCardProps) {
  if (!building) {
    return (
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            <PartyPopper className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">All buildings unlocked!</p>
            <p className="text-xs text-muted-foreground">
              You&apos;ve unlocked every building in the city. Amazing work!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((currentXp / building.xpRequired) * 100));
  const xpToGo = Math.max(0, building.xpRequired - currentXp);

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-chart-2/10 to-transparent p-4 ring-1 ring-foreground/10">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Lock className="size-3" />
        Next Unlock
      </div>
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">
          {building.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{building.name}</p>
          <p className="truncate text-xs text-muted-foreground">{building.description}</p>
        </div>
        <p className="shrink-0 text-sm font-bold text-primary">{xpToGo} XP to go</p>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-chart-2"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

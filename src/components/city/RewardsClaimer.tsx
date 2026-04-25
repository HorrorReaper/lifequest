"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Coins, Sparkles } from "lucide-react";
import { calculateRewards } from "@/lib/city";
import { calculateStreaks, JournalEntry } from "@/lib/analytics";

interface RewardsClaimerProps {
  claimedIds: string[];
  onClaim: (newCoins: number, newXp: number, claimedIds: string[]) => void;
}

export function RewardsClaimer({ claimedIds, onClaim }: RewardsClaimerProps) {
  const [unclaimed, setUnclaimed] = useState<JournalEntry[]>([]);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("journal-entries");
    if (!stored) return;
    try {
      const entries: JournalEntry[] = JSON.parse(stored);
      const fresh = entries.filter((e) => !claimedIds.includes(e.id));
      setUnclaimed(fresh);
      setStreakDays(calculateStreaks(entries).current);
    } catch {
      setUnclaimed([]);
    }
  }, [claimedIds]);

  if (unclaimed.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No unclaimed rewards. Write a journal entry to earn coins & XP!
        </CardContent>
      </Card>
    );
  }

  const rewards = calculateRewards(unclaimed.length, streakDays);

  const handleClaim = () => {
    const ids = unclaimed.map((e) => e.id);
    onClaim(rewards.coins, rewards.xp, ids);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Unclaimed Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You have <strong>{unclaimed.length}</strong> unclaimed{" "}
          {unclaimed.length === 1 ? "entry" : "entries"}.
          {streakDays > 1 && (
            <span className="text-primary font-medium">
              {" "}🔥 {streakDays}-day streak bonus active!
            </span>
          )}
        </p>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-yellow-500" />
            <span className="text-xl font-bold">+{rewards.coins}</span>
            <span className="text-sm text-muted-foreground">coins</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="text-xl font-bold">+{rewards.xp}</span>
            <span className="text-sm text-muted-foreground">XP</span>
          </div>
        </div>
        <Button onClick={handleClaim} className="w-full">
          <Gift className="h-4 w-4 mr-2" />
          Claim Rewards
        </Button>
      </CardContent>
    </Card>
  );
}

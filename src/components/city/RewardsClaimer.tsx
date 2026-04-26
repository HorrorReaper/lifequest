"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Coins, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  calculateRewards,
  fetchUnclaimedEntryCount,
} from "@/lib/city/city";
import { calculateStreaks, JournalEntry } from "@/lib/analytics";

interface RewardsClaimerProps {
  userId: string;
  claimedIds: string[];
  onClaim: (newCoins: number, newXp: number, claimedIds: string[]) => void;
}

export function RewardsClaimer({ userId, claimedIds, onClaim }: RewardsClaimerProps) {
  const supabase = createClient();
  const [unclaimedCount, setUnclaimedCount] = useState(0);
  const [unclaimedIds, setUnclaimedIds] = useState<string[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Get unclaimed entries
      const { count, entryIds } = await fetchUnclaimedEntryCount(
        supabase,
        userId,
        claimedIds
      );
      setUnclaimedCount(count);
      setUnclaimedIds(entryIds);

      // Get streak from journal_entries
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id, created_at")
        .eq("user_id", userId);

      if (entries) {
        const mapped = entries.map((e: any) => ({
          id: e.id,
          templateId: "",
          templateName: "",
          createdAt: e.created_at,
          fields: {},
        }));
        setStreakDays(calculateStreaks(mapped).current);
      }

      setLoading(false);
    }
    load();
  }, [userId, claimedIds]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Loading rewards...
        </CardContent>
      </Card>
    );
  }

  if (unclaimedCount === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No unclaimed rewards. Write a journal entry to earn coins & XP!
        </CardContent>
      </Card>
    );
  }

  const rewards = calculateRewards(unclaimedCount, streakDays);

  const handleClaim = async () => {
    setClaiming(true);
    onClaim(rewards.coins, rewards.xp, unclaimedIds);
    setClaiming(false);
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
          You have <strong>{unclaimedCount}</strong> unclaimed{" "}
          {unclaimedCount === 1 ? "entry" : "entries"}.
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
        <Button onClick={handleClaim} className="w-full" disabled={claiming}>
          {claiming ? "Claiming..." : (
            <>
              <Gift className="h-4 w-4 mr-2" />
              Claim Rewards
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

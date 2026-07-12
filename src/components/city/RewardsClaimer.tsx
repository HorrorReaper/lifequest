"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Gift, Coins, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  calculateRewards,
  fetchUnclaimedEntryCount,
} from "@/lib/city/city";
import { calculateStreaks, type JournalEntry } from "@/lib/analytics";

interface RewardsClaimerProps {
  userId: string;
  claimedIds: string[];
  onClaim: (newCoins: number, newXp: number, claimedIds: string[]) => void | Promise<void>;
}

export function RewardsClaimer({ userId, claimedIds, onClaim }: RewardsClaimerProps) {
  const [supabase] = useState(() => createClient());
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
        const entryRows = entries as unknown as Array<{ id: string; created_at: string }>
        const mapped: JournalEntry[] = entryRows.map((entry) => ({
          id: entry.id,
          templateId: "",
          templateName: "",
          createdAt: entry.created_at,
          fields: {},
        }));
        setStreakDays(calculateStreaks(mapped).current);
      }

      setLoading(false);
    }
    load();
  }, [userId, claimedIds, supabase]);

  if (loading) {
    return null;
  }

  if (unclaimedCount === 0) {
    return null;
  }

  const rewards = calculateRewards(unclaimedCount, streakDays);

  const handleClaim = async () => {
    setClaiming(true);
    await onClaim(rewards.coins, rewards.xp, unclaimedIds);
    setClaiming(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#d9b95f]/30 bg-[#fff5d7]/75 p-3 text-[#5f491d] shadow-sm dark:bg-[#44391d]/70 dark:text-[#f2dda0] sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#efd37b]/35">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Your journal created new city resources</p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs opacity-75">
            <span className="inline-flex items-center gap-1"><Coins className="size-3" /> +{rewards.coins}</span>
            <span className="inline-flex items-center gap-1"><Sparkles className="size-3" /> +{rewards.xp} XP</span>
            {streakDays > 1 && <span>{streakDays}-day bonus</span>}
          </p>
        </div>
      </div>
      <Button onClick={handleClaim} size="sm" className="shrink-0" disabled={claiming}>
        {claiming ? "Claiming..." : `Claim ${unclaimedCount}`}
      </Button>
    </div>
  );
}

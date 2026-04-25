"use client";

import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StreakBadgeProps {
  current: number;
}

export function StreakBadge({ current }: StreakBadgeProps) {
  if (current === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Flame className="h-3.5 w-3.5" />
        No streak — journal today!
      </Badge>
    );
  }

  return (
    <Badge className="gap-1 bg-orange-500 hover:bg-orange-600 text-white">
      <Flame className="h-3.5 w-3.5" />
      {current} day streak 🔥
    </Badge>
  );
}

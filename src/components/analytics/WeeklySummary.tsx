"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface WeeklySummaryProps {
  entryCount: number;
  avgMood: number | null;
  topTemplate: string;
  daysActive: number;
}

const moodLabel: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

export function WeeklySummary({
  entryCount,
  avgMood,
  topTemplate,
  daysActive,
}: WeeklySummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          This Week
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Entries</span>
          <span className="font-semibold">{entryCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Days Active</span>
          <span className="font-semibold">{daysActive}/7</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Avg Mood</span>
          <span className="font-semibold">
            {avgMood
              ? `${avgMood} — ${moodLabel[Math.round(avgMood)] ?? ""}`
              : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Top Template</span>
          <span className="font-semibold truncate ml-4">{topTemplate}</span>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Flame, BookOpen, Trophy, LayoutTemplate } from "lucide-react";

interface StatsCardsProps {
  totalEntries: number;
  currentStreak: number;
  longestStreak: number;
  topTemplate: string;
}

export function StatsCards({
  totalEntries,
  currentStreak,
  longestStreak,
  topTemplate,
}: StatsCardsProps) {
  const stats = [
    {
      label: "Total Entries",
      value: totalEntries,
      icon: BookOpen,
      color: "text-blue-500",
    },
    {
      label: "Current Streak",
      value: `${currentStreak}d`,
      icon: Flame,
      color: "text-orange-500",
    },
    {
      label: "Longest Streak",
      value: `${longestStreak}d`,
      icon: Trophy,
      color: "text-yellow-500",
    },
    {
      label: "Top Template",
      value: topTemplate,
      icon: LayoutTemplate,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold truncate">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

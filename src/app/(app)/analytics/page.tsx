"use client";

import { useEffect, useState } from "react";
import {
  calculateStreaks,
  extractMoodTrend,
  getTemplateUsage,
  getWeeklySummary,
  getActivityHeatmap,
  JournalEntry,
} from "@/lib/analytics";
import { StatsCards } from "@/components/analytics/StatsCards";
import { MoodChart } from "@/components/analytics/MoodChart";
import { TemplateChart } from "@/components/analytics/TemplateChart";
import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap";
import { WeeklySummary } from "@/components/analytics/WeeklySummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { redirect } from "next/dist/client/components/navigation";

export default function AnalyticsPage() {
  // Analytics page is disabled for now
  redirect('/dashboard')

  const [entries, setEntries] = useState<JournalEntry[]>([]);

  /*useEffect(() => {
    const stored = localStorage.getItem("journal-entries");
    if (stored) {
      try {
        setEntries(JSON.parse(stored));
      } catch {
        setEntries([]);
      }
    }
  }, []);*/
  useEffect(() => {
    async function fetchEntries() {
      const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser()
      
        if (!user) redirect('/login')
      let query = supabase.from("journal_entries").select("*").eq("user_id", user.id);
      const { data, error } = await query;
      if (error) {
        console.error("Failed to fetch journal entries for analytics", error);
        return;
      }
      if (data) {
        setEntries(data);
      }
    }
    fetchEntries();

  }, []);

  const streaks = calculateStreaks(entries);
  const moodTrend = extractMoodTrend(entries);
  const templateUsage = getTemplateUsage(entries);
  const weekly = getWeeklySummary(entries);
  const heatmap = getActivityHeatmap(entries);

  return (
    <div className="container mx-auto py-8 px-4 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Track your journaling habits and spot patterns.
        </p>
      </div>

      <StatsCards
        totalEntries={entries.length}
        currentStreak={streaks.current}
        longestStreak={streaks.longest}
        topTemplate={templateUsage[0]?.name ?? "—"}
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mood">Mood</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <WeeklySummary {...weekly} />
            <TemplateChart data={templateUsage} />
          </div>
        </TabsContent>

        <TabsContent value="mood">
          <MoodChart data={moodTrend} />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityHeatmap data={heatmap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

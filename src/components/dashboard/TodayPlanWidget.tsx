"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DayPlan } from "@/lib/types";
import { fetchDayPlan, todayDate } from "@/lib/day-plans";
import { format } from "date-fns";

const CATEGORY_STYLES: Record<string, string> = {
  deep_work: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  meeting:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  break:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  personal:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  exercise:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  other:     "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface TodayPlanWidgetProps {
  userId: string;
}

export function TodayPlanWidget({ userId }: TodayPlanWidgetProps) {
  const supabase = createClient();
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayDate();
  const nowMinutes = (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();

  useEffect(() => {
    fetchDayPlan(supabase, userId, today)
      .then(setPlan)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  function toMinutes(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Today's Plan
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {format(new Date(), "EEEE, MMM d")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
        ) : !plan || plan.blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No plan for today. Use the <strong>Day Planner</strong> field in a journal entry to plan ahead.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {[...plan.blocks]
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((block) => {
                const isCurrent =
                  toMinutes(block.start_time) <= nowMinutes &&
                  toMinutes(block.end_time) > nowMinutes;
                const isPast = toMinutes(block.end_time) <= nowMinutes;

                return (
                  <li
                    key={block.id}
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-2.5 transition-all",
                      isCurrent && "ring-2 ring-primary border-primary bg-primary/5",
                      isPast && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground w-28">
                      <Clock className="h-3 w-3" />
                      {block.start_time} – {block.end_time}
                    </div>
                    <p className={cn("text-sm flex-1 truncate", isPast && "line-through")}>
                      {block.title}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn("text-xs h-5", CATEGORY_STYLES[block.category])}
                    >
                      {block.category.replace("_", " ")}
                    </Badge>
                    {isCurrent && (
                      <Badge className="text-xs h-5 bg-primary">Now</Badge>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

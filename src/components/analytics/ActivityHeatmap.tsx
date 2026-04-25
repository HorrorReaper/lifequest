"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HeatmapDay } from "@/lib/analytics";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
  data: HeatmapDay[];
}

function getIntensity(count: number) {
  if (count === 0) return "bg-muted";
  if (count === 1) return "bg-primary/25";
  if (count === 2) return "bg-primary/50";
  if (count === 3) return "bg-primary/75";
  return "bg-primary";
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity (Last 90 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="flex flex-wrap gap-1">
            {data.map((day) => (
              <Tooltip key={day.date}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-3.5 w-3.5 rounded-sm transition-colors",
                      getIntensity(day.count)
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {format(new Date(day.date), "MMM dd, yyyy")} —{" "}
                    {day.count} {day.count === 1 ? "entry" : "entries"}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn("h-3 w-3 rounded-sm", getIntensity(i))}
            />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

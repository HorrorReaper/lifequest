"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoodDataPoint } from "@/lib/analytics";

const moodEmojis: Record<number, string> = {
  1: "😢",
  2: "😟",
  3: "😐",
  4: "🙂",
  5: "😄",
};

interface MoodChartProps {
  data: MoodDataPoint[];
}

export function MoodChart({ data }: MoodChartProps) {
  const filledData = data.filter((d) => d.mood > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Mood Trend (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {filledData.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">
            No mood data yet. Add mood fields to your entries!
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={filledData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) =>
                  `${value} ${moodEmojis[Math.round(value)] ?? ""}`
                }
              />
              <Line
                type="monotone"
                dataKey="mood"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

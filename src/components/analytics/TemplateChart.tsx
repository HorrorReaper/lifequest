"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateUsage } from "@/lib/analytics";

interface TemplateChartProps {
  data: TemplateUsage[];
}

export function TemplateChart({ data }: TemplateChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Template Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">
            No entries yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.slice(0, 6)} layout="vertical">
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GRATITUDE_LINES, GRATITUDE_MAX } from "@/lib/today-plan";
import { cn } from "@/lib/utils";

const LINE_LABELS = [
  "I'm grateful for…",
  "I'm also grateful for…",
  "And grateful for…",
] as const;

interface PlanGratitudeProps {
  /** The lines as typed, empty ones included; shorter than GRATITUDE_LINES for a fresh plan. */
  lines: string[];
  onChange: (lines: string[]) => void;
  /** Set while "Next" was refused for want of a first line. */
  missing: boolean;
}

/**
 * The gratitude step of the daily planner: three lines as in Morning
 * Reflection, the first one required. The step heading asks the question,
 * so the lines carry only their own labels.
 */
export function PlanGratitude({ lines, onChange, missing }: PlanGratitudeProps) {
  function setLine(index: number, value: string) {
    const next = Array.from({ length: GRATITUDE_LINES }, (_, i) => lines[i] ?? "");
    next[index] = value;
    onChange(next);
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5">
      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-5 sm:p-6">
          {LINE_LABELS.map((label, index) => {
            const id = `plan-gratitude-${index}`;
            const required = index === 0;
            return (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id} className="text-sm font-medium">
                  {label}
                  {!required && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Optional
                    </span>
                  )}
                </Label>
                <Input
                  id={id}
                  value={lines[index] ?? ""}
                  onChange={(event) => setLine(index, event.target.value)}
                  maxLength={GRATITUDE_MAX}
                  aria-required={required || undefined}
                  aria-invalid={(required && missing) || undefined}
                  className={cn(
                    "h-12 rounded-xl bg-background/80 text-base sm:h-12 md:text-base",
                    required && missing && "border-destructive"
                  )}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DayHoursDialog,
  type DayHours,
} from "@/components/planning/DayHoursDialog";
import type { DayPlanBlock } from "@/lib/types";

interface DayFrameBarProps {
  hours: DayHours;
  blocks: DayPlanBlock[];
  onChange: (hours: DayHours) => void;
}

/**
 * The day's frame in one line above the timeline: "Your day · 08:00–18:00",
 * the day-end reminder under it, and "Edit day hours".
 *
 * This used to be a card of three always-open time fields on its own step.
 * The hours are set once and rarely touched, so they read as a line and edit
 * in a dialog.
 */
export function DayFrameBar({ hours, blocks, onChange }: DayFrameBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y py-2.5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />
          <span>
            Your day · {hours.day_start}–{hours.day_end}
          </span>
        </p>
        <p className="mt-0.5 pl-6 text-sm text-muted-foreground">
          {hours.shutdown_time
            ? `Day-end reminder · ${hours.shutdown_time} · No time block`
            : "No day-end reminder"}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="-mr-2 text-primary hover:text-primary"
      >
        Edit day hours
      </Button>

      <DayHoursDialog
        open={open}
        onOpenChange={setOpen}
        hours={hours}
        blocks={blocks}
        onApply={onChange}
      />
    </div>
  );
}
